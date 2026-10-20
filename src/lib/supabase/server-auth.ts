import { createSupabaseServerClient, createSupabaseAdminClient } from "./server";
import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export interface ServerAdminVerificationResult {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: User | null;
  reason?: string;
}

/**
 * Server-side admin authorization check for use in Route Handlers and
 * Server Actions. Uses the SSR Supabase client (reading forwarded session cookies)
 * with fallback to the Authorization: Bearer <jwt> header if provided.
 *
 * This is the authoritative check — do not rely on client-side checks
 * as the only guard for admin operations.
 */
export async function verifyAdminServer(
  request?: NextRequest
): Promise<ServerAdminVerificationResult> {
  let client: Awaited<ReturnType<typeof createSupabaseServerClient>>;

  try {
    client = await createSupabaseServerClient();
  } catch {
    return {
      isAuthenticated: false,
      isAdmin: false,
      user: null,
      reason: "Supabase server client could not be initialized.",
    };
  }

  let user: User | null = null;

  // 1. Try Bearer token from Authorization header if present
  const authHeader = request?.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const { data: tokenData, error: tokenError } = await client.auth.getUser(token);
      if (!tokenError && tokenData?.user) {
        user = tokenData.user;
      }
    }
  }

  // 2. Fall back to cookie-based session if no token header or if token was invalid
  if (!user) {
    const { data: cookieData, error: cookieError } = await client.auth.getUser();
    if (!cookieError && cookieData?.user) {
      user = cookieData.user;
    }
  }

  if (!user) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      user: null,
      reason: "No active authenticated session.",
    };
  }

  // Check 1: Trusted app_metadata.role claim (set server-side by Supabase dashboard
  // or admin tools — cannot be spoofed by the client).
  if (user.app_metadata?.role === "admin") {
    return { isAuthenticated: true, isAdmin: true, user };
  }

  // Check 2: Explicit row in public.app_admins table
  try {
    const adminLookupClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseAdminClient()
      : client;

    const { data: adminRecord, error: queryError } = await adminLookupClient
      .from("app_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!queryError && adminRecord?.user_id) {
      return { isAuthenticated: true, isAdmin: true, user };
    }
  } catch {
    // Fail safe — do not grant admin on unexpected error
  }

  return {
    isAuthenticated: true,
    isAdmin: false,
    user,
    reason:
      "Account is authenticated but is not registered in the app_admins roster.",
  };
}
