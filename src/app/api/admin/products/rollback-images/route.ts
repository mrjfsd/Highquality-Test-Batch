/**
 * Re-export the canonical image cleanup endpoint to maintain full backward compatibility
 * for callers of /api/admin/products/rollback-images.
 */
export { POST } from "@/app/api/admin/images/cleanup/route";
