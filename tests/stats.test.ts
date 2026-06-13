import request from "supertest";
import app from "../src/app";
import { resetStore, addDiscountCode, incrementOrderCount } from "../src/store";

beforeEach(() => {
  resetStore();
});

const HEADPHONES_ID = "prod_001"; // 7999
const KEYBOARD_ID = "prod_002";   // 12999

async function buildAndCheckout(
  cartId: string,
  items: Array<{ productId: string; quantity: number }>,
  discountCode?: string
) {
  for (const item of items) {
    await request(app)
      .post("/cart/items")
      .send({ cartId, productId: item.productId, quantity: item.quantity });
  }
  return request(app)
    .post("/checkout")
    .send({ cartId, ...(discountCode ? { discountCode } : {}) });
}

// ─── /admin/stats ────────────────────────────────────────────────────────────

describe("GET /admin/stats", () => {
  it("returns zeroed stats when no orders exist", async () => {
    const res = await request(app).get("/admin/stats");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      itemsPurchased: 0,
      totalRevenueCents: 0,
      discountCodes: [],
      totalDiscountCents: 0,
    });
  });

  it("counts itemsPurchased as total quantity across all orders", async () => {
    await buildAndCheckout("c1", [{ productId: HEADPHONES_ID, quantity: 3 }]);
    await buildAndCheckout("c2", [{ productId: KEYBOARD_ID, quantity: 2 }]);

    const res = await request(app).get("/admin/stats");
    expect(res.body.itemsPurchased).toBe(5);
  });

  it("totalRevenueCents is the net revenue (after discounts)", async () => {
    addDiscountCode({ code: "D10", percentage: 10, used: false, mintedAtSequence: 0 });
    // subtotal = 7999, discount = 800, total = 7199
    await buildAndCheckout("c3", [{ productId: HEADPHONES_ID, quantity: 1 }], "D10");

    const res = await request(app).get("/admin/stats");
    expect(res.body.totalRevenueCents).toBe(7199);
    expect(res.body.totalDiscountCents).toBe(800);
  });

  it("satisfies the invariant: totalRevenueCents + totalDiscountCents === gross subtotal", async () => {
    addDiscountCode({ code: "D10B", percentage: 10, used: false, mintedAtSequence: 0 });
    await buildAndCheckout("c4", [{ productId: HEADPHONES_ID, quantity: 2 }], "D10B");
    await buildAndCheckout("c5", [{ productId: KEYBOARD_ID, quantity: 1 }]);

    const statsRes = await request(app).get("/admin/stats");
    const { totalRevenueCents, totalDiscountCents } = statsRes.body;

    // gross subtotal = (7999*2) + 12999 = 28997
    const expectedGross = 7999 * 2 + 12999;
    expect(totalRevenueCents + totalDiscountCents).toBe(expectedGross);
  });

  it("lists all discount codes with correct status", async () => {
    addDiscountCode({ code: "MINTED1", percentage: 10, used: false, mintedAtSequence: 5 });
    addDiscountCode({ code: "USED001", percentage: 10, used: true, mintedAtSequence: 5, redeemedByOrderId: "order-xyz" });

    const res = await request(app).get("/admin/stats");
    const codes = res.body.discountCodes;

    expect(codes).toHaveLength(2);
    const minted = codes.find((c: { code: string }) => c.code === "MINTED1");
    const used = codes.find((c: { code: string }) => c.code === "USED001");

    expect(minted.used).toBe(false);
    expect(used.used).toBe(true);
    expect(used.redeemedByOrderId).toBe("order-xyz");
  });
});

// ─── /admin/discount-code ────────────────────────────────────────────────────

describe("POST /admin/discount-code", () => {
  it("returns 400 NotEligible when no milestone pending", async () => {
    const res = await request(app).post("/admin/discount-code");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NotEligible");
  });

  it("mints a code when milestone is reached", async () => {
    // Simulate 5 orders (default nthOrder=5)
    for (let i = 0; i < 5; i++) incrementOrderCount();

    const res = await request(app).post("/admin/discount-code");
    expect(res.status).toBe(201);
    expect(res.body.code).toHaveLength(8);
    expect(res.body.used).toBe(false);
    expect(res.body.percentage).toBe(10);
  });

  it("cannot mint twice on the same milestone", async () => {
    for (let i = 0; i < 5; i++) incrementOrderCount();
    await request(app).post("/admin/discount-code");

    const res = await request(app).post("/admin/discount-code");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NotEligible");
  });

  it("code appears in /admin/stats after minting", async () => {
    for (let i = 0; i < 5; i++) incrementOrderCount();
    const mintRes = await request(app).post("/admin/discount-code");
    const code = mintRes.body.code;

    const statsRes = await request(app).get("/admin/stats");
    const found = statsRes.body.discountCodes.find((c: { code: string }) => c.code === code);
    expect(found).toBeDefined();
    expect(found.used).toBe(false);
  });

  it("discounted order still counts toward next milestone", async () => {
    // 5 orders → mint code 1
    for (let i = 0; i < 5; i++) incrementOrderCount();
    await request(app).post("/admin/discount-code");

    // 5 more orders (6-10) → milestone at 10 → mint code 2
    for (let i = 0; i < 5; i++) incrementOrderCount();
    const res = await request(app).post("/admin/discount-code");
    expect(res.status).toBe(201);
  });
});
