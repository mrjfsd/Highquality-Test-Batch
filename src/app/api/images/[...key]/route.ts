import { type NextRequest } from "next/server";
import sharp from "sharp";
import { getR2Object, generatePresignedReadUrl } from "@/lib/r2/operations";

// Server-side in-memory LRU cache for R2 image objects (both original and transformed variants)
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
 * Secure proxy serving original or responsive resized product images from private Cloudflare R2 bucket.
 * Features:
 * - On-the-fly sharp WebP conversion and responsive resizing (?w=...&q=...)
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
  const widthParam = parseInt(searchParams.get("w") || "", 10);
  const qualityParam = parseInt(searchParams.get("q") || "80", 10);
  const targetWidth = !isNaN(widthParam) && widthParam >= 60 && widthParam <= 2560 ? widthParam : undefined;
  const targetQuality = !isNaN(qualityParam) && qualityParam >= 30 && qualityParam <= 100 ? qualityParam : 80;

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
  const cacheKey = targetWidth ? `${objectKey}?w=${targetWidth}&q=${targetQuality}` : objectKey;

  // 1. Check in-memory cache for fast repeat delivery (hit)
  const cached = getFromCache(cacheKey);
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
    // Check if the original object is already in memory cache
    let originalBuffer: Uint8Array | undefined = getFromCache(objectKey)?.buffer;
    let baseContentType = inferContentTypeFromKey(objectKey);
    let baseEtag = `${objectKey}-orig`;

    if (!originalBuffer) {
      const r2Result = await getR2Object(objectKey, clientEtag || undefined);

      if (r2Result.isNotModified && !targetWidth) {
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

      originalBuffer = r2Result.body;
      baseContentType = r2Result.contentType || inferContentTypeFromKey(objectKey);
      baseEtag = r2Result.etag || `${objectKey}-${originalBuffer.length}`;

      // Cache original in memory
      addToCache(objectKey, {
        buffer: originalBuffer,
        contentType: baseContentType,
        etag: baseEtag,
        contentLength: r2Result.contentLength || originalBuffer.length,
      });
    }

    // If a target width is requested, resize and convert to WebP on-the-fly using sharp
    if (targetWidth) {
      try {
        const transformedBuffer = await sharp(originalBuffer)
          .resize({ width: targetWidth, withoutEnlargement: true })
          .webp({ quality: targetQuality })
          .toBuffer();

        const transformedEtag = `${baseEtag}-w${targetWidth}-q${targetQuality}`;

        if (matchClientEtag(clientEtag, transformedEtag)) {
          return new Response(null, {
            status: 304,
            headers: {
              "ETag": `"${transformedEtag}"`,
              "Cache-Control": cacheControl,
              "Vary": "Accept-Encoding",
            },
          });
        }

        addToCache(cacheKey, {
          buffer: transformedBuffer,
          contentType: "image/webp",
          etag: transformedEtag,
          contentLength: transformedBuffer.length,
        });

        return new Response(transformedBuffer as unknown as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "image/webp",
            "Content-Length": transformedBuffer.length.toString(),
            "Cache-Control": cacheControl,
            "ETag": `"${transformedEtag}"`,
            "Vary": "Accept-Encoding",
            "X-Image-Proxy": "r2-sharp-webp",
            "X-Cache": "MISS",
          },
        });
      } catch (sharpErr) {
        console.warn("[image-proxy] sharp processing failed, falling back to original:", sharpErr);
      }
    }

    // Default: serve original buffer
    if (matchClientEtag(clientEtag, baseEtag)) {
      return new Response(null, {
        status: 304,
        headers: {
          "ETag": `"${baseEtag}"`,
          "Cache-Control": cacheControl,
          "Vary": "Accept-Encoding",
        },
      });
    }

    return new Response(originalBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": baseContentType,
        "Content-Length": originalBuffer.length.toString(),
        "Cache-Control": cacheControl,
        "ETag": `"${baseEtag}"`,
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
