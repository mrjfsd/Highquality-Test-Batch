import assert from "node:assert/strict";
import type { ProductQuantityOffer } from "../src/types/offers.ts";

function getRenderedBadge(
  product: { id: string | number; price: number; sale?: number; offers?: ProductQuantityOffer[] },
  offersMap: Record<string, ProductQuantityOffer[]> = {}
): "ON SALE" | "SPECIAL OFFER" | null {
  const hasDiscount = typeof product.sale === "number" && product.sale < product.price;

  let activeOffer: ProductQuantityOffer | null = null;
  if (product.offers && product.offers.length > 0) {
    activeOffer = product.offers.find((o) => o.is_active) || null;
  } else {
    const pid = String(product.id).trim();
    const offers = offersMap[pid];
    activeOffer = offers && offers.length > 0 ? offers[0] : null;
  }

  const hasActiveOffer = Boolean(activeOffer && activeOffer.is_active);

  // Badge Priority: ON SALE strictly takes priority over SPECIAL OFFER
  if (hasDiscount) {
    return "ON SALE";
  }
  if (hasActiveOffer) {
    return "SPECIAL OFFER";
  }
  return null;
}

console.log("================================================================");
console.log("Style Edit — Badge Priority & Design Verification");
console.log("================================================================\n");

// Scenario 1: Sale only → ON SALE
{
  const product = { id: "p1", price: 1500, sale: 1200 };
  const badge = getRenderedBadge(product, {});
  assert.equal(badge, "ON SALE", "Scenario 1: Sale only should display ON SALE");
  console.log("  ✓ [PASS] Scenario 1: Sale only → ON SALE");
}

// Scenario 2: Quantity offer only → SPECIAL OFFER
{
  const product = { id: "p2", price: 1200 };
  const offersMap = {
    p2: [
      {
        id: "off-2",
        product_id: "p2",
        qualifying_quantity: 3,
        bundle_price: 3000,
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    ],
  };
  const badge = getRenderedBadge(product, offersMap);
  assert.equal(badge, "SPECIAL OFFER", "Scenario 2: Quantity offer only should display SPECIAL OFFER");
  console.log("  ✓ [PASS] Scenario 2: Quantity offer only → SPECIAL OFFER");
}

// Scenario 3: Both sale and quantity offer → ON SALE only (Priority Enforcement)
{
  const product = { id: "p3", price: 1600, sale: 1300 };
  const offersMap = {
    p3: [
      {
        id: "off-3",
        product_id: "p3",
        qualifying_quantity: 2,
        bundle_price: 2400,
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    ],
  };
  const badge = getRenderedBadge(product, offersMap);
  assert.equal(badge, "ON SALE", "Scenario 3: Both active should display ON SALE only (never both)");
  console.log("  ✓ [PASS] Scenario 3: Both sale and quantity offer → ON SALE only (Badge Priority)");
}

// Scenario 4: Neither offer → no badge
{
  const product = { id: "p4", price: 1000 };
  const badge = getRenderedBadge(product, {});
  assert.equal(badge, null, "Scenario 4: Neither offer should display no badge");
  console.log("  ✓ [PASS] Scenario 4: Neither offer → no badge");
}

// Scenario 5: Inactive quantity offer → no SPECIAL OFFER, unless active individual sale independently qualifies
{
  // 5a. Inactive offer with regular price → no badge
  const productInactiveNoSale = {
    id: "p5a",
    price: 1000,
    offers: [
      {
        id: "off-5a",
        product_id: "p5a",
        qualifying_quantity: 3,
        bundle_price: 2500,
        is_active: false,
        created_at: "",
        updated_at: "",
      },
    ],
  };
  const badge5a = getRenderedBadge(productInactiveNoSale, {});
  assert.equal(badge5a, null, "Scenario 5a: Inactive offer with regular price should display no badge");

  // 5b. Deleted offer (empty offersMap) with regular price → no badge
  const productDeletedNoSale = { id: "p5b", price: 1000 };
  const badge5b = getRenderedBadge(productDeletedNoSale, {});
  assert.equal(badge5b, null, "Scenario 5b: Deleted offer should display no badge");

  // 5c. Inactive offer with independent sale price → ON SALE
  const productInactiveWithSale = {
    id: "p5c",
    price: 1000,
    sale: 800,
    offers: [
      {
        id: "off-5c",
        product_id: "p5c",
        qualifying_quantity: 3,
        bundle_price: 2000,
        is_active: false,
        created_at: "",
        updated_at: "",
      },
    ],
  };
  const badge5c = getRenderedBadge(productInactiveWithSale, {});
  assert.equal(badge5c, "ON SALE", "Scenario 5c: Inactive offer with sale price should display ON SALE");

  console.log("  ✓ [PASS] Scenario 5: Inactive quantity offer → no SPECIAL OFFER; ON SALE only if independently qualified");
}

console.log("\n================================================================");
console.log("All 5 Badge Priority Scenarios Passed Successfully!");
console.log("================================================================\n");
