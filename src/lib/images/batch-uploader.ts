"use client";

import {
  compressImageForUpload,
  uploadToR2WithProgress,
  CompressionConfig,
} from "./client-compression";

export type UploadStage =
  | "Preparing"
  | "Compressing"
  | "Uploading"
  | "Saving product"
  | "Completed"
  | "Cancelled"
  | "Failed";

export interface BatchUploadItem {
  id: string;
  file: File;
  altText: string;
  color: string;
  isPrimary: boolean;
  displayOrder: number;
}

export interface ItemUploadStatus {
  id: string;
  fileName: string;
  status: "pending" | "compressing" | "requesting_url" | "uploading" | "completed" | "failed" | "cancelled";
  uploadProgressPercent: number; // 0 - 100
  originalSize: number;
  compressedSize?: number;
  wasCompressed?: boolean;
  storagePath?: string;
  mimeType?: string;
  error?: string;
  width?: number;
  height?: number;
}

export interface BatchProgressState {
  stage: UploadStage;
  overallPercent: number; // 0 - 100
  processedCount: number;
  totalCount: number;
  successCount: number;
  failedCount: number;
  cancelledCount: number;
  currentFileName: string | null;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  items: Record<string, ItemUploadStatus>;
}

export interface SuccessfulUploadResult {
  id: string;
  storagePath: string;
  displayOrder: number;
  isPrimary: boolean;
  altText: string;
  color: string;
  mimeType: string;
  fileSizeBytes: number;
  originalSizeBytes: number;
  width?: number;
  height?: number;
}

export interface FailedUploadResult {
  id: string;
  fileName: string;
  error: string;
  displayOrder: number;
}

export interface BatchUploadOutput {
  successful: SuccessfulUploadResult[];
  failed: FailedUploadResult[];
  cancelled: BatchUploadItem[];
}

export interface BatchUploadOptions {
  productId: string;
  items: BatchUploadItem[];
  getAuthToken?: () => Promise<string | undefined>;
  compressionConfig?: Partial<CompressionConfig>;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (state: BatchProgressState) => void;
}

/**
 * Runs controlled batch uploads to Cloudflare R2 with:
 * - Browser compression before presigning
 * - Configurable concurrency (default: 3)
 * - Real-time XHR upload progress events
 * - Safe memory disposal per item
 * - Cancellation and retry support
 * - Preserved ordering
 */
export async function executeBatchUpload(
  options: BatchUploadOptions
): Promise<BatchUploadOutput> {
  const {
    productId,
    items,
    getAuthToken,
    compressionConfig,
    concurrency = 3,
    signal,
    onProgress,
  } = options;

  const totalCount = items.length;
  if (totalCount === 0) {
    return { successful: [], failed: [], cancelled: [] };
  }

  // Initialize progress tracking map
  const itemStatuses: Record<string, ItemUploadStatus> = {};
  items.forEach((item) => {
    itemStatuses[item.id] = {
      id: item.id,
      fileName: item.file.name,
      status: "pending",
      uploadProgressPercent: 0,
      originalSize: item.file.size,
    };
  });

  let successCount = 0;
  let failedCount = 0;
  let cancelledCount = 0;
  let processedCount = 0;
  let totalOriginalBytes = 0;
  let totalCompressedBytes = 0;
  let currentFileName: string | null = null;
  let stage: UploadStage = "Preparing";

  function emitProgress() {
    if (!onProgress) return;

    // Calculate overall percent based on item statuses and in-flight upload progress
    let aggregateProgress = 0;
    items.forEach((item) => {
      const status = itemStatuses[item.id];
      if (status.status === "completed") {
        aggregateProgress += 100;
      } else if (status.status === "uploading") {
        // Compressing/url is 15%, upload is remaining 85%
        aggregateProgress += 15 + (status.uploadProgressPercent * 0.85);
      } else if (status.status === "compressing" || status.status === "requesting_url") {
        aggregateProgress += 10;
      } else if (status.status === "failed" || status.status === "cancelled") {
        aggregateProgress += 100;
      }
    });

    const overallPercent = Math.min(100, Math.round(aggregateProgress / totalCount));

    onProgress({
      stage,
      overallPercent,
      processedCount,
      totalCount,
      successCount,
      failedCount,
      cancelledCount,
      currentFileName,
      totalOriginalBytes,
      totalCompressedBytes,
      items: { ...itemStatuses },
    });
  }

  emitProgress();

  const successful: SuccessfulUploadResult[] = [];
  const failed: FailedUploadResult[] = [];
  const cancelled: BatchUploadItem[] = [];

  let nextIndex = 0;

  async function processItem(item: BatchUploadItem): Promise<void> {
    if (signal?.aborted) {
      itemStatuses[item.id].status = "cancelled";
      cancelledCount++;
      cancelled.push(item);
      emitProgress();
      return;
    }

    currentFileName = item.file.name;
    stage = "Compressing";
    itemStatuses[item.id].status = "compressing";
    emitProgress();

    try {
      // 1. Browser-side compression before presigned URL is requested
      const processed = await compressImageForUpload(item.file, compressionConfig);

      if (signal?.aborted) {
        itemStatuses[item.id].status = "cancelled";
        cancelledCount++;
        cancelled.push(item);
        emitProgress();
        return;
      }

      itemStatuses[item.id].wasCompressed = processed.wasCompressed;
      itemStatuses[item.id].compressedSize = processed.finalSize;
      itemStatuses[item.id].mimeType = processed.mimeType;
      itemStatuses[item.id].width = processed.width;
      itemStatuses[item.id].height = processed.height;
      totalOriginalBytes += processed.originalSize;
      totalCompressedBytes += processed.finalSize;

      // 2. Request presigned upload URL from authenticated server route
      itemStatuses[item.id].status = "requesting_url";
      emitProgress();

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (getAuthToken) {
        const token = await getAuthToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }

      const urlRes = await fetch("/api/admin/images/upload-url", {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId,
          fileName: processed.file.name,
          contentType: processed.mimeType,
          fileSize: processed.finalSize,
        }),
        signal,
      });

      if (!urlRes.ok) {
        const errJson = await urlRes.json().catch(() => ({}));
        throw new Error(
          errJson.error || `Server rejected upload request with status ${urlRes.status}.`
        );
      }

      const { presignedUrl, objectKey } = await urlRes.json();
      itemStatuses[item.id].storagePath = objectKey;

      if (signal?.aborted) {
        itemStatuses[item.id].status = "cancelled";
        cancelledCount++;
        cancelled.push(item);
        emitProgress();
        return;
      }

      // 3. Upload directly to R2 using XMLHttpRequest with real progress events
      stage = "Uploading";
      itemStatuses[item.id].status = "uploading";
      emitProgress();

      await uploadToR2WithProgress(
        presignedUrl,
        processed.file,
        processed.mimeType,
        (loaded, total) => {
          const pct = Math.round((loaded / total) * 100);
          itemStatuses[item.id].uploadProgressPercent = pct;
          emitProgress();
        },
        signal
      );

      // 4. Mark successful
      itemStatuses[item.id].status = "completed";
      itemStatuses[item.id].uploadProgressPercent = 100;
      successCount++;
      processedCount++;

      successful.push({
        id: item.id,
        storagePath: objectKey,
        displayOrder: item.displayOrder,
        isPrimary: item.isPrimary,
        altText: item.altText,
        color: item.color,
        mimeType: processed.mimeType,
        fileSizeBytes: processed.finalSize,
        originalSizeBytes: processed.originalSize,
        width: processed.width,
        height: processed.height,
      });

      emitProgress();
    } catch (err: unknown) {
      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        signal?.aborted
      ) {
        itemStatuses[item.id].status = "cancelled";
        cancelledCount++;
        cancelled.push(item);
      } else {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        itemStatuses[item.id].status = "failed";
        itemStatuses[item.id].error = msg;
        failedCount++;
        failed.push({
          id: item.id,
          fileName: item.file.name,
          error: msg,
          displayOrder: item.displayOrder,
        });
      }
      processedCount++;
      emitProgress();
    }
  }

  // Concurrency worker pool
  const workerCount = Math.min(concurrency, totalCount);
  const workers: Promise<void>[] = [];

  for (let w = 0; w < workerCount; w++) {
    workers.push(
      (async () => {
        while (nextIndex < totalCount) {
          if (signal?.aborted) break;
          const idx = nextIndex++;
          await processItem(items[idx]);
        }
      })()
    );
  }

  await Promise.all(workers);

  // If aborted during processing, mark any remaining unvisited items as cancelled
  while (nextIndex < totalCount) {
    const unvisited = items[nextIndex++];
    if (!itemStatuses[unvisited.id] || itemStatuses[unvisited.id].status === "pending") {
      itemStatuses[unvisited.id].status = "cancelled";
      cancelledCount++;
      cancelled.push(unvisited);
    }
  }

  stage = signal?.aborted
    ? "Cancelled"
    : failedCount > 0 && successCount === 0
    ? "Failed"
    : "Completed";

  currentFileName = null;
  emitProgress();

  // Sort successful results back into initial display order
  successful.sort((a, b) => a.displayOrder - b.displayOrder);

  return { successful, failed, cancelled };
}
