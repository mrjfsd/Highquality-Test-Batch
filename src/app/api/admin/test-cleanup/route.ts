import type { NextRequest } from "next/server";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import {
  listR2ObjectsByPrefix,
  deleteR2Object,
  deleteR2Objects,
} from "@/lib/r2/operations";

/**
 * GET /api/admin/test-cleanup
 *
 * Lists R2 storage objects belonging to the test prefix (default: "test-uploads/").
 * Strictly restricted to administrators and enforces that the prefix must begin
 * with "test-uploads/" to prevent inspection of product images.
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const requestedPrefix = searchParams.get("prefix") || "test-uploads/";

  // Security guard: Only test prefixes are permitted
  if (!requestedPrefix.startsWith("test-uploads/") || requestedPrefix.includes("..")) {
    return Response.json(
      {
        error:
          "Invalid prefix filter. Only objects under the dedicated 'test-uploads/' prefix can be inspected.",
      },
      { status: 400 }
    );
  }

  try {
    const objects = await listR2ObjectsByPrefix(requestedPrefix, 100);
    return Response.json({
      success: true,
      prefix: requestedPrefix,
      count: objects.length,
      objects,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list test objects.";
    console.error("[test-cleanup] Error listing test objects:", message);
    return Response.json(
      { error: `Storage service error: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/test-cleanup
 *
 * Safely cleans up test-uploaded objects from Cloudflare R2.
 * Accepts either:
 * - { objectKey: "test-uploads/..." } to delete a single test object
 * - { prefix: "test-uploads/..." } to purge all objects under a specific test run or prefix
 *
 * Security:
 * - Administrator authentication required (cookie + Bearer token).
 * - Enforces that every targeted key/prefix strictly begins with "test-uploads/".
 * - Catalog images (products/...) are strictly forbidden and rejected.
 */
export async function DELETE(request: NextRequest) {
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

  let body: { objectKey?: string; prefix?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON payload. Provide 'objectKey' or 'prefix'." },
      { status: 400 }
    );
  }

  const { objectKey, prefix } = body;

  if (!objectKey && !prefix) {
    return Response.json(
      { error: "Either 'objectKey' or 'prefix' must be provided." },
      { status: 400 }
    );
  }

  // Case 1: Delete a single specific test object
  if (objectKey) {
    const key = objectKey.trim();
    if (!key.startsWith("test-uploads/") || key.includes("..")) {
      return Response.json(
        {
          error:
            "Invalid object key. Deletion is strictly restricted to assets under 'test-uploads/'.",
        },
        { status: 400 }
      );
    }

    try {
      await deleteR2Object(key);
      return Response.json({
        success: true,
        deletedKey: key,
        count: 1,
        message: `Test asset "${key}" deleted from Cloudflare R2.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete test asset.";
      console.error(`[test-cleanup] Error deleting single object ${key}:`, message);
      return Response.json(
        { error: `Storage service error: ${message}` },
        { status: 500 }
      );
    }
  }

  // Case 2: Clean up all test objects under a specific test run or prefix
  if (prefix) {
    const targetPrefix = prefix.trim();
    if (!targetPrefix.startsWith("test-uploads/") || targetPrefix.includes("..")) {
      return Response.json(
        {
          error:
            "Invalid prefix. Bulk test cleanup is strictly restricted to prefixes under 'test-uploads/'.",
        },
        { status: 400 }
      );
    }

    try {
      const items = await listR2ObjectsByPrefix(targetPrefix, 1000);
      const keysToDelete = items.map((i) => i.key);

      if (keysToDelete.length === 0) {
        return Response.json({
          success: true,
          deletedKeys: [],
          count: 0,
          message: `No test objects found matching prefix "${targetPrefix}".`,
        });
      }

      await deleteR2Objects(keysToDelete);

      return Response.json({
        success: true,
        prefix: targetPrefix,
        deletedKeys: keysToDelete,
        count: keysToDelete.length,
        message: `Successfully deleted ${keysToDelete.length} test object(s) from Cloudflare R2.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to clean up test prefix.";
      console.error(`[test-cleanup] Error purging prefix ${targetPrefix}:`, message);
      return Response.json(
        { error: `Storage service error: ${message}` },
        { status: 500 }
      );
    }
  }

  return Response.json({ error: "No action taken." }, { status: 400 });
}
