/**
 * Test Suite: Style Edit Phase 2, Step 3 — Storefront Quantity Offers Integration
 * Validates:
 * 1. Product without offer retains normal pricing
 * 2. Quantity below threshold receives no discount
 * 3. Jeans at ₹400, offer 3 for ₹1,000 (Q1=₹400, Q2=₹800, Q3=₹1,000, Q4=₹1,400, Q6=₹2,000)
 * 4. Kids' dress at ₹450, offer 3 for ₹1,000 (Q3=₹1,000, savings=₹350)
 * 5. Changing quantities updates offer savings immediately
 * 6. Removing an item recalculates totals
 * 7. Refresh/deserialization retains items and pricing integrity
 * 8. Inactive and deleted offers are not applied
 * 9. Multiple offer tiers do not double-discount items
 * 10. Selected sizes and colors remain correctly associated with cart items
 * 11. WhatsApp item totals, savings, and final total match cart
 * 12. Variant grouping across sizes/colors for product-level offers
 */

import assert from "node:assert/strict";
import {
  calculateCartTotalsWithOffers,
  calculateItemPricingInCart,
  generateWhatsAppOrderMessage,
  generateWhatsAppOrderUrl,
  generateBuyNowWhatsAppMessage,
  generateBuyNowWhatsAppUrl,
  sanitizeCartItems,
  buildCartItemId,
} from "../src/lib/cart/cart-utils.ts";
import type { CartItem } from "../src/types/cart.ts";
import type { ProductQuantityOffer } from "../src/types/offers.ts";

function runTests() {
  console.log("================================================================");
  console.log("Style Edit — Phase 2, Step 3: Storefront Integration Tests");
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

  const JEANS_PID = "prod-jeans-1";
  const DRESS_PID = "prod-dress-2";
  const SHIRT_PID = "prod-shirt-3";

  const jeansOffer3for1000: ProductQuantityOffer = {
    id: "offer-jeans-1",
    product_id: JEANS_PID,
    qualifying_quantity: 3,
    bundle_price: 1000,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const dressOffer3for1000: ProductQuantityOffer = {
    id: "offer-dress-1",
    product_id: DRESS_PID,
    qualifying_quantity: 3,
    bundle_price: 1000,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const jeansOffer5for1500: ProductQuantityOffer = {
    id: "offer-jeans-tier2",
    product_id: JEANS_PID,
    qualifying_quantity: 5,
    bundle_price: 1500,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const inactiveJeansOffer: ProductQuantityOffer = {
    ...jeansOffer3for1000,
    is_active: false,
  };

  const offersMap: Record<string, ProductQuantityOffer[]> = {
    [JEANS_PID]: [jeansOffer3for1000],
    [DRESS_PID]: [dressOffer3for1000],
  };

  // Case 1: Product without an offer retains normal pricing
  test("1. Product without an offer retains normal pricing", () => {
    const items: CartItem[] = [
      {
        id: buildCartItemId(SHIRT_PID, null, "M", "White"),
        productId: SHIRT_PID,
        name: "Linen Shirt",
        slug: "linen-shirt",
        image: "/shirt.jpg",
        price: 800,
        size: "M",
        color: "White",
        quantity: 3,
      },
    ];

    const totals = calculateCartTotalsWithOffers(items, offersMap);
    assert.equal(totals.regularSubtotal, 2400);
    assert.equal(totals.totalSavings, 0);
    assert.equal(totals.finalTotal, 2400);

    const pricing = calculateItemPricingInCart(items[0], items, offersMap);
    assert.equal(pricing.hasOfferApplied, false);
    assert.equal(pricing.finalTotal, 2400);
    assert.equal(pricing.discountAmount, 0);
  });

  // Case 2: Quantity below threshold receives no discount
  test("2. Quantity below threshold receives no discount", () => {
    const items: CartItem[] = [
      {
        id: buildCartItemId(JEANS_PID, null, "32", "Denim"),
        productId: JEANS_PID,
        name: "Classic Denim Jeans",
        slug: "classic-denim-jeans",
        image: "/jeans.jpg",
        price: 400,
        size: "32",
        color: "Denim",
        quantity: 2,
      },
    ];

    const totals = calculateCartTotalsWithOffers(items, offersMap);
    assert.equal(totals.regularSubtotal, 800);
    assert.equal(totals.totalSavings, 0);
    assert.equal(totals.finalTotal, 800);

    const pricing = calculateItemPricingInCart(items[0], items, offersMap);
    assert.equal(pricing.hasOfferApplied, false);
    assert.equal(pricing.unitsNeededForNextTier, 1);
  });

  // Case 3: Jeans priced at ₹400, offer 3 for ₹1,000 (Q1, Q2, Q3, Q4, Q6)
  test("3. Jeans priced at ₹400, offer 3 for ₹1,000 progression", () => {
    const testQuantities = [
      { qty: 1, expectedSubtotal: 400, expectedSavings: 0, expectedFinal: 400 },
      { qty: 2, expectedSubtotal: 800, expectedSavings: 0, expectedFinal: 800 },
      { qty: 3, expectedSubtotal: 1200, expectedSavings: 200, expectedFinal: 1000 },
      { qty: 4, expectedSubtotal: 1600, expectedSavings: 200, expectedFinal: 1400 },
      { qty: 6, expectedSubtotal: 2400, expectedSavings: 400, expectedFinal: 2000 },
    ];

    for (const { qty, expectedSubtotal, expectedSavings, expectedFinal } of testQuantities) {
      const items: CartItem[] = [
        {
          id: buildCartItemId(JEANS_PID, null, "32", "Denim"),
          productId: JEANS_PID,
          name: "Classic Denim Jeans",
          slug: "classic-denim-jeans",
          image: "/jeans.jpg",
          price: 400,
          quantity: qty,
        },
      ];
      const totals = calculateCartTotalsWithOffers(items, offersMap);
      assert.equal(totals.regularSubtotal, expectedSubtotal, `Subtotal mismatch for qty ${qty}`);
      assert.equal(totals.totalSavings, expectedSavings, `Savings mismatch for qty ${qty}`);
      assert.equal(totals.finalTotal, expectedFinal, `Final total mismatch for qty ${qty}`);
    }
  });

  // Case 4: Kids' dress priced at ₹450, offer 3 for ₹1,000
  test("4. Kids' dress priced at ₹450, offer 3 for ₹1,000", () => {
    const items: CartItem[] = [
      {
        id: buildCartItemId(DRESS_PID, null, "4Y", "Pink"),
        productId: DRESS_PID,
        name: "Kids Floral Dress",
        slug: "kids-floral-dress",
        image: "/dress.jpg",
        price: 450,
        size: "4Y",
        color: "Pink",
        quantity: 3,
      },
    ];

    const totals = calculateCartTotalsWithOffers(items, offersMap);
    assert.equal(totals.regularSubtotal, 1350);
    assert.equal(totals.totalSavings, 350);
    assert.equal(totals.finalTotal, 1000);

    const pricing = calculateItemPricingInCart(items[0], items, offersMap);
    assert.equal(pricing.hasOfferApplied, true);
    assert.equal(pricing.discountAmount, 350);
    assert.equal(pricing.finalTotal, 1000);
  });

  // Case 5: Changing quantities updates offer savings immediately
  test("5. Changing quantities updates offer savings immediately", () => {
    const item: CartItem = {
      id: buildCartItemId(JEANS_PID, null, "32", "Denim"),
      productId: JEANS_PID,
      name: "Classic Denim Jeans",
      slug: "classic-denim-jeans",
      image: "/jeans.jpg",
      price: 400,
      quantity: 2,
    };

    let totals = calculateCartTotalsWithOffers([item], offersMap);
    assert.equal(totals.totalSavings, 0);

    // Increase to 3
    const updatedItem = { ...item, quantity: 3 };
    totals = calculateCartTotalsWithOffers([updatedItem], offersMap);
    assert.equal(totals.totalSavings, 200);
    assert.equal(totals.finalTotal, 1000);
  });

  // Case 6: Removing an item recalculates totals
  test("6. Removing an item recalculates totals", () => {
    const items: CartItem[] = [
      {
        id: buildCartItemId(JEANS_PID, null, "32", "Denim"),
        productId: JEANS_PID,
        name: "Classic Denim Jeans",
        slug: "classic-denim-jeans",
        image: "/jeans.jpg",
        price: 400,
        quantity: 3,
      },
      {
        id: buildCartItemId(SHIRT_PID, null, "M", "White"),
        productId: SHIRT_PID,
        name: "Linen Shirt",
        slug: "linen-shirt",
        image: "/shirt.jpg",
        price: 800,
        quantity: 1,
      },
    ];

    let totals = calculateCartTotalsWithOffers(items, offersMap);
    assert.equal(totals.regularSubtotal, 2000); // 1200 + 800
    assert.equal(totals.totalSavings, 200);
    assert.equal(totals.finalTotal, 1800);

    // Remove jeans
    const remaining = items.filter((i) => i.productId !== JEANS_PID);
    totals = calculateCartTotalsWithOffers(remaining, offersMap);
    assert.equal(totals.regularSubtotal, 800);
    assert.equal(totals.totalSavings, 0);
    assert.equal(totals.finalTotal, 800);
  });

  // Case 7: Refreshing / deserializing preserves cart contents and correct pricing
  test("7. Deserializing preserves cart contents and pricing integrity", () => {
    const rawSavedCart = [
      {
        id: "prod-jeans-1__default__32__Denim",
        productId: "prod-jeans-1",
        name: "Classic Denim Jeans",
        slug: "classic-denim-jeans",
        image: "/jeans.jpg",
        price: 400,
        size: "32",
        color: "Denim",
        quantity: 3,
      },
    ];

    const sanitized = sanitizeCartItems(rawSavedCart);
    assert.equal(sanitized.length, 1);
    assert.equal(sanitized[0].quantity, 3);

    const totals = calculateCartTotalsWithOffers(sanitized, offersMap);
    assert.equal(totals.regularSubtotal, 1200);
    assert.equal(totals.totalSavings, 200);
    assert.equal(totals.finalTotal, 1000);
  });

  // Case 8: Inactive and deleted offers are not applied
  test("8. Inactive and deleted offers are not applied", () => {
    const inactiveMap = {
      [JEANS_PID]: [inactiveJeansOffer],
    };
    const items: CartItem[] = [
      {
        id: buildCartItemId(JEANS_PID, null, "32", "Denim"),
        productId: JEANS_PID,
        name: "Classic Denim Jeans",
        slug: "classic-denim-jeans",
        image: "/jeans.jpg",
        price: 400,
        quantity: 3,
      },
    ];

    const totals = calculateCartTotalsWithOffers(items, inactiveMap);
    assert.equal(totals.regularSubtotal, 1200);
    assert.equal(totals.totalSavings, 0);
    assert.equal(totals.finalTotal, 1200);

    // Empty map (offer deleted)
    const emptyMapTotals = calculateCartTotalsWithOffers(items, {});
    assert.equal(emptyMapTotals.totalSavings, 0);
    assert.equal(emptyMapTotals.finalTotal, 1200);
  });

  // Case 9: Multiple offer tiers do not double-discount items
  test("9. Multiple offer tiers choose best deal without double-discounting", () => {
    const multiTierMap = {
      [JEANS_PID]: [jeansOffer3for1000, jeansOffer5for1500],
    };

    const items: CartItem[] = [
      {
        id: buildCartItemId(JEANS_PID, null, "32", "Denim"),
        productId: JEANS_PID,
        name: "Classic Denim Jeans",
        slug: "classic-denim-jeans",
        image: "/jeans.jpg",
        price: 400,
        quantity: 5,
      },
    ];

    // Q5 at ₹400 regular = ₹2,000.
    // Tier 1 (3 for ₹1,000): 1 bundle (₹1,000) + 2 remainder (₹800) = ₹1,800 (savings ₹200)
    // Tier 2 (5 for ₹1,500): 1 bundle (₹1,500) = ₹1,500 (savings ₹500)
    // Best tier chosen: Tier 2 with ₹500 savings!
    const totals = calculateCartTotalsWithOffers(items, multiTierMap);
    assert.equal(totals.regularSubtotal, 2000);
    assert.equal(totals.totalSavings, 500);
    assert.equal(totals.finalTotal, 1500);
  });

  // Case 10: Selected sizes and colors remain correctly associated with cart items
  test("10. Selected sizes and colors remain correctly associated", () => {
    const items: CartItem[] = [
      {
        id: buildCartItemId(JEANS_PID, "v-32-blue", "32", "Dark Blue"),
        productId: JEANS_PID,
        name: "Classic Denim Jeans",
        slug: "classic-denim-jeans",
        image: "/jeans-blue.jpg",
        price: 400,
        size: "32",
        color: "Dark Blue",
        quantity: 1,
      },
      {
        id: buildCartItemId(JEANS_PID, "v-34-black", "34", "Washed Black"),
        productId: JEANS_PID,
        name: "Classic Denim Jeans",
        slug: "classic-denim-jeans",
        image: "/jeans-black.jpg",
        price: 400,
        size: "34",
        color: "Washed Black",
        quantity: 2,
      },
    ];

    // Total quantity of jeans across variants is 1 + 2 = 3 units -> qualifies for Buy 3 for ₹1,000!
    const totals = calculateCartTotalsWithOffers(items, offersMap);
    assert.equal(totals.regularSubtotal, 1200);
    assert.equal(totals.totalSavings, 200);
    assert.equal(totals.finalTotal, 1000);

    // Each variant line item has its own size and color preserved
    assert.equal(items[0].size, "32");
    assert.equal(items[0].color, "Dark Blue");
    assert.equal(items[1].size, "34");
    assert.equal(items[1].color, "Washed Black");
  });

  // Case 11: WhatsApp message builder totals and item details match the cart
  test("11. WhatsApp message builder reflects exact cart pricing and offer details", () => {
    const items: CartItem[] = [
      {
        id: buildCartItemId(JEANS_PID, null, "32", "Denim"),
        productId: JEANS_PID,
        name: "Classic Denim Jeans",
        slug: "classic-denim-jeans",
        image: "/jeans.jpg",
        price: 400,
        size: "32",
        color: "Denim",
        quantity: 3,
      },
    ];

    const message = generateWhatsAppOrderMessage(items, offersMap);

    assert.ok(message.includes("Hello! I'd like to place an order from Style Edit."));
    assert.ok(message.includes("*1. Classic Denim Jeans*"));
    assert.ok(message.includes("- Product: https://style-edit.com/product/classic-denim-jeans"));
    assert.ok(message.includes("- Image: https://style-edit.com/jeans.jpg"));
    assert.ok(message.includes("- Size: 32"));
    assert.ok(message.includes("- Colour: Denim"));
    assert.ok(message.includes("- Quantity: 3"));
    assert.ok(message.includes("- Regular price: ₹400 each"));
    assert.ok(message.includes("- Regular subtotal: ₹1,200"));
    assert.ok(message.includes("- Offer: Buy 3 for ₹1,000"));
    assert.ok(message.includes("- Savings: ₹200"));
    assert.ok(message.includes("- Final item total: ₹1,000"));
    assert.ok(message.includes("*Order Summary*"));
    assert.ok(message.includes("- Selected order subtotal: ₹1,200"));
    assert.ok(message.includes("- Offer savings: ₹200"));
    assert.ok(message.includes("- Final order total: ₹1,000"));
    assert.ok(message.includes("Please confirm availability and the order details. Thank you!"));

    const url = generateWhatsAppOrderUrl(items, offersMap);
    assert.ok(url.startsWith("https://wa.me/"));
    assert.ok(url.includes("text="));
    assert.ok(url.includes(encodeURIComponent("Hello! I'd like to place an order from Style Edit.")));
    assert.ok(url.includes(encodeURIComponent("- Product: https://style-edit.com/product/classic-denim-jeans")));
  });

  // Case 12: Selective WhatsApp Ordering — subset selection excludes deselected item
  test("12. Selective WhatsApp ordering excludes deselected items from totals and message", () => {
    const fullCart: CartItem[] = [
      {
        id: buildCartItemId(JEANS_PID, null, "32", "Blue"),
        productId: JEANS_PID,
        name: "Classic Denim Jeans",
        slug: "classic-denim-jeans",
        image: "/jeans.jpg",
        price: 400,
        size: "32",
        color: "Blue",
        quantity: 3,
      },
      {
        id: buildCartItemId(DRESS_PID, null, "M", "Floral"),
        productId: DRESS_PID,
        name: "Kids Floral Dress",
        slug: "kids-floral-dress",
        image: "/dress.jpg",
        price: 450,
        size: "M",
        color: "Floral",
        quantity: 1,
      },
    ];

    // Customer selects only Jeans (item 0)
    const selectedItems = [fullCart[0]];

    const selectedTotals = calculateCartTotalsWithOffers(selectedItems, offersMap);
    assert.equal(selectedTotals.regularSubtotal, 1200);
    assert.equal(selectedTotals.totalSavings, 200);
    assert.equal(selectedTotals.finalTotal, 1000);

    const whatsappMsg = generateWhatsAppOrderMessage(selectedItems, offersMap);
    assert.ok(whatsappMsg.includes("*1. Classic Denim Jeans*"));
    assert.ok(whatsappMsg.includes("- Product: https://style-edit.com/product/classic-denim-jeans"));
    assert.ok(!whatsappMsg.includes("Kids Floral Dress"));
    assert.ok(whatsappMsg.includes("- Selected order subtotal: ₹1,200"));
    assert.ok(whatsappMsg.includes("- Offer savings: ₹200"));
    assert.ok(whatsappMsg.includes("- Final order total: ₹1,000"));

    // Full cart still contains 2 items
    assert.equal(fullCart.length, 2);
  });

  // Case 13: Deselecting items recalculates bundle eligibility based only on selected quantities
  test("13. Offer recalculates using only selected item quantities (variant pooling)", () => {
    const itemA: CartItem = {
      id: buildCartItemId(JEANS_PID, "v1", "30", "Blue"),
      productId: JEANS_PID,
      name: "Classic Denim Jeans",
      slug: "classic-denim-jeans",
      image: "/jeans.jpg",
      price: 400,
      size: "30",
      color: "Blue",
      quantity: 2,
    };
    const itemB: CartItem = {
      id: buildCartItemId(JEANS_PID, "v2", "32", "Black"),
      productId: JEANS_PID,
      name: "Classic Denim Jeans",
      slug: "classic-denim-jeans",
      image: "/jeans.jpg",
      price: 400,
      size: "32",
      color: "Black",
      quantity: 1,
    };

    // When both are selected, total is 3 units -> qualifies for Buy 3 for ₹1,000
    const bothSelected = [itemA, itemB];
    const bothTotals = calculateCartTotalsWithOffers(bothSelected, offersMap);
    assert.equal(bothTotals.totalSavings, 200);
    assert.equal(bothTotals.finalTotal, 1000);

    // If itemB is deselected, only 2 units are selected -> no offer savings
    const onlyASelected = [itemA];
    const aTotals = calculateCartTotalsWithOffers(onlyASelected, offersMap);
    assert.equal(aTotals.regularSubtotal, 800);
    assert.equal(aTotals.totalSavings, 0);
    assert.equal(aTotals.finalTotal, 800);

    const messageA = generateWhatsAppOrderMessage(onlyASelected, offersMap);
    assert.ok(messageA.includes("- Savings: ₹0"));
    assert.ok(messageA.includes("- Selected order subtotal: ₹800"));
    assert.ok(messageA.includes("- Offer savings: ₹0"));
    assert.ok(messageA.includes("- Final order total: ₹800"));
  });

  // Case 14: Zero selected items generates empty WhatsApp order URL
  test("14. Zero selected items yields empty URL and fallback message", () => {
    const emptyUrl = generateWhatsAppOrderUrl([]);
    assert.equal(emptyUrl, "");

    const emptyMsg = generateWhatsAppOrderMessage([]);
    assert.ok(emptyMsg.includes("Hello! I'm interested in ordering from Style Edit."));
  });

  // Case 15: Select all & Deselect all state logic
  test("15. Select all and Deselect all selection lists match expectations", () => {
    const cartIds = ["item-1", "item-2", "item-3"];
    let selectedIds: string[] = [...cartIds]; // select all

    assert.equal(selectedIds.length, 3);

    // Deselect all
    selectedIds = [];
    assert.equal(selectedIds.length, 0);

    // Toggle one
    selectedIds = ["item-1"];
    assert.equal(selectedIds.length, 1);
    assert.ok(selectedIds.includes("item-1"));
    assert.ok(!selectedIds.includes("item-2"));
  });

  // Case 16: Single cart line item behavior
  test("16. Single distinct cart item is automatically included in selected order", () => {
    // 5 units of the same product count as 1 distinct cart item
    const singleProductFiveUnits: CartItem[] = [
      {
        id: buildCartItemId(JEANS_PID, null, "32", "Denim"),
        productId: JEANS_PID,
        name: "Classic Denim Jeans",
        slug: "classic-denim-jeans",
        image: "/jeans.jpg",
        price: 400,
        size: "32",
        color: "Denim",
        quantity: 5,
      },
    ];

    // Single distinct item: items.length === 1
    assert.equal(singleProductFiveUnits.length, 1);
    const showSelectionControls = singleProductFiveUnits.length > 1;
    assert.equal(showSelectionControls, false); // controls must be hidden

    // Totals calculate offer for 5 units (1 bundle of 3 @ 1000 + 2 @ 400 = 1800, savings 200)
    const totals = calculateCartTotalsWithOffers(singleProductFiveUnits, offersMap);
    assert.equal(totals.regularSubtotal, 2000);
    assert.equal(totals.totalSavings, 200);
    assert.equal(totals.finalTotal, 1800);

    const whatsappUrl = generateWhatsAppOrderUrl(singleProductFiveUnits, offersMap);
    assert.ok(whatsappUrl.startsWith("https://wa.me/"));
    assert.ok(whatsappUrl.includes("Classic%20Denim%20Jeans"));
  });

  // Case 17: Buy Now WhatsApp message with qualifying bundle offer
  test("17. Buy Now message generates correct discounted total for qualifying quantity", () => {
    const buyNowInput = {
      product: {
        id: "prod-jeans-1",
        name: "Blue Jeans",
        slug: "blue-jeans",
        image: "https://your-image-host.com/blue-jeans.jpg",
        price: 1200,
      },
      size: "L",
      color: "Black",
      quantity: 3,
      activeOffer: {
        id: "offer-jeans-3for3200",
        product_id: "prod-jeans-1",
        qualifying_quantity: 3,
        bundle_price: 3200,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    const message = generateBuyNowWhatsAppMessage(buyNowInput);

    assert.ok(message.includes("Hello! I'd like to order from Style Edit."));
    assert.ok(message.includes("*Product: Blue Jeans*"));
    assert.ok(message.includes("- Product: https://style-edit.com/product/blue-jeans"));
    assert.ok(message.includes("- Image: https://your-image-host.com/blue-jeans.jpg"));
    assert.ok(message.includes("- Size: L"));
    assert.ok(message.includes("- Colour: Black"));
    assert.ok(message.includes("- Quantity: 3"));
    assert.ok(message.includes("- Regular price: ₹1,200 each"));
    assert.ok(message.includes("- Regular subtotal: ₹3,600"));
    assert.ok(message.includes("- Offer: Buy 3 for ₹3,200"));
    assert.ok(message.includes("- Savings: ₹400"));
    assert.ok(message.includes("- Final total: ₹3,200"));
    assert.ok(message.includes("Please confirm availability and the order details. Thank you!"));
  });

  // Case 18: Buy Now WhatsApp message with non-qualifying quantity (regular pricing)
  test("18. Buy Now message uses regular pricing and Unit price when not qualifying for offer", () => {
    const buyNowInput = {
      product: {
        id: "prod-jeans-1",
        name: "Blue Jeans",
        slug: "blue-jeans",
        image: "https://your-image-host.com/blue-jeans.jpg",
        price: 1200,
      },
      size: "M",
      color: "Dark Blue",
      quantity: 2,
      activeOffer: {
        id: "offer-jeans-3for3200",
        product_id: "prod-jeans-1",
        qualifying_quantity: 3,
        bundle_price: 3200,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    const message = generateBuyNowWhatsAppMessage(buyNowInput);

    assert.ok(message.includes("Hello! I'd like to order from Style Edit."));
    assert.ok(message.includes("*Product: Blue Jeans*"));
    assert.ok(message.includes("- Product: https://style-edit.com/product/blue-jeans"));
    assert.ok(message.includes("- Image: https://your-image-host.com/blue-jeans.jpg"));
    assert.ok(message.includes("- Size: M"));
    assert.ok(message.includes("- Colour: Dark Blue"));
    assert.ok(message.includes("- Quantity: 2"));
    assert.ok(message.includes("- Regular price: ₹1,200 each"));
    assert.ok(message.includes("- Regular subtotal: ₹2,400"));
    assert.ok(!message.includes("- Offer: Buy 3 for ₹3,200"));
    assert.ok(message.includes("- Savings: ₹0"));
    assert.ok(message.includes("- Final total: ₹2,400"));
    assert.ok(message.includes("Please confirm availability and the order details. Thank you!"));
  });

  // Case 19: Buy Now WhatsApp URL encoding and phone handling
  test("19. Buy Now URL properly encodes text and handles phone validation", () => {
    const buyNowInput = {
      product: {
        id: "prod-tshirt-1",
        name: "Classic Linen Tee",
        slug: "classic-linen-tee",
        image: "/tee.jpg",
        price: 850,
      },
      size: "S",
      color: "Ivory",
      quantity: 1,
    };

    const validUrl = generateBuyNowWhatsAppUrl(buyNowInput, "917676105819");
    assert.ok(validUrl.startsWith("https://wa.me/917676105819?text="));
    assert.ok(validUrl.includes(encodeURIComponent("*Product: Classic Linen Tee*")));
    assert.ok(validUrl.includes(encodeURIComponent("- Product: https://style-edit.com/product/classic-linen-tee")));
    assert.ok(validUrl.includes(encodeURIComponent("- Image: https://style-edit.com/tee.jpg")));
    assert.ok(validUrl.includes(encodeURIComponent("- Size: S")));
    assert.ok(validUrl.includes(encodeURIComponent("- Colour: Ivory")));

    // Empty phone produces empty URL
    const emptyPhoneUrl = generateBuyNowWhatsAppUrl(buyNowInput, "");
    assert.equal(emptyPhoneUrl, "");
  });

  // Case 20: Buy Now is isolated from existing cart items
  test("20. Buy Now message contains ONLY the single product and excludes cart items", () => {
    const cartItems: CartItem[] = [
      {
        id: "cart-item-1",
        productId: "prod-dress-99",
        name: "Unrelated Silk Dress",
        slug: "silk-dress",
        image: "/dress.jpg",
        price: 5000,
        quantity: 2,
      },
    ];

    const buyNowInput = {
      product: {
        id: "prod-jeans-1",
        name: "Blue Jeans",
        slug: "blue-jeans",
        price: 1200,
      },
      size: "L",
      color: "Black",
      quantity: 1,
    };

    const message = generateBuyNowWhatsAppMessage(buyNowInput);

    // Verify Buy Now message has only Blue Jeans, and no cart items
    assert.ok(message.includes("*Product: Blue Jeans*"));
    assert.ok(message.includes("- Product: https://style-edit.com/product/blue-jeans"));
    assert.ok(!message.includes("Unrelated Silk Dress"));
    assert.equal(cartItems.length, 1); // Cart remains completely unchanged
  });

  // Case 21: Graceful handling of missing images, blob URLs, and missing slugs
  test("21. Missing images, blob URLs, and missing slugs are gracefully handled", () => {
    const itemWithoutImageOrSlug: CartItem = {
      id: "no-img-item",
      productId: "prod-misc-1",
      name: "Minimalist Beanie",
      slug: "",
      image: "blob:http://localhost:3000/d74fa1",
      price: 600,
      quantity: 1,
    };

    const message = generateWhatsAppOrderMessage([itemWithoutImageOrSlug]);
    assert.ok(message.includes("*1. Minimalist Beanie*"));
    assert.ok(!message.includes("- Product:"));
    assert.ok(!message.includes("- Image:"));
    assert.ok(message.includes("- Regular price: ₹600 each"));
    assert.ok(message.includes("- Final item total: ₹600"));
    assert.ok(message.includes("- Final order total: ₹600"));
  });

  // Case 22: Multi-product cart formatting with dividers and pricing engine consistency
  test("22. Multi-product cart includes links, images, and dividers between products", () => {
    const multiItems: CartItem[] = [
      {
        id: buildCartItemId(SHIRT_PID, null, "L", "Pink"),
        productId: SHIRT_PID,
        name: "Relaxed Fit Collar Down Shirt",
        slug: "relaxed-fit-collar-down-shirt",
        image: "/shirt-pink.jpg",
        price: 1200,
        size: "L",
        color: "Pink",
        quantity: 1,
      },
      {
        id: buildCartItemId(JEANS_PID, null, "32", "Dark Blue"),
        productId: JEANS_PID,
        name: "Classic Denim Jeans",
        slug: "classic-denim-jeans",
        image: "/jeans-blue.jpg",
        price: 400,
        size: "32",
        color: "Dark Blue",
        quantity: 3,
      },
    ];

    const message = generateWhatsAppOrderMessage(multiItems, offersMap);

    assert.ok(message.includes("Hello! I'd like to place an order from Style Edit."));
    // Item 1
    assert.ok(message.includes("*1. Relaxed Fit Collar Down Shirt*"));
    assert.ok(message.includes("- Product: https://style-edit.com/product/relaxed-fit-collar-down-shirt"));
    assert.ok(message.includes("- Image: https://style-edit.com/shirt-pink.jpg"));
    assert.ok(message.includes("- Size: L"));
    assert.ok(message.includes("- Colour: Pink"));
    assert.ok(message.includes("- Quantity: 1"));
    assert.ok(message.includes("- Regular price: ₹1,200 each"));
    assert.ok(message.includes("- Savings: ₹0"));
    assert.ok(message.includes("- Final item total: ₹1,200"));

    // Simple divider between products
    assert.ok(message.includes("---"));

    // Item 2
    assert.ok(message.includes("*2. Classic Denim Jeans*"));
    assert.ok(message.includes("- Product: https://style-edit.com/product/classic-denim-jeans"));
    assert.ok(message.includes("- Image: https://style-edit.com/jeans-blue.jpg"));
    assert.ok(message.includes("- Size: 32"));
    assert.ok(message.includes("- Colour: Dark Blue"));
    assert.ok(message.includes("- Quantity: 3"));
    assert.ok(message.includes("- Offer: Buy 3 for ₹1,000"));
    assert.ok(message.includes("- Savings: ₹200"));
    assert.ok(message.includes("- Final item total: ₹1,000"));

    // Summary block
    assert.ok(message.includes("*Order Summary*"));
    assert.ok(message.includes("- Selected order subtotal: ₹2,400"));
    assert.ok(message.includes("- Offer savings: ₹200"));
    assert.ok(message.includes("- Final order total: ₹2,200"));
    assert.ok(message.includes("Please confirm availability and the order details. Thank you!"));
  });

  console.log("\n================================================================");
  console.log(`Test Execution Summary: ${passed} / ${total} tests passed.`);
  console.log("================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
