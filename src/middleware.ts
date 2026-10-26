import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Middleware that refreshes the Supabase session cookie on admin and auth requests.
 *
 * @supabase/ssr requires this middleware to keep the session alive. Without it,
 * the access token expires and server-side auth checks return no session.
 *
 * This does NOT perform any redirect logic — the individual pages/routes
 * handle their own access control. The middleware only ensures the session
 * cookie is refreshed before protected pages and APIs execute.
 *
 * Public storefront routes (/, /shop/*, /product/*) and public APIs (/api/images/*,
 * /api/products/*) bypass this middleware, eliminating unnecessary Supabase
 * network round-trips.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Fast-path bypass for public storefront and API routes: only admin and auth paths require session refresh
  const pathname = request.nextUrl.pathname.toLowerCase();
  const requiresAuth =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth");

  if (!requiresAuth) {
    return supabaseResponse;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured yet, skip middleware to avoid breaking dev
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh the session — do not remove or move this call
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Restrict middleware execution exclusively to routes requiring Supabase
     * session-refresh and authentication:
     * - /admin and all nested admin routes
     * - /api/admin and all nested admin API endpoints
     * - /auth and /api/auth routes (authentication callbacks/session management)
     *
     * Public storefront routes (/, /shop/*, /product/*), public APIs (/api/images/*,
     * /api/products/*), and static assets completely bypass middleware execution,
     * eliminating unnecessary Supabase getUser() network round-trips.
     */
    "/admin/:path*",
    "/api/admin/:path*",
    "/auth/:path*",
    "/api/auth/:path*",
  ],
};
