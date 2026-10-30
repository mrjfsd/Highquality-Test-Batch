import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import {
  getHeroCardsConfig,
  saveHeroCardsConfig,
  replaceHeroCardSlot,
  removeHeroCardSlot,
  HeroCardConfigItem,
  DEFAULT_HERO_CARDS,
} from "@/lib/settings/site-settings";

const MAX_HERO_CARDS = 7;

/**
 * GET /api/admin/hero-cards
 * Admin route to retrieve current hero cards configuration (always returns all 7 slots).
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
    const heroCards = await getHeroCardsConfig();
    return NextResponse.json({ heroCards });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error reading hero cards";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/hero-cards
 * Admin route to replace or remove a custom image on a specific hero card slot,
 * or update the full 7-slot configuration.
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
    slotIndex?: number;
    action?: "restore-default" | "reset-defaults";
    image?: string;
    storagePath?: string | null;
    title?: string;
    category?: string;
    alt?: string;
    cards?: HeroCardConfigItem[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  try {
    // 1. Slot-level Replace or Remove action
    if (typeof body.slotIndex === "number") {
      const slotIndex = body.slotIndex;
      if (slotIndex < 0 || slotIndex >= MAX_HERO_CARDS) {
        return NextResponse.json(
          { error: `slotIndex must be between 0 and ${MAX_HERO_CARDS - 1}.` },
          { status: 400 }
        );
      }

      if (body.action === "restore-default") {
        const updatedCards = await removeHeroCardSlot(slotIndex);
        triggerRevalidations();
        return NextResponse.json({
          success: true,
          heroCards: updatedCards,
          message: `Slot #${slotIndex + 1} restored to default image.`,
        });
      }

      // Slot replacement
      if (!body.image || typeof body.image !== "string" || body.image.trim() === "") {
        return NextResponse.json(
          { error: "Image URL is required for card replacement." },
          { status: 400 }
        );
      }

      const updatedCards = await replaceHeroCardSlot(slotIndex, {
        image: body.image,
        storagePath: body.storagePath,
        title: body.title,
        category: body.category,
        alt: body.alt,
      });

      triggerRevalidations();
      return NextResponse.json({
        success: true,
        heroCards: updatedCards,
        message: `Slot #${slotIndex + 1} replaced successfully.`,
      });
    }

    // 2. Full cards array update
    if (body.cards) {
      if (!Array.isArray(body.cards)) {
        return NextResponse.json(
          { error: "cards must be an array." },
          { status: 400 }
        );
      }

      const savedCards = await saveHeroCardsConfig(body.cards);
      triggerRevalidations();

      return NextResponse.json({
        success: true,
        heroCards: savedCards,
      });
    }

    // 3. Reset all to defaults
    if (body.action === "reset-defaults") {
      const resetCards = await saveHeroCardsConfig([...DEFAULT_HERO_CARDS]);
      triggerRevalidations();
      return NextResponse.json({ success: true, heroCards: resetCards });
    }

    return NextResponse.json(
      { error: "Must provide slotIndex or cards in request body." },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error updating hero cards";
    console.error("[api/admin/hero-cards] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/hero-cards?slotIndex=... (or ?id=...)
 * Removes the custom override on a specific card slot, automatically restoring its default image.
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
  const slotIndexParam = searchParams.get("slotIndex");
  const cardId = searchParams.get("id");

  let slotIndex = -1;
  if (slotIndexParam !== null) {
    slotIndex = parseInt(slotIndexParam, 10);
  } else if (cardId) {
    const match = cardId.match(/hero-(\d+)/);
    if (match) {
      slotIndex = parseInt(match[1], 10);
    }
  }

  if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= MAX_HERO_CARDS) {
    return NextResponse.json(
      { error: `Valid slotIndex (0-${MAX_HERO_CARDS - 1}) is required.` },
      { status: 400 }
    );
  }

  try {
    const updatedCards = await removeHeroCardSlot(slotIndex);
    triggerRevalidations();

    return NextResponse.json({
      success: true,
      heroCards: updatedCards,
      message: `Slot #${slotIndex + 1} restored to default image.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error removing hero card override";
    console.error("[api/admin/hero-cards] DELETE error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Revalidates cache tags and paths so customer-facing storefront updates immediately.
 */
function triggerRevalidations() {
  try {
    revalidateTag("site-settings", "max");
    revalidatePath("/", "page");
    revalidatePath("/api/settings");
  } catch (err) {
    console.warn("[api/admin/hero-cards] Revalidation notice:", err);
  }
}
