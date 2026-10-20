import { type NextRequest } from "next/server";
import { getR2Object, generatePresignedReadUrl } from "@/lib/r2/operations";

// Server-side in-memory LRU cache for R2 image objects
interface CachedR2Object {
  buffer: Uint8Array;
  contentType: string;
  etag: string;
  contentLength: number;
}

const MAX_CACHE_ENTRIES = 100;
const imageCache = new Map<string, CachedR2Object>();

function getFromCache(key: string): CachedR2Object | undefined {
  const item = imageCache.get(key);
  if (item) {
    // Refresh LRU order
    imageCache.delete(key);
    imageCache.set(key, item);
  }
  return item;
}

function addToCache(key: string, item: CachedR2Object): void {
  if (imageCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey) {
      imageCache.delete(oldestKey);
    }
  }
  imageCache.set(key, item);
}

// Fallback MIME type detector based on file extension
function inferContentTypeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

const cleanServerEtag = (etag: string) => etag.replace(/^W\//, "").replace(/"/g, "").trim();

const matchClientEtag = (clientHeader: string | null, serverEtag: string) => {
  if (!clientHeader) return false;
  const cleanServer = cleanServerEtag(serverEtag);
  return clientHeader
    .split(",")
    .map((t) => cleanServerEtag(t.trim()))
    .some((t) => t === cleanServer || t === "*");
};

/**
 * GET /api/images/[...key]
 *
 * Secure proxy serving original product images from the private Cloudflare R2 bucket.
 * 
 * Note: Sharp-dependent image transformations (resizing, format conversion) have been
 * removed. Images are now compressed browser-side prior to upload.
 * Any legacy transformation query parameters (?w=, ?q=, ?f=) are safely ignored,
 * and the stored image is served directly with immutable HTTP caching.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: keySegments } = await params;

  if (!keySegments || keySegments.length === 0) {
    return new Response(JSON.stringify({ error: "Image key is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Reconstruct the object key from path segments
  const objectKey = keySegments.join("/");

  // Basic sanity check — prevent path traversal
  if (objectKey.includes("..")) {
    return new Response(JSON.stringify({ error: "Invalid image key." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const isRaw = searchParams.get("raw") === "true" || searchParams.get("raw") === "1";

  // Raw bypass: if raw presigned URL is explicitly requested, redirect with 307
  if (isRaw) {
    try {
      const presignedUrl = await generatePresignedReadUrl(objectKey, 3600);
      return Response.redirect(presignedUrl, 307);
    } catch (err: unknown) {
      console.error("[image-proxy] Presigned raw redirect error:", err);
      return new Response(JSON.stringify({ error: "Could not retrieve raw image." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 1. Check in-memory cache for fast repeat delivery
  const cached = getFromCache(objectKey);
  if (cached) {
    const clientEtag = request.headers.get("if-none-match");
    if (matchClientEtag(clientEtag, cached.etag)) {
      return new Response(null, {
        status: 304,
        headers: {
          "ETag": `"${cached.etag}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Vary": "Accept-Encoding",
        },
      });
    }

    return new Response(new Uint8Array(cached.buffer), {
      status: 200,
      headers: {
        "Content-Type": cached.contentType,
        "Content-Length": cached.contentLength.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": `"${cached.etag}"`,
        "Vary": "Accept-Encoding",
        "X-Image-Proxy": "r2-direct",
        "X-Cache": "HIT",
      },
    });
  }

  // 2. Fetch original directly from private R2 bucket
  try {
    const r2Object = await getR2Object(objectKey);
    const contentType = r2Object.contentType || inferContentTypeFromKey(objectKey);
    const etag = r2Object.etag || `${objectKey}-${r2Object.body.length}`;
    const contentLength = r2Object.contentLength || r2Object.body.length;

    // Check conditional ETag request (HTTP 304)
    const clientEtag = request.headers.get("if-none-match");
    if (matchClientEtag(clientEtag, etag)) {
      return new Response(null, {
        status: 304,
        headers: {
          "ETag": `"${etag}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Vary": "Accept-Encoding",
        },
      });
    }

    // Cache the object in memory for hot path
    addToCache(objectKey, {
      buffer: r2Object.body,
      contentType,
      etag,
      contentLength,
    });

    return new Response(new Uint8Array(r2Object.body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": contentLength.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": `"${etag}"`,
        "Vary": "Accept-Encoding",
        "X-Image-Proxy": "r2-direct",
        "X-Cache": "MISS",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process image.";
    console.error(`[image-proxy] Error retrieving ${objectKey}:`, message);

    const isNotFound =
      (err as { name?: string })?.name === "NoSuchKey" ||
      message.includes("NoSuchKey") ||
      message.includes("not found");

    if (isNotFound) {
      return new Response(JSON.stringify({ error: "Image not found." }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response(
      JSON.stringify({ error: "Could not retrieve image. Check R2 configuration." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
