import type { NextRequest } from "next/server";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import { generatePresignedUploadUrl } from "@/lib/r2/operations";
import { getR2BucketName } from "@/lib/r2/client";
import crypto from "crypto";

// Accepted MIME types for product images
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

// Extension map for MIME types
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

// Maximum allowed file size: 10 MB
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Strict pattern for client-supplied retry key: products/temp-batch/<timestamp>-<uuid>.<ext>
const TEMP_BATCH_KEY_REGEX =
  /^products\/temp-batch\/\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp|avif)$/i;

interface RequestBody {
  productId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  objectKey?: string;
}

/**
 * POST /api/admin/images/upload-url
 *
 * Generates a presigned PUT URL for a single image upload to the private R2 bucket.
 * The browser uploads directly to R2 using this URL — the file bytes never pass
 * through the Next.js server.
 *
 * Security:
 * - Requires a valid, server-verified admin session (checked via cookie).
 * - Validates MIME type and file size server-side before generating the URL.
 * - Returns only the presigned URL and the object key — no credentials.
 */
export async function POST(request: NextRequest) {
  // 1. Verify admin authorization on the server (checks Bearer token header and cookies)
  const auth = await verifyAdminServer(request);
  if (!auth.isAdmin) {
    return Response.json(
      {
        error: auth.isAuthenticated
          ? "Forbidden: Administrator privileges are required."
          : "Unauthorized: No active administrator session.",
      },
      { status: auth.isAuthenticated ? 403 : 401 }
    );
  }

  // 2. Parse and validate the request body
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const { productId, contentType, fileSize } = body;

  if (!productId || typeof productId !== "string" || productId.trim() === "") {
    return Response.json({ error: "productId is required." }, { status: 400 });
  }

  const cleanProductId = productId.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanProductId)) {
    return Response.json(
      {
        error:
          "Invalid productId format. Must contain only alphanumeric characters, dashes, or underscores.",
      },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    return Response.json(
      {
        error: `Unsupported file type: ${contentType}. Accepted types: JPEG, PNG, WebP, AVIF.`,
      },
      { status: 400 }
    );
  }

  if (typeof fileSize !== "number" || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
    return Response.json(
      {
        error: `File size must be between 1 byte and ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      },
      { status: 400 }
    );
  }

  // 3. Construct or validate collision-resistant, scoped object key
  let objectKey: string;
  if (body.objectKey) {
    if (
      typeof body.objectKey !== "string" ||
      body.objectKey.includes("..") ||
      body.objectKey.includes("\\") ||
      !TEMP_BATCH_KEY_REGEX.test(body.objectKey)
    ) {
      return Response.json(
        {
          error:
            "Invalid client-supplied objectKey. Only products/temp-batch/ keys with valid format are permitted for re-signing.",
        },
        { status: 400 }
      );
    }
    objectKey = body.objectKey;
  } else {
    const ext = MIME_TO_EXT[contentType] || "jpg";
    const uniqueId = crypto.randomUUID();
    objectKey = `products/${cleanProductId}/${Date.now()}-${uniqueId}.${ext}`;
  }

  // 4. Generate the presigned upload URL (server-side only)
  let presignedUrl: string;
  try {
    presignedUrl = await generatePresignedUploadUrl(objectKey, contentType);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate upload URL.";
    // Log server-side, return safe message to client
    console.error("[upload-url] R2 presign error:", message);
    return Response.json(
      { error: "Could not generate upload URL. Check R2 configuration." },
      { status: 500 }
    );
  }

  return Response.json({
    presignedUrl,
    objectKey,
    bucketName: getR2BucketName(),
  });
}
