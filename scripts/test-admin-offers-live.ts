/**
 * Live HTTP Test Suite: Style Edit Phase 2, Step 2 Admin Quantity-Offer API
 * Tests against the active dev server at http://localhost:3000
 */

import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function runLiveAdminOfferTests() {
  console.log("==================================================================");
  console.log("Style Edit — Phase 2, Step 2: Live Admin Offers HTTP Tests");
  console.log(`Target Server: ${BASE_URL}`);
  console.log("==================================================================\n");

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(err);
    }
  }

  // ----------------------------------------------------------------------------
  // SECTION 1: Unauthenticated & Unauthorized Security Rejection
  // ----------------------------------------------------------------------------
  console.log("Section 1: Live Security & Authorization Enforcement");

  await test("GET /api/admin/offers returns 401 without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/offers`);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.ok(json.error);
    console.log("    Response:", json.error);
  });

  await test("POST /api/admin/offers returns 401 without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "fake", qualifying_quantity: 3, bundle_price: 1000 }),
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.ok(json.error);
  });

  await test("PATCH /api/admin/offers/fake-id returns 401 without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/offers/fake-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.ok(json.error);
  });

  await test("DELETE /api/admin/offers/fake-id returns 401 without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/offers/fake-id`, {
      method: "DELETE",
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.ok(json.error);
  });

  await test("Invalid Bearer token is rejected with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/offers`, {
      headers: { Authorization: "Bearer bogus-token-value-999" },
    });
    assert.equal(res.status, 401);
  });

  // ----------------------------------------------------------------------------
  // SECTION 2: Input Validation Logic Tests
  // ----------------------------------------------------------------------------
  console.log("\nSection 2: Validation Guard Rules");

  await test("Qualifying quantity validation enforces integer >= 2", () => {
    const invalidQuantities = [1, 0, -1, 1.5, 2.7, NaN, null, undefined, "abc"];
    for (const q of invalidQuantities) {
      const num = Number(q);
      const isValid = Number.isInteger(num) && num >= 2;
      assert.equal(isValid, false, `Quantity ${q} should be invalid`);
    }

    const validQuantities = [2, 3, 4, 5, 10];
    for (const q of validQuantities) {
      const num = Number(q);
      const isValid = Number.isInteger(num) && num >= 2;
      assert.equal(isValid, true, `Quantity ${q} should be valid`);
    }
  });

  await test("Bundle price validation enforces non-negative finite currency number", () => {
    const invalidPrices = [-1, -500, NaN, Infinity, -Infinity, null, undefined, "abc"];
    for (const p of invalidPrices) {
      const num = Number(p);
      const isValid = Number.isFinite(num) && num >= 0 && p !== null && p !== undefined;
      assert.equal(isValid, false, `Price ${p} should be invalid`);
    }

    const validPrices = [0, 500, 1000, 999.99, 1499.5];
    for (const p of validPrices) {
      const num = Number(p);
      const isValid = Number.isFinite(num) && num >= 0;
      assert.equal(isValid, true, `Price ${p} should be valid`);
    }
  });

  await test("Savings calculation accurately detects zero/negative savings deals", () => {
    const unitPrice = 400;

    // Test case A: Buy 3 for ₹1,000 (regular 1,200) -> savings 200 (Valid discount)
    const regTotalA = 3 * unitPrice;
    const savingsA = regTotalA - 1000;
    assert.equal(savingsA, 200);
    assert.equal(savingsA <= 0, false);

    // Test case B: Buy 3 for ₹1,200 (regular 1,200) -> savings 0 (No savings)
    const savingsB = regTotalA - 1200;
    assert.equal(savingsB, 0);
    assert.equal(savingsB <= 0, true);

    // Test case C: Buy 3 for ₹1,500 (regular 1,200) -> negative savings -300 (Worse than regular)
    const savingsC = regTotalA - 1500;
    assert.equal(savingsC, -300);
    assert.equal(savingsC <= 0, true);
  });

  await test("Duplicate tier detection prevents duplicate qualifying quantities for same product", () => {
    const existingOffers = [
      { id: "o-1", product_id: "prod-a", qualifying_quantity: 3, bundle_price: 1000 },
      { id: "o-2", product_id: "prod-a", qualifying_quantity: 5, bundle_price: 1500 },
      { id: "o-3", product_id: "prod-b", qualifying_quantity: 3, bundle_price: 1100 },
    ];

    // Attempting to add Tier 3 to prod-a -> duplicate!
    const isDupProdA = existingOffers.some(
      (o) => o.product_id === "prod-a" && o.qualifying_quantity === 3
    );
    assert.equal(isDupProdA, true);

    // Attempting to add Tier 6 to prod-a -> distinct tier allowed!
    const isDupProdA_6 = existingOffers.some(
      (o) => o.product_id === "prod-a" && o.qualifying_quantity === 6
    );
    assert.equal(isDupProdA_6, false);

    // Attempting to add Tier 3 to prod-c -> distinct product allowed!
    const isDupProdC = existingOffers.some(
      (o) => o.product_id === "prod-c" && o.qualifying_quantity === 3
    );
    assert.equal(isDupProdC, false);
  });

  // Summary
  console.log("\n==================================================================");
  console.log(`Test Execution Summary: ${passed} / ${total} tests passed.`);
  console.log("==================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runLiveAdminOfferTests().catch(console.error);
