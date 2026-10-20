import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client scoped to the current server request context.
 * Uses @supabase/ssr to forward the session cookie so that the user's JWT
 * is sent to Supabase on every request — satisfying RLS policies properly.
 *
 * Use this in Server Components, Route Handlers, and Server Actions.
 * Never call this in "use client" files.
 */
export async function createSupabaseServerClient(): Promise<
  ReturnType<typeof createServerClient>
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Check your .env.local file."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll is called from Server Components where cookies cannot be
          // mutated. This is safe to ignore — the middleware refreshes the
          // session before the Server Component renders.
        }
      },
    },
  });
}

/**
 * Creates a Supabase admin client using the service-role key.
 * This client bypasses Row Level Security and must ONLY be called
 * from server-side code (Route Handlers, Server Actions).
 *
 * Never import this in any "use client" file.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "This client is server-only and must not be called from the browser."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
