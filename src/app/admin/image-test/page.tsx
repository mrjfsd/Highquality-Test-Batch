"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  verifyAdminAuthorization,
  type AdminVerificationResult,
} from "@/lib/supabase/auth";
import {
  compressImageForUpload,
  uploadToR2WithProgress,
} from "@/lib/images/client-compression";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_INPUT_FILE_SIZE_BYTES = 35 * 1024 * 1024; // 35 MB (compressed to ~1-2 MB before upload)

interface TestR2Object {
  key: string;
  size?: number;
  lastModified?: string;
}

export default function ImageUploadTestPage() {
  const [authStatus, setAuthStatus] = useState<AdminVerificationResult>({
    isAuthenticated: false,
    isAdmin: false,
    user: null,
  });
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Upload POC State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [compressionStats, setCompressionStats] = useState<{
    wasCompressed: boolean;
    originalSize: number;
    compressedSize: number;
  } | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [uploadedStoragePath, setUploadedStoragePath] = useState<string | null>(null);
  const [uploadedProxyUrl, setUploadedProxyUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAuthPolicyError, setIsAuthPolicyError] = useState<boolean>(false);

  // Cleanup & Test Roster State
  const [isDeletingCurrent, setIsDeletingCurrent] = useState<boolean>(false);
  const [cleanupFeedback, setCleanupFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testObjects, setTestObjects] = useState<TestR2Object[]>([]);
  const [isLoadingObjects, setIsLoadingObjects] = useState<boolean>(false);
  const [hasLoadedObjects, setHasLoadedObjects] = useState<boolean>(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [isPurgingAll, setIsPurgingAll] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Verify administrator authorization on mount
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const result = await verifyAdminAuthorization();
        if (isMounted) {
          setAuthStatus(result);
        }
      } finally {
        if (isMounted) {
          setCheckingAuth(false);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Clean up object URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const client = getSupabaseClient();
    const { data: sessionData } = await client.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return headers;
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const client = getSupabaseClient();
      await client.auth.signOut();
      setAuthStatus({
        isAuthenticated: false,
        isAdmin: false,
        user: null,
      });
    } finally {
      setIsLoggingOut(false);
    }
  }

  // 2. Validate file on selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValidationError(null);
    setUploadError(null);
    setIsAuthPolicyError(false);
    setUploadSuccess(false);
    setUploadedStoragePath(null);
    setUploadedProxyUrl(null);
    setCleanupFeedback(null);

    const files = e.target.files;
    if (!files || files.length === 0) {
      setSelectedFile(null);
      setLocalPreviewUrl(null);
      return;
    }

    const file = files[0];

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setValidationError(
        `Invalid file type (${file.type || "unknown"}). Only JPEG, PNG, WebP, and AVIF images are permitted.`
      );
      setSelectedFile(null);
      setLocalPreviewUrl(null);
      return;
    }

    // Validate size (max 35 MB raw file before compression)
    if (file.size > MAX_INPUT_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setValidationError(
        `File size exceeds 35 MB limit. Selected file is ${sizeMb} MB.`
      );
      setSelectedFile(null);
      setLocalPreviewUrl(null);
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objectUrl);
  }

  // 3. Perform upload via presigned R2 URL
  async function handleUpload() {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);
    setIsAuthPolicyError(false);
    setUploadSuccess(false);
    setCleanupFeedback(null);
    setCompressionStats(null);
    setUploadPercent(0);

    try {
      setUploadStage("Compressing in browser (target 1–2 MB)...");
      const processed = await compressImageForUpload(selectedFile);

      setCompressionStats({
        wasCompressed: processed.wasCompressed,
        originalSize: processed.originalSize,
        compressedSize: processed.finalSize,
      });

      setUploadStage("Requesting presigned upload URL...");
      const headers = await getAuthHeaders();

      // Step A: Request a presigned upload URL from the server
      const urlResponse = await fetch("/api/admin/images/upload-url", {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId: "test-uploads",
          fileName: processed.file.name,
          contentType: processed.mimeType,
          fileSize: processed.finalSize,
        }),
      });

      if (!urlResponse.ok) {
        const errData = await urlResponse.json().catch(() => ({}));
        const isPermission = urlResponse.status === 401 || urlResponse.status === 403;
        setIsAuthPolicyError(isPermission);
        setUploadError(
          errData.error ||
            `Server returned ${urlResponse.status}: failed to generate upload URL.`
        );
        return;
      }

      const { presignedUrl, objectKey } = await urlResponse.json();

      // Step B: Upload directly to R2 using XMLHttpRequest with real progress events
      setUploadStage("Uploading to Cloudflare R2...");
      await uploadToR2WithProgress(
        presignedUrl,
        processed.file,
        processed.mimeType,
        (loaded, total) => {
          const pct = Math.round((loaded / total) * 100);
          setUploadPercent(pct);
        }
      );

      // Step C: Construct proxy URL for display
      const proxyUrl = `/api/images/${objectKey}`;

      setUploadedStoragePath(objectKey);
      setUploadedProxyUrl(proxyUrl);
      setUploadSuccess(true);
      setUploadStage(null);

      // If test list was already opened, refresh it
      if (hasLoadedObjects) {
        loadTestObjects();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unexpected upload error occurred.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
      setUploadStage(null);
    }
  }

  // 4. Delete the currently uploaded test image from R2 with confirmation
  async function handleDeleteCurrentTestImage() {
    if (!uploadedStoragePath) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete this test image from Cloudflare R2?\n\nStorage Path: ${uploadedStoragePath}\n\nThis will permanently remove the object from the private bucket.`
    );
    if (!confirmed) return;

    setIsDeletingCurrent(true);
    setCleanupFeedback(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/test-cleanup", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ objectKey: uploadedStoragePath }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Server returned status ${res.status}`);
      }

      const deletedPath = uploadedStoragePath;
      handleReset();
      setCleanupFeedback({
        type: "success",
        message: `Successfully deleted test image "${deletedPath}" from Cloudflare R2.`,
      });

      if (hasLoadedObjects) {
        loadTestObjects();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete test image.";
      setCleanupFeedback({ type: "error", message });
    } finally {
      setIsDeletingCurrent(false);
    }
  }

  // 5. Load all test objects under test-uploads/ prefix
  async function loadTestObjects() {
    setIsLoadingObjects(true);
    setCleanupFeedback(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/test-cleanup?prefix=test-uploads/", {
        headers,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Server returned status ${res.status}`);
      }

      setTestObjects(data.objects || []);
      setHasLoadedObjects(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load test objects.";
      setCleanupFeedback({ type: "error", message });
    } finally {
      setIsLoadingObjects(false);
    }
  }

  // 6. Delete a specific test object from the roster
  async function handleDeleteTestObject(key: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete this test object from Cloudflare R2?\n\nKey: ${key}\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingKey(key);
    setCleanupFeedback(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/test-cleanup", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ objectKey: key }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Server returned status ${res.status}`);
      }

      setTestObjects((prev) => prev.filter((item) => item.key !== key));
      setCleanupFeedback({
        type: "success",
        message: `Successfully deleted "${key}" from Cloudflare R2.`,
      });

      if (uploadedStoragePath === key) {
        handleReset();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete test object.";
      setCleanupFeedback({ type: "error", message });
    } finally {
      setDeletingKey(null);
    }
  }

  // 7. Bulk purge all test objects under test-uploads/ prefix
  async function handlePurgeAllTestObjects() {
    if (testObjects.length === 0) return;

    const confirmed = window.confirm(
      `⚠️ WARNING: Are you sure you want to permanently delete ALL ${testObjects.length} test object(s) under the "test-uploads/" prefix from Cloudflare R2?\n\nThis will NOT affect any product catalog images ("products/").\n\nClick OK to confirm deletion.`
    );
    if (!confirmed) return;

    setIsPurgingAll(true);
    setCleanupFeedback(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/test-cleanup", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ prefix: "test-uploads/" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Server returned status ${res.status}`);
      }

      setTestObjects([]);
      setCleanupFeedback({
        type: "success",
        message: data.message || `Successfully purged all test objects from Cloudflare R2.`,
      });

      if (uploadedStoragePath) {
        handleReset();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to purge test objects.";
      setCleanupFeedback({ type: "error", message });
    } finally {
      setIsPurgingAll(false);
    }
  }

  function handleReset() {
    setSelectedFile(null);
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    setValidationError(null);
    setUploadError(null);
    setIsAuthPolicyError(false);
    setUploadSuccess(false);
    setUploadedStoragePath(null);
    setUploadedProxyUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-xs font-mono">
          POC Route: /admin/image-test
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Cloudflare R2 Image Upload &amp; Test Cleanup
        </h1>
        <p className="text-sm text-neutral-600">
          Upload single image files to the private Cloudflare R2 bucket via the
          server-side presigned upload API, inspect generated proxy URLs, and safely clean up test assets.
        </p>
      </div>

      {/* Global Feedback Banner */}
      {cleanupFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            cleanupFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                cleanupFeedback.type === "success" ? "bg-emerald-600" : "bg-rose-600"
              }`}
            />
            <span className="font-medium">{cleanupFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setCleanupFeedback(null)}
            className="text-neutral-500 hover:text-neutral-800 font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Auth Status Banner */}
      {checkingAuth ? (
        <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50 text-xs text-neutral-500 font-mono">
          Verifying administrator credentials...
        </div>
      ) : authStatus.isAdmin ? (
        <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
            <span className="text-emerald-900 font-medium">
              Authorized Admin ({authStatus.user?.email || authStatus.user?.id})
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="text-neutral-600 hover:text-neutral-900 underline text-left sm:text-right shrink-0"
          >
            {isLoggingOut ? "Signing Out..." : "Sign Out"}
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-600" />
            Administrator Authorization Required
          </div>
          <p className="text-amber-800 leading-relaxed">
            {authStatus.isAuthenticated
              ? "You are authenticated, but your account is not authorized in public.app_admins."
              : "You must be signed in with an authorized administrator account to upload or delete storage objects."}
          </p>
          <div className="pt-1">
            <Link
              href="/admin/login"
              className="inline-block px-3 py-1.5 bg-neutral-900 text-white rounded text-xs font-medium hover:bg-neutral-800"
            >
              Sign In to Admin →
            </Link>
          </div>
        </div>
      )}

      {/* Main Upload Box */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs space-y-6">
        <h2 className="text-base font-semibold text-neutral-800 border-b border-neutral-100 pb-3">
          1. Upload Test Image
        </h2>

        {/* File Picker */}
        <div className="space-y-2">
          <label
            htmlFor="image-file-input"
            className="block text-xs font-semibold uppercase tracking-wider text-neutral-600"
          >
            Select Single Image
          </label>
          <input
            id="image-file-input"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={handleFileChange}
            disabled={!authStatus.isAdmin || isUploading}
            className="block w-full text-xs text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-800 hover:file:bg-neutral-200 file:cursor-pointer cursor-pointer border border-neutral-300 rounded-lg p-1 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-[11px] text-neutral-500">
            Allowed formats: JPEG, PNG, WebP, AVIF. Max file size: 5 MB. Target prefix: <code className="font-mono text-neutral-700">test-uploads/</code>
          </p>
        </div>

        {/* Validation Error Message */}
        {validationError && (
          <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-center justify-between">
            <span>{validationError}</span>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="text-rose-600 hover:text-rose-900 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Local Preview & Action */}
        {selectedFile && localPreviewUrl && !uploadSuccess && (
          <div className="space-y-4 border border-neutral-200 rounded-lg p-4 bg-neutral-50/50">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-700">Selected File Preview</span>
              <span className="text-neutral-500 font-mono">
                {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>

            <div className="w-full h-56 bg-neutral-100 rounded-lg overflow-hidden flex items-center justify-center border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={localPreviewUrl}
                alt="Selected preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="space-y-2 bg-neutral-900 text-white p-3 rounded-lg border border-neutral-800">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-emerald-400 font-semibold">{uploadStage || "Processing..."}</span>
                  <span className="text-white font-bold">{uploadPercent}%</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-200"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading || !authStatus.isAdmin}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? (
                  <>
                    <svg
                      className="animate-spin h-3.5 w-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    {uploadStage || "Uploading to Cloudflare R2..."}
                  </>
                ) : (
                  "Upload to Cloudflare R2"
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={isUploading}
                className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Upload Failure Message */}
        {uploadError && (
          <div className="p-4 rounded-lg border border-rose-200 bg-rose-50 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-rose-800 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              Upload Failed
            </div>
            <p className="text-rose-700 font-mono break-words">{uploadError}</p>
            {isAuthPolicyError && (
              <p className="text-rose-900 bg-rose-100/70 p-2.5 rounded border border-rose-200 leading-relaxed">
                <strong>Access Denied:</strong> An authorized administrator session is required.
                Ensure you are logged in with an account registered in the <code className="font-mono text-[11px]">app_admins</code> table.
              </p>
            )}
          </div>
        )}

        {/* Upload Success State with Restored Clean Up Button */}
        {uploadSuccess && uploadedProxyUrl && uploadedStoragePath && (
          <div className="p-5 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              Image Successfully Uploaded
            </div>

            {compressionStats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white p-3 rounded border border-emerald-200 text-[11px]">
                <div>
                  <span className="text-neutral-500 block">Original Size:</span>
                  <span className="font-semibold text-neutral-800">
                    {(compressionStats.originalSize / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Uploaded Size:</span>
                  <span className="font-semibold text-emerald-700">
                    {(compressionStats.compressedSize / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Compression:</span>
                  <span className="font-semibold text-emerald-700">
                    {compressionStats.wasCompressed
                      ? `${(((compressionStats.originalSize - compressionStats.compressedSize) / compressionStats.originalSize) * 100).toFixed(1)}% reduced`
                      : "Kept original (already optimal)"}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-neutral-700">
              <p>
                <strong className="text-neutral-900">Storage Path:</strong>{" "}
                <code className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-900">
                  {uploadedStoragePath}
                </code>
              </p>
              <p className="break-all">
                <strong className="text-neutral-900">Proxy URL (via /api/images/):</strong>{" "}
                <a
                  href={uploadedProxyUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-mono"
                >
                  {uploadedProxyUrl}
                </a>
              </p>
            </div>

            {/* Uploaded Image Preview */}
            <div className="space-y-2">
              <span className="font-semibold text-neutral-800">Delivered Image Preview:</span>
              <div className="w-full h-64 bg-white rounded-lg overflow-hidden flex items-center justify-center border border-emerald-200 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedProxyUrl!}
                  alt="Uploaded test preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>

            {/* Restored Action Controls */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                Upload Another Image
              </button>

              <button
                type="button"
                onClick={handleDeleteCurrentTestImage}
                disabled={isDeletingCurrent}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-rose-300 bg-white text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-50 disabled:opacity-50 transition-colors"
              >
                {isDeletingCurrent ? (
                  "Deleting from R2..."
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clean Up / Delete Test Image from R2
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Test Run & Prefix Cleanup Panel */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">
              2. Test Prefix Asset Roster &amp; Cleanup (<code className="font-mono text-xs">test-uploads/</code>)
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Inspect and clean up uploaded test assets from Cloudflare R2. Strictly scoped to the test prefix.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadTestObjects}
              disabled={isLoadingObjects || !authStatus.isAdmin}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-medium hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              {isLoadingObjects ? "Loading..." : "Inspect Test Storage"}
            </button>

            {testObjects.length > 0 && (
              <button
                type="button"
                onClick={handlePurgeAllTestObjects}
                disabled={isPurgingAll || !authStatus.isAdmin}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-rose-300 bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-100 disabled:opacity-50 transition-colors"
              >
                {isPurgingAll ? "Purging..." : `Purge All (${testObjects.length})`}
              </button>
            )}
          </div>
        </div>

        {hasLoadedObjects && (
          <div className="space-y-3">
            {testObjects.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500 border border-dashed border-neutral-200 rounded-lg bg-neutral-50/50">
                No test objects currently exist in Cloudflare R2 under <code className="font-mono">test-uploads/</code>.
              </div>
            ) : (
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100">
                  {testObjects.map((item) => (
                    <div
                      key={item.key}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-neutral-50/80 text-xs transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-mono text-[11px] text-neutral-800 truncate" title={item.key}>
                          {item.key}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                          <span>
                            Size: {item.size ? `${(item.size / 1024).toFixed(1)} KB` : "Unknown"}
                          </span>
                          {item.lastModified && (
                            <span>
                              Modified: {new Date(item.lastModified).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                        <a
                          href={`/api/images/${item.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-[11px]"
                        >
                          View ↗
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteTestObject(item.key)}
                          disabled={deletingKey === item.key}
                          className="px-2.5 py-1 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded text-[11px] font-medium disabled:opacity-50 transition-colors"
                        >
                          {deletingKey === item.key ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] text-neutral-500 bg-neutral-50 p-3 rounded-lg border border-neutral-200 leading-relaxed">
          <strong className="text-neutral-700">Storage Protection Guarantee:</strong> The test cleanup endpoint strictly permits deletion only for keys matching the <code className="font-mono text-neutral-800">test-uploads/</code> prefix. Product catalog images stored under <code className="font-mono text-neutral-800">products/</code> cannot be deleted via test cleanup.
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between text-xs pt-2">
        <Link
          href="/admin"
          className="text-blue-600 hover:text-blue-800 underline font-medium"
        >
          ← Return to Admin Portal
        </Link>
        <Link
          href="/admin/login"
          className="text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          Admin Login →
        </Link>
      </div>
    </div>
  );
}
