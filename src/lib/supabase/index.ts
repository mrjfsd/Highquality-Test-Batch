// Browser-safe exports (use in "use client" components)
export { createSupabaseClient, getSupabaseClient } from "./client";
export { verifyAdminAuthorization, type AdminVerificationResult } from "./auth";

// Server-only exports — never import these in "use client" files
export { createSupabaseServerClient, createSupabaseAdminClient } from "./server";
export { verifyAdminServer, type ServerAdminVerificationResult } from "./server-auth";
