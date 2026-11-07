"use client";

import imageCompression from "browser-image-compression";

export interface CompressionConfig {
  maxSizeMB: number; // Target 1-2 MB (default: 1.5)
  maxWidthOrHeight: number; // Longest side max (default: 2000)
  initialQuality: number; // Quality setting (default: 0.85)
  concurrency: number; // Concurrency limit (default: 3)
}

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 2000,
  initialQuality: 0.85,
  concurrency: 3,
};

export interface ProcessedImageResult {
  file: File;
  wasCompressed: boolean;
  originalSize: number;
  finalSize: number;
  mimeType: string;
  width: number;
  height: number;
  compressionError?: string;
}

export interface R2UploadErrorDetails {
  status: number;
  statusText?: string;
  isTimeout: boolean;
  isStalled: boolean;
  onLine: boolean;
  fileSize: number;
  isRetryable: boolean;
}

export class R2UploadError extends Error {
  details: R2UploadErrorDetails;
  constructor(message: string, details: R2UploadErrorDetails) {
    super(message);
    this.name = "R2UploadError";
    this.details = details;
  }
}

// Maps MIME types to standard file extensions
export const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

/**
 * Ensures the filename extension accurately matches the output MIME type.
 */
export function ensureExtensionMatchesMime(fileName: string, mimeType: string): string {
  const targetExt = MIME_TO_EXTENSION[mimeType] || ".jpg";
  const lastDot = fileName.lastIndexOf(".");
  const baseName = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
  return `${baseName}${targetExt}`;
}

/**
 * Inspects image natural dimensions in the browser without loading the whole image into DOM.
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      return { width, height };
    } catch {
      // Fall through to Image element
    }
  }

  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      return resolve({ width: 0, height: 0 });
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

/**
 * Determines whether client-side recompression is necessary.
 * Avoids unnecessary recompression when an image is already appropriately sized.
 */
export function shouldCompress(
  file: File,
  width: number,
  height: number,
  config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG
): boolean {
  const maxBytes = config.maxSizeMB * 1024 * 1024;
  const isSizeSmallEnough = file.size <= maxBytes;
  const isDimensionSmallEnough =
    width > 0 &&
    height > 0 &&
    width <= config.maxWidthOrHeight &&
    height <= config.maxWidthOrHeight;

  // If already under target size and within max dimensions, do not recompress
  if (isSizeSmallEnough && isDimensionSmallEnough) {
    return false;
  }
  return true;
}

/**
 * Compresses an image in the browser before upload to Cloudflare R2.
 * - Targets ~1–2 MB.
 * - Max dimension 2000px longest side.
 * - Quality ~0.85.
 * - Preserves aspect ratio and never enlarges smaller originals.
 * - Preserves PNG/WebP transparency.
 * - Falls back safely to original file if compression fails and original is <= 10MB.
 */
export async function compressImageForUpload(
  file: File,
  customConfig: Partial<CompressionConfig> = {}
): Promise<ProcessedImageResult> {
  const config: CompressionConfig = {
    ...DEFAULT_COMPRESSION_CONFIG,
    ...customConfig,
  };

  const originalSize = file.size;
  const { width, height } = await getImageDimensions(file);

  // 1. Check if compression is even necessary
  if (!shouldCompress(file, width, height, config)) {
    return {
      file,
      wasCompressed: false,
      originalSize,
      finalSize: originalSize,
      mimeType: file.type || "image/jpeg",
      width,
      height,
    };
  }

  // 2. Determine target file type to preserve transparency
  // Keep PNG as PNG and WebP as WebP to avoid stripping alpha channel
  let targetFileType = file.type;
  if (!targetFileType || !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(targetFileType)) {
    targetFileType = "image/jpeg";
  }

  // Never enlarge: if original dimensions are smaller than 2000px, clamp maxWidthOrHeight to original
  const maxDim = width > 0 && height > 0
    ? Math.min(config.maxWidthOrHeight, Math.max(width, height))
    : config.maxWidthOrHeight;

  try {
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: config.maxSizeMB,
      maxWidthOrHeight: maxDim,
      initialQuality: config.initialQuality,
      useWebWorker: true,
      fileType: targetFileType,
      alwaysKeepResolution: false,
    });

    // If compression resulted in a larger file (rare, but can happen with already optimized assets),
    // retain the original file if it's within server upload limit (10MB)
    if (compressedBlob.size >= originalSize && originalSize <= 10 * 1024 * 1024) {
      return {
        file,
        wasCompressed: false,
        originalSize,
        finalSize: originalSize,
        mimeType: file.type,
        width,
        height,
      };
    }

    const outputMime = compressedBlob.type || targetFileType;
    const finalName = ensureExtensionMatchesMime(file.name, outputMime);
    const compressedFile = new File([compressedBlob], finalName, {
      type: outputMime,
      lastModified: Date.now(),
    });

    const { width: finalWidth, height: finalHeight } = await getImageDimensions(compressedFile);

    return {
      file: compressedFile,
      wasCompressed: true,
      originalSize,
      finalSize: compressedFile.size,
      mimeType: outputMime,
      width: finalWidth || width,
      height: finalHeight || height,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[client-compression] Compression failed for "${file.name}" (original size: ${(originalSize / (1024 * 1024)).toFixed(2)} MB): ${errorMsg}. Falling back to raw file.`
    );

    // Safe fallback: if original file is <= 10 MB (server presign limit), use it
    if (originalSize <= 10 * 1024 * 1024) {
      return {
        file,
        wasCompressed: false,
        originalSize,
        finalSize: originalSize,
        mimeType: file.type || "image/jpeg",
        width,
        height,
        compressionError: errorMsg,
      };
    }

    throw new Error(
      `Failed to compress "${file.name}" (${(originalSize / (1024 * 1024)).toFixed(1)} MB), and the original file exceeds the 10 MB upload limit.`
    );
  }
}

/**
 * Uploads a file directly to Cloudflare R2 using a presigned PUT URL and XMLHttpRequest.
 * Provides real-time upload progress via xhr.upload.onprogress.
 * Features:
 * - Stall timeout: aborts if no progress event for ~25s (handles dropped cellular connections without false fixed timeouts)
 * - Specific, classified error reporting with status code, offline state, and timeout status
 */
export function uploadToR2WithProgress(
  presignedUrl: string,
  file: Blob | File,
  contentType: string,
  onProgress?: (loadedBytes: number, totalBytes: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException("Upload cancelled by administrator.", "AbortError"));
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presignedUrl, true);
    xhr.setRequestHeader("Content-Type", contentType);

    const STALL_TIMEOUT_MS = 25000; // 25s without upload progress
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    let isStalled = false;

    const resetStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        isStalled = true;
        try {
          xhr.abort();
        } catch {
          // ignore
        }
      }, STALL_TIMEOUT_MS);
    };

    const clearStallTimer = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };

    if (signal) {
      const abortHandler = () => {
        clearStallTimer();
        try {
          xhr.abort();
        } catch {
          // ignore
        }
        reject(new DOMException("Upload cancelled by administrator.", "AbortError"));
      };
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    // Arm initial stall timer
    resetStallTimer();

    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        resetStallTimer();
        if (onProgress && event.lengthComputable) {
          onProgress(event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      clearStallTimer();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        const is5xx = xhr.status >= 500 && xhr.status < 600;
        const msg =
          xhr.status === 403
            ? "R2 upload forbidden or URL expired (HTTP 403)"
            : xhr.status === 401
            ? "R2 upload unauthorized (HTTP 401)"
            : is5xx
            ? `Cloudflare R2 server error (HTTP ${xhr.status} ${xhr.statusText || ""})`.trim()
            : `R2 upload rejected with HTTP ${xhr.status} (${xhr.statusText || "Request rejected"})`;

        reject(
          new R2UploadError(msg, {
            status: xhr.status,
            statusText: xhr.statusText,
            isTimeout: false,
            isStalled: false,
            onLine: typeof navigator !== "undefined" ? navigator.onLine : true,
            fileSize: file.size,
            isRetryable: is5xx,
          })
        );
      }
    };

    xhr.onerror = () => {
      clearStallTimer();
      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      const msg = !isOnline
        ? "Network error: Device is offline / Connection lost."
        : "Network error during upload (HTTP status 0: connection dropped, preflight blocked, or CORS mismatch).";

      reject(
        new R2UploadError(msg, {
          status: 0,
          statusText: "Network Error",
          isTimeout: false,
          isStalled: false,
          onLine: isOnline,
          fileSize: file.size,
          isRetryable: true,
        })
      );
    };

    xhr.onabort = () => {
      clearStallTimer();
      if (isStalled) {
        reject(
          new R2UploadError("Upload timed out (connection stalled with no progress for 25s).", {
            status: 0,
            statusText: "Timeout",
            isTimeout: true,
            isStalled: true,
            onLine: typeof navigator !== "undefined" ? navigator.onLine : true,
            fileSize: file.size,
            isRetryable: true,
          })
        );
      } else {
        reject(new DOMException("Upload cancelled by administrator.", "AbortError"));
      }
    };

    xhr.send(file);
  });
}

export interface UploadWithRetryParams {
  file: Blob | File;
  contentType: string;
  productId: string;
  fileName: string;
  existingKey?: string;
  fetchPresignedUrl: (params: {
    productId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    objectKey?: string;
  }) => Promise<{ presignedUrl: string; objectKey: string }>;
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
  maxAttempts?: number;
}

/**
 * Executes direct upload to R2 with automatic retry and backoff:
 * - Up to 3 attempts with backoff (1s after attempt 1, 3s after attempt 2).
 * - Requests a fresh presigned URL for each attempt.
 * - Reuses the deterministic object key across attempts.
 * - Retries only on retryable errors (status 0, stall timeout, HTTP 5xx). Never retries 4xx.
 */
export async function uploadToR2WithRetry(
  params: UploadWithRetryParams
): Promise<{ objectKey: string }> {
  const {
    file,
    contentType,
    productId,
    fileName,
    existingKey,
    fetchPresignedUrl,
    onProgress,
    signal,
    maxAttempts = 3,
  } = params;

  let attempt = 0;
  let currentKey = existingKey;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    if (signal?.aborted) {
      throw new DOMException("Upload cancelled by administrator.", "AbortError");
    }

    attempt++;

    try {
      // 1. Fetch fresh presigned URL (providing currentKey if already known to preserve key identity)
      const { presignedUrl, objectKey } = await fetchPresignedUrl({
        productId,
        fileName,
        contentType,
        fileSize: file.size,
        objectKey: currentKey,
      });

      currentKey = objectKey;

      if (signal?.aborted) {
        throw new DOMException("Upload cancelled by administrator.", "AbortError");
      }

      // 2. Upload with stall timeout & progress events
      await uploadToR2WithProgress(presignedUrl, file, contentType, onProgress, signal);

      // Successfully uploaded!
      return { objectKey: currentKey };
    } catch (err: unknown) {
      lastError = err;

      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }

      const isR2Err = err instanceof R2UploadError;
      const isRetryable = isR2Err ? err.details.isRetryable : true;

      // Do NOT retry non-retryable errors (e.g. 4xx)
      if (!isRetryable || attempt >= maxAttempts) {
        break;
      }

      // Backoff: 1s after attempt 1, 3s after attempt 2
      const backoffMs = attempt === 1 ? 1000 : 3000;
      console.warn(
        `[upload-retry] Attempt ${attempt}/${maxAttempts} failed for "${fileName}". Retrying in ${backoffMs}ms... Error: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}
