/**
 * Test Suite: Style Edit Phase 2, Step 1 Quantity-Offer Foundation
 * Tests pure pricing engine, bundle calculations, edge cases, floating-point safety,
 * inactive offers, and multi-tier optimization.
 */

import assert from "node:assert/strict";
import {
  calculateItemPriceWithOffers,
  evaluateSingleOfferTier,
  formatOfferLabel,
  roundCurrency,
  isOfferEligible,
} from "../src/lib/pricing/quantity-offers.ts";
import type { ProductQuantityOffer } from "../src/types/offers.ts";

function runTests() {
  console.log("================================================================");
  console.log("Style Edit — Phase 2, Step 1: Quantity-Offer Foundation Tests");
  console.log("================================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(err);
    }
  }

  // Sample offer fixtures
  const offer3for1000: ProductQuantityOffer = {
    id: "offer-uuid-1",
    product_id: "prod-uuid-1",
    qualifying_quantity: 3,
    bundle_price: 1000,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const offer5for1500: ProductQuantityOffer = {
    id: "offer-uuid-2",
    product_id: "prod-uuid-1",
    qualifying_quantity: 5,
    bundle_price: 1500,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const inactiveOffer: ProductQuantityOffer = {
    ...offer3for1000,
    id: "offer-uuid-inactive",
    is_active: false,
  };

  // ----------------------------------------------------------------------------
  // SECTION 1: User Required Example 1 (Regular ₹400, Offer: 3 for ₹1,000)
  // ----------------------------------------------------------------------------
  console.log("Section 1: Required Example 1 (Regular ₹400, Offer: 3 for ₹1,000)");

  test("Quantity 1 -> ₹400, savings ₹0", () => {
    const res = calculateItemPriceWithOffers(1, 400, offer3for1000);
    assert.equal(res.quantity, 1);
    assert.equal(res.regularSubtotal, 400);
    assert.equal(res.qualifyingBundles, 0);
    assert.equal(res.bundledUnits, 0);
    assert.equal(res.remainingUnits, 1);
    assert.equal(res.finalTotal, 400);
    assert.equal(res.discountAmount, 0);
    assert.equal(res.totalSavings, 0);
    assert.equal(res.hasOfferApplied, false);
  });

  test("Quantity 2 -> ₹800, savings ₹0", () => {
    const res = calculateItemPriceWithOffers(2, 400, offer3for1000);
    assert.equal(res.quantity, 2);
    assert.equal(res.regularSubtotal, 800);
    assert.equal(res.qualifyingBundles, 0);
    assert.equal(res.bundledUnits, 0);
    assert.equal(res.remainingUnits, 2);
    assert.equal(res.finalTotal, 800);
    assert.equal(res.discountAmount, 0);
    assert.equal(res.totalSavings, 0);
    assert.equal(res.hasOfferApplied, false);
  });

  test("Quantity 3 -> ₹1,000, savings ₹200", () => {
    const res = calculateItemPriceWithOffers(3, 400, offer3for1000);
    assert.equal(res.quantity, 3);
    assert.equal(res.regularSubtotal, 1200);
    assert.equal(res.qualifyingBundles, 1);
    assert.equal(res.bundledUnits, 3);
    assert.equal(res.bundleSubtotal, 1000);
    assert.equal(res.remainingUnits, 0);
    assert.equal(res.remainingSubtotal, 0);
    assert.equal(res.finalTotal, 1000);
    assert.equal(res.discountAmount, 200);
    assert.equal(res.totalSavings, 200);
    assert.equal(res.hasOfferApplied, true);
    assert.equal(res.offerLabel, "Buy 3 for ₹1,000");
  });

  test("Quantity 4 -> ₹1,400, savings ₹200", () => {
    const res = calculateItemPriceWithOffers(4, 400, offer3for1000);
    assert.equal(res.quantity, 4);
    assert.equal(res.regularSubtotal, 1600);
    assert.equal(res.qualifyingBundles, 1);
    assert.equal(res.bundledUnits, 3);
    assert.equal(res.bundleSubtotal, 1000);
    assert.equal(res.remainingUnits, 1);
    assert.equal(res.remainingSubtotal, 400);
    assert.equal(res.finalTotal, 1400);
    assert.equal(res.discountAmount, 200);
    assert.equal(res.totalSavings, 200);
    assert.equal(res.hasOfferApplied, true);
  });

  test("Quantity 6 -> ₹2,000, savings ₹400", () => {
    const res = calculateItemPriceWithOffers(6, 400, offer3for1000);
    assert.equal(res.quantity, 6);
    assert.equal(res.regularSubtotal, 2400);
    assert.equal(res.qualifyingBundles, 2);
    assert.equal(res.bundledUnits, 6);
    assert.equal(res.bundleSubtotal, 2000);
    assert.equal(res.remainingUnits, 0);
    assert.equal(res.remainingSubtotal, 0);
    assert.equal(res.finalTotal, 2000);
    assert.equal(res.discountAmount, 400);
    assert.equal(res.totalSavings, 400);
    assert.equal(res.hasOfferApplied, true);
  });

  // ----------------------------------------------------------------------------
  // SECTION 2: User Required Example 2 (Regular ₹450, Offer: 3 for ₹1,000)
  // ----------------------------------------------------------------------------
  console.log("\nSection 2: Required Example 2 (Regular ₹450, Offer: 3 for ₹1,000)");

  test("Quantity 3 at ₹450 -> ₹1,000, savings ₹350", () => {
    const res = calculateItemPriceWithOffers(3, 450, offer3for1000);
    assert.equal(res.quantity, 3);
    assert.equal(res.regularSubtotal, 1350);
    assert.equal(res.qualifyingBundles, 1);
    assert.equal(res.bundleSubtotal, 1000);
    assert.equal(res.finalTotal, 1000);
    assert.equal(res.discountAmount, 350);
    assert.equal(res.totalSavings, 350);
    assert.equal(res.hasOfferApplied, true);
  });

  // ----------------------------------------------------------------------------
  // SECTION 3: Inactive Offer & Quantity Below Threshold
  // ----------------------------------------------------------------------------
  console.log("\nSection 3: Inactive Offers & Threshold Guards");

  test("Inactive offer is never applied (Quantity 3 at ₹400 -> ₹1,200, savings ₹0)", () => {
    const res = calculateItemPriceWithOffers(3, 400, inactiveOffer);
    assert.equal(res.regularSubtotal, 1200);
    assert.equal(res.finalTotal, 1200);
    assert.equal(res.discountAmount, 0);
    assert.equal(res.totalSavings, 0);
    assert.equal(res.hasOfferApplied, false);
    assert.equal(res.appliedOffer, null);
  });

  test("Quantity below threshold (Quantity 2 at ₹400 with threshold 3 -> no discount)", () => {
    const res = calculateItemPriceWithOffers(2, 400, offer3for1000);
    assert.equal(res.finalTotal, 800);
    assert.equal(res.discountAmount, 0);
    assert.equal(res.hasOfferApplied, false);
  });

  // ----------------------------------------------------------------------------
  // SECTION 4: Multi-Tier Selection Optimization
  // ----------------------------------------------------------------------------
  console.log("\nSection 4: Multi-Tier Selection");

  test("Multi-tier selection at Q5 chooses Tier 2 (5 for ₹1,500 over 3 for ₹1,000)", () => {
    // At Q5 with ₹400 unit price:
    // Tier 1 (3 for 1000): 1 bundle (1000) + 2 rem (800) = 1800 -> savings 200
    // Tier 2 (5 for 1500): 1 bundle (1500) = 1500 -> savings 500
    // Optimal choice must be Tier 2
    const res = calculateItemPriceWithOffers(5, 400, [offer3for1000, offer5for1500]);
    assert.equal(res.finalTotal, 1500);
    assert.equal(res.discountAmount, 500);
    assert.equal(res.totalSavings, 500);
    assert.equal(res.appliedOffer?.id, offer5for1500.id);
    assert.equal(res.offerLabel, "Buy 5 for ₹1,500");
  });

  // ----------------------------------------------------------------------------
  // SECTION 5: Floating Point Currency Precision & Safety
  // ----------------------------------------------------------------------------
  console.log("\nSection 5: Currency Precision & Invariant Guards");

  test("Floating point currency calculation (e.g., 3 units at ₹499.99 for ₹1,299.99)", () => {
    const floatOffer: ProductQuantityOffer = {
      ...offer3for1000,
      bundle_price: 1299.99,
    };
    const res = calculateItemPriceWithOffers(3, 499.99, floatOffer);
    assert.equal(res.regularSubtotal, 1499.97);
    assert.equal(res.bundleSubtotal, 1299.99);
    assert.equal(res.finalTotal, 1299.99);
    assert.equal(res.discountAmount, 199.98);
    assert.equal(res.totalSavings, 199.98);
  });

  test("Offer that gives zero or negative savings is safely ignored", () => {
    // Bad offer: 3 for ₹1,500 when regular unit price is ₹400 (3 * 400 = 1200)
    // Bundle price is more expensive than regular price! Must not penalize customer.
    const badOffer: ProductQuantityOffer = {
      ...offer3for1000,
      bundle_price: 1500,
    };
    const res = calculateItemPriceWithOffers(3, 400, badOffer);
    assert.equal(res.finalTotal, 1200);
    assert.equal(res.discountAmount, 0);
    assert.equal(res.hasOfferApplied, false);
  });

  test("Invalid input resilience (null offer, 0 quantity, negative quantity, NaN)", () => {
    assert.equal(calculateItemPriceWithOffers(0, 400, offer3for1000).finalTotal, 0);
    assert.equal(calculateItemPriceWithOffers(-5, 400, offer3for1000).finalTotal, 0);
    assert.equal(calculateItemPriceWithOffers(NaN, 400, offer3for1000).finalTotal, 0);
    assert.equal(calculateItemPriceWithOffers(3, -400, offer3for1000).finalTotal, 0);
    assert.equal(calculateItemPriceWithOffers(3, 400, null).finalTotal, 1200);
    assert.equal(calculateItemPriceWithOffers(3, 400, undefined).finalTotal, 1200);
  });

  test("Label formatting utility", () => {
    assert.equal(formatOfferLabel(offer3for1000), "Buy 3 for ₹1,000");
    assert.equal(formatOfferLabel(offer5for1500), "Buy 5 for ₹1,500");
    assert.equal(formatOfferLabel(null), null);
    assert.equal(formatOfferLabel({ qualifying_quantity: 1, bundle_price: 500 }), null);
  });

  // Summary
  console.log("\n================================================================");
  console.log(`Test Execution Summary: ${passed} / ${total} tests passed.`);
  console.log("================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
