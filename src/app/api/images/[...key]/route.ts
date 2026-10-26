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
const MAX_CACHE_BYTES = 50 * 1024 * 1024; // 50 MB total in-memory cap
let currentCacheBytes = 0;
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
  const itemBytes = item.contentLength || item.buffer.byteLength;
  // If single item exceeds 10MB, bypass in-memory caching to avoid heap pressure
  if (itemBytes > 10 * 1024 * 1024) return;

  // Evict oldest items if limit reached by count or memory consumption
  while (
    (imageCache.size >= MAX_CACHE_ENTRIES || currentCacheBytes + itemBytes > MAX_CACHE_BYTES) &&
    imageCache.size > 0
  ) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey) {
      const oldItem = imageCache.get(oldestKey);
      if (oldItem) {
        currentCacheBytes -= oldItem.contentLength || oldItem.buffer.byteLength;
      }
      imageCache.delete(oldestKey);
    }
  }

  imageCache.set(key, item);
  currentCacheBytes += itemBytes;
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
 * Returns appropriate Cache-Control header:
 * - Product images have timestamp-uuid in the key (e.g., products/123/1730000000-uuid.webp)
 *   and are genuinely immutable.
 * - Non-unique assets use standard public caching with stale-while-revalidate.
 */
function getCacheControlHeader(objectKey: string): string {
  if (objectKey.startsWith("products/")) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=86400, stale-while-revalidate=604800";
}

/**
 * GET /api/images/[...key]
 *
 * Secure proxy serving original product images from the private Cloudflare R2 bucket.
 * Features:
 * - In-memory LRU cache with entry and byte bounding
 * - Conditional request (304 Not Modified) with ETag matching
 * - Zero-copy buffer delivery
 * - Path-aware Cache-Control
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

  const cacheControl = getCacheControlHeader(objectKey);

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

  const clientEtag = request.headers.get("if-none-match");

  // 1. Check in-memory cache for fast repeat delivery
  const cached = getFromCache(objectKey);
  if (cached) {
    if (matchClientEtag(clientEtag, cached.etag)) {
      return new Response(null, {
        status: 304,
        headers: {
          "ETag": `"${cached.etag}"`,
          "Cache-Control": cacheControl,
          "Vary": "Accept-Encoding",
        },
      });
    }

    return new Response(cached.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": cached.contentType,
        "Content-Length": cached.contentLength.toString(),
        "Cache-Control": cacheControl,
        "ETag": `"${cached.etag}"`,
        "Vary": "Accept-Encoding",
        "X-Image-Proxy": "r2-direct",
        "X-Cache": "HIT",
      },
    });
  }

  // 2. Fetch original directly from private R2 bucket (supporting conditional requests)
  try {
    const r2Result = await getR2Object(objectKey, clientEtag || undefined);

    if (r2Result.isNotModified) {
      return new Response(null, {
        status: 304,
        headers: {
          "ETag": `"${r2Result.etag || cleanServerEtag(clientEtag || "")}"`,
          "Cache-Control": cacheControl,
          "Vary": "Accept-Encoding",
        },
      });
    }

    if (!r2Result.body) {
      throw new Error(`Empty body returned for object ${objectKey}`);
    }

    const contentType = r2Result.contentType || inferContentTypeFromKey(objectKey);
    const etag = r2Result.etag || `${objectKey}-${r2Result.body.length}`;
    const contentLength = r2Result.contentLength || r2Result.body.length;

    // Check conditional ETag request (HTTP 304)
    if (matchClientEtag(clientEtag, etag)) {
      return new Response(null, {
        status: 304,
        headers: {
          "ETag": `"${etag}"`,
          "Cache-Control": cacheControl,
          "Vary": "Accept-Encoding",
        },
      });
    }

    // Cache the object in memory for hot path
    addToCache(objectKey, {
      buffer: r2Result.body,
      contentType,
      etag,
      contentLength,
    });

    return new Response(r2Result.body as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": contentLength.toString(),
        "Cache-Control": cacheControl,
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

/**
 * HEAD /api/images/[...key]
 *
 * Lightweight header probe endpoint for CDNs and client caching checks.
 */
export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  const res = await GET(request, context);
  return new Response(null, {
    status: res.status,
    headers: res.headers,
  });
}
