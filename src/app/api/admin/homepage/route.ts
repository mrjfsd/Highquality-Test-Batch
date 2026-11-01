import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import {
  getHeroCardsConfig,
  replaceHeroCardSlot,
  removeHeroCardSlot,
  getHomepageFavouritesConfig,
  replaceHomepageFavouriteSlot,
  removeHomepageFavouriteSlot,
  getHomepageFormPerspectiveConfig,
  replaceHomepageFormPerspectiveSlot,
  removeHomepageFormPerspectiveSlot,
} from "@/lib/settings/site-settings";

function triggerRevalidations() {
  try {
    revalidateTag("site-settings", "max");
    revalidateTag("hero-cards", "max");
    revalidateTag("homepage", "max");
    revalidateTag("homepage-favourites", "max");
    revalidateTag("homepage-form-perspective", "max");
    revalidatePath("/", "page");
    revalidatePath("/api/settings");
  } catch (err) {
    console.warn("[api/admin/homepage] Revalidation notice:", err);
  }
}

/**
 * GET /api/admin/homepage
 * Retrieves all homepage image configurations (Hero Cards, Current Favourites, Form & Perspective).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminServer(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      {
        error: auth.isAuthenticated
          ? "Forbidden: Administrator privileges required."
          : "Unauthorized: No active administrator session.",
      },
      { status: auth.isAuthenticated ? 403 : 401 }
    );
  }

  try {
    const [heroCards, favourites, formPerspective] = await Promise.all([
      getHeroCardsConfig(),
      getHomepageFavouritesConfig(),
      getHomepageFormPerspectiveConfig(),
    ]);

    return NextResponse.json({
      heroCards,
      favourites,
      formPerspective,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error reading homepage images";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/homepage
 * Replaces or restores an image in any of the 3 homepage sections:
 * - section: "hero" (0-6)
 * - section: "favourites" (0-3)
 * - section: "form-perspective" (0-3)
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminServer(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      {
        error: auth.isAuthenticated
          ? "Forbidden: Administrator privileges required."
          : "Unauthorized: No active administrator session.",
      },
      { status: auth.isAuthenticated ? 403 : 401 }
    );
  }

  let body: {
    section?: "hero" | "favourites" | "form-perspective";
    slotIndex?: number;
    action?: "restore-default";
    image?: string;
    storagePath?: string | null;
    title?: string;
    category?: string;
    alt?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const { section, slotIndex, action, image, storagePath, title, category, alt } = body;

  if (!section || !["hero", "favourites", "form-perspective"].includes(section)) {
    return NextResponse.json(
      { error: "Invalid or missing section. Must be 'hero', 'favourites', or 'form-perspective'." },
      { status: 400 }
    );
  }

  if (typeof slotIndex !== "number") {
    return NextResponse.json({ error: "slotIndex is required." }, { status: 400 });
  }

  try {
    if (section === "hero") {
      if (slotIndex < 0 || slotIndex >= 7) {
        return NextResponse.json({ error: "Hero slotIndex must be 0 to 6." }, { status: 400 });
      }

      if (action === "restore-default") {
        const updated = await removeHeroCardSlot(slotIndex);
        triggerRevalidations();
        return NextResponse.json({
          success: true,
          section: "hero",
          heroCards: updated,
          message: `Hero Card #${slotIndex + 1} restored to default.`,
        });
      }

      if (!image || typeof image !== "string" || image.trim() === "") {
        return NextResponse.json({ error: "Image URL is required for replacement." }, { status: 400 });
      }

      const updated = await replaceHeroCardSlot(slotIndex, {
        image,
        storagePath,
        title,
        category,
        alt,
      });
      triggerRevalidations();
      return NextResponse.json({
        success: true,
        section: "hero",
        heroCards: updated,
        message: `Hero Card #${slotIndex + 1} updated successfully.`,
      });
    }

    if (section === "favourites") {
      if (slotIndex < 0 || slotIndex >= 4) {
        return NextResponse.json({ error: "Favourites slotIndex must be 0 to 3." }, { status: 400 });
      }

      if (action === "restore-default") {
        const updated = await removeHomepageFavouriteSlot(slotIndex);
        triggerRevalidations();
        return NextResponse.json({
          success: true,
          section: "favourites",
          favourites: updated,
          message: `Favourite Card #${slotIndex + 1} restored to default.`,
        });
      }

      if (!image || typeof image !== "string" || image.trim() === "") {
        return NextResponse.json({ error: "Image URL is required for replacement." }, { status: 400 });
      }

      const updated = await replaceHomepageFavouriteSlot(slotIndex, {
        image,
        storagePath,
      });
      triggerRevalidations();
      return NextResponse.json({
        success: true,
        section: "favourites",
        favourites: updated,
        message: `Favourite Card #${slotIndex + 1} updated successfully.`,
      });
    }

    if (section === "form-perspective") {
      if (slotIndex < 0 || slotIndex >= 4) {
        return NextResponse.json({ error: "Form & Perspective slotIndex must be 0 to 3." }, { status: 400 });
      }

      if (action === "restore-default") {
        const updated = await removeHomepageFormPerspectiveSlot(slotIndex);
        triggerRevalidations();
        return NextResponse.json({
          success: true,
          section: "form-perspective",
          formPerspective: updated,
          message: `Form & Perspective slot #${slotIndex + 1} restored to default.`,
        });
      }

      if (!image || typeof image !== "string" || image.trim() === "") {
        return NextResponse.json({ error: "Image URL is required for replacement." }, { status: 400 });
      }

      const updated = await replaceHomepageFormPerspectiveSlot(slotIndex, {
        image,
        storagePath,
      });
      triggerRevalidations();
      return NextResponse.json({
        success: true,
        section: "form-perspective",
        formPerspective: updated,
        message: `Form & Perspective slot #${slotIndex + 1} updated successfully.`,
      });
    }

    return NextResponse.json({ error: "Unhandled section request." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error saving homepage image";
    console.error("[api/admin/homepage] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/homepage?section=...&slotIndex=...
 * Restores the default image for a given section and slot.
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminServer(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      {
        error: auth.isAuthenticated
          ? "Forbidden: Administrator privileges required."
          : "Unauthorized: No active administrator session.",
      },
      { status: auth.isAuthenticated ? 403 : 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") as "hero" | "favourites" | "form-perspective" | null;
  const slotIndexParam = searchParams.get("slotIndex");

  if (!section || !["hero", "favourites", "form-perspective"].includes(section)) {
    return NextResponse.json(
      { error: "Invalid section. Must be 'hero', 'favourites', or 'form-perspective'." },
      { status: 400 }
    );
  }

  const slotIndex = slotIndexParam !== null ? parseInt(slotIndexParam, 10) : -1;
  if (isNaN(slotIndex) || slotIndex < 0) {
    return NextResponse.json({ error: "Valid slotIndex is required." }, { status: 400 });
  }

  try {
    if (section === "hero") {
      if (slotIndex >= 7) return NextResponse.json({ error: "Invalid hero slotIndex." }, { status: 400 });
      const updated = await removeHeroCardSlot(slotIndex);
      triggerRevalidations();
      return NextResponse.json({ success: true, section: "hero", heroCards: updated });
    }

    if (section === "favourites") {
      if (slotIndex >= 4) return NextResponse.json({ error: "Invalid favourites slotIndex." }, { status: 400 });
      const updated = await removeHomepageFavouriteSlot(slotIndex);
      triggerRevalidations();
      return NextResponse.json({ success: true, section: "favourites", favourites: updated });
    }

    if (section === "form-perspective") {
      if (slotIndex >= 4) return NextResponse.json({ error: "Invalid form-perspective slotIndex." }, { status: 400 });
      const updated = await removeHomepageFormPerspectiveSlot(slotIndex);
      triggerRevalidations();
      return NextResponse.json({ success: true, section: "form-perspective", formPerspective: updated });
    }

    return NextResponse.json({ error: "Unhandled section." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error removing image override";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
