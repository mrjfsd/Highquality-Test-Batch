import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Normalizes a product name or string into a URL-friendly slug:
 * - Converts to lowercase.
 * - Trims leading and trailing whitespace.
 * - Replaces non-alphanumeric characters with single hyphens.
 * - Strips leading and trailing hyphens.
 */
export function normalizeSlug(input: string): string {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * Given a base candidate slug and an array of existing slugs in the database,
 * selects the first available slug according to the specification:
 * - baseSlug
 * - baseSlug-2
 * - baseSlug-3
 * - etc.
 */
export function findNextAvailableSlug(
  baseSlug: string,
  existingSlugs: string[]
): string {
  const normalized = normalizeSlug(baseSlug);
  if (!normalized) return "";

  const existingSet = new Set(
    (existingSlugs || []).map((s) => s.trim().toLowerCase())
  );

  // If the base slug is not taken, use it
  if (!existingSet.has(normalized)) {
    return normalized;
  }

  // Otherwise, find the lowest unused numeric suffix starting at 2
  let counter = 2;
  while (existingSet.has(`${normalized}-${counter}`)) {
    counter++;
  }

  return `${normalized}-${counter}`;
}

/**
 * Authoritatively resolves the next available unique slug in Supabase.
 * Checks for exact match or suffix matches on the given candidate slug.
 */
export async function resolveUniqueSlug(
  candidate: string,
  supabaseClient: SupabaseClient
): Promise<string> {
  const cleanSlug = normalizeSlug(candidate);
  if (!cleanSlug) {
    throw new Error("Slug cannot be empty. Please provide a valid product name or slug.");
  }

  // Fetch all existing slugs matching the base or starting with base-
  const { data, error } = await supabaseClient
    .from("products")
    .select("slug")
    .or(`slug.eq.${cleanSlug},slug.like.${cleanSlug}-%`);

  if (error) {
    throw new Error(`Database error querying existing slugs: ${error.message}`);
  }

  const existingSlugs = (data || []).map((row: { slug: string }) => row.slug);
  return findNextAvailableSlug(cleanSlug, existingSlugs);
}
