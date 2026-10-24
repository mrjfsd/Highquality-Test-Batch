import type { NextRequest } from "next/server";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deleteR2Objects } from "@/lib/r2/operations";

const MAX_KEYS_PER_REQUEST = 500;
const ALLOWED_PREFIXES = ["products/", "test-uploads/"];

/**
 * Validates whether a storage key is safe and follows permitted naming conventions:
 * - Must be a non-empty string.
 * - Must not contain path traversal characters ("..").
 * - Must begin with an authorized prefix ("products/" or "test-uploads/").
 */
function isSafeStorageKey(key: unknown): key is string {
  if (typeof key !== "string" || key.trim() === "") return false;
  const clean = key.trim();
  if (clean.includes("..")) return false;
  return ALLOWED_PREFIXES.some((prefix) => clean.startsWith(prefix));
}

/**
 * POST /api/admin/images/cleanup
 *
 * Authoritative, safe cleanup endpoint for rolling back uncommitted image assets from Cloudflare R2
 * when product creation fails or is cancelled in flight.
 *
 * Security & Integrity Protections:
 * 1. Strict server-side administrator authorization (Bearer token or cookie).
 * 2. Key validation: Rejects malformed keys, path traversal, and unauthorized prefixes.
 * 3. Committed Product Protection: Queries public.product_images to ensure NO image currently
 *    associated with an existing product in the database can be deleted through this endpoint.
 * 4. Safe batch deletion: Uses AWS S3 / R2 DeleteObjectsCommand in batches of up to 1000.
 * 5. Honest status reporting: Returns exactly which keys were deleted, which were skipped
 *    because they are active in the database, and any rejected invalid keys.
 */
export async function POST(request: NextRequest) {
  // 1. Verify admin authorization
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

  // 2. Parse and validate JSON payload
  let body: { keys?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const { keys } = body;
  if (!Array.isArray(keys) || keys.length === 0) {
    return Response.json(
      { error: "keys must be a non-empty array of storage paths." },
      { status: 400 }
    );
  }

  if (keys.length > MAX_KEYS_PER_REQUEST) {
    return Response.json(
      { error: `Maximum of ${MAX_KEYS_PER_REQUEST} keys can be cleaned up per request.` },
      { status: 400 }
    );
  }

  // 3. Separate valid candidate keys from invalid/malformed keys
  const validKeys: string[] = [];
  const invalidKeys: string[] = [];

  for (const rawKey of keys) {
    if (isSafeStorageKey(rawKey)) {
      validKeys.push(rawKey.trim());
    } else if (typeof rawKey === "string") {
      invalidKeys.push(rawKey);
    } else {
      invalidKeys.push(String(rawKey));
    }
  }

  if (validKeys.length === 0) {
    return Response.json(
      {
        error: "None of the provided keys are valid storage paths for cleanup.",
        invalidKeys,
      },
      { status: 400 }
    );
  }

  // 4. Committed Image Protection: Query Supabase to find any keys already saved in product_images
  const adminClient = createSupabaseAdminClient();
  const { data: committedRows, error: dbError } = await adminClient
    .from("product_images")
    .select("storage_path")
    .in("storage_path", validKeys);

  if (dbError) {
    console.error("[images-cleanup] Database error verifying committed images:", dbError.message);
    return Response.json(
      { error: `Database error verifying image safety: ${dbError.message}` },
      { status: 500 }
    );
  }

  const committedSet = new Set(
    (committedRows || [])
      .map((r) => r.storage_path)
      .filter((p): p is string => Boolean(p))
  );

  const safeKeysToDelete = validKeys.filter((k) => !committedSet.has(k));
  const skippedCommittedKeys = validKeys.filter((k) => committedSet.has(k));

  // 5. Perform R2 deletion for uncommitted keys only
  let deletionError: string | null = null;
  if (safeKeysToDelete.length > 0) {
    try {
      await deleteR2Objects(safeKeysToDelete);
    } catch (err: unknown) {
      deletionError = err instanceof Error ? err.message : "Failed to delete objects from R2 storage.";
      console.error("[images-cleanup] R2 deletion error:", deletionError);
      return Response.json(
        {
          error: "Failed to delete objects from storage service.",
          details: deletionError,
        },
        { status: 500 }
      );
    }
  }

  return Response.json({
    success: true,
    requestedCount: keys.length,
    deletedCount: safeKeysToDelete.length,
    deletedKeys: safeKeysToDelete,
    skippedCommittedKeys,
    invalidKeys,
  });
}
