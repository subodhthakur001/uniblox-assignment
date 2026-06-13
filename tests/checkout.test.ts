import request from "supertest";
import app from "../src/app";
import { resetStore, addDiscountCode, getStore } from "../src/store";

beforeEach(() => {
  resetStore();
});

const HEADPHONES_ID = "prod_001"; // priceCents: 7999
const KEYBOARD_ID = "prod_002";   // priceCents: 12999

async function buildCart(cartId: string, items: Array<{ productId: string; quantity: number }>) {
  for (const item of items) {
    await request(app)
      .post("/cart/items")
      .send({ cartId, productId: item.productId, quantity: item.quantity });
  }
}

// ─── Happy path — no discount ────────────────────────────────────────────────

describe("POST /checkout — happy path (no discount)", () => {
  it("creates an order and returns 201", async () => {
    await buildCart("cart1", [{ productId: HEADPHONES_ID, quantity: 2 }]);

    const res = await request(app).post("/checkout").send({ cartId: "cart1" });

    expect(res.status).toBe(201);
    expect(res.body.sequence).toBe(1);
    expect(res.body.subtotalCents).toBe(7999 * 2);
    expect(res.body.discountCents).toBe(0);
    expect(res.body.totalCents).toBe(7999 * 2);
    expect(res.body.discountCode).toBeUndefined();
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe("Wireless Headphones");
  });

  it("increments global orderCount", async () => {
    await buildCart("cart2", [{ productId: HEADPHONES_ID, quantity: 1 }]);
    await request(app).post("/checkout").send({ cartId: "cart2" });
    expect(getStore().orderCount).toBe(1);
  });

  it("clears the cart after checkout", async () => {
    await buildCart("cart3", [{ productId: HEADPHONES_ID, quantity: 1 }]);
    await request(app).post("/checkout").send({ cartId: "cart3" });

    const cartRes = await request(app).get("/cart/cart3");
    expect(cartRes.body.items).toEqual({});
  });

  it("snapshots product name and price at purchase time", async () => {
    await buildCart("cart4", [{ productId: KEYBOARD_ID, quantity: 1 }]);
    const res = await request(app).post("/checkout").send({ cartId: "cart4" });

    const item = res.body.items[0];
    expect(item.name).toBe("Mechanical Keyboard");
    expect(item.unitPriceCents).toBe(12999);
  });
});

// ─── Happy path — with discount ──────────────────────────────────────────────

describe("POST /checkout — with valid discount code", () => {
  it("applies the discount and returns correct totals", async () => {
    addDiscountCode({ code: "SAVE10", percentage: 10, used: false, mintedAtSequence: 0 });
    await buildCart("cart5", [{ productId: HEADPHONES_ID, quantity: 1 }]);

    const res = await request(app)
      .post("/checkout")
      .send({ cartId: "cart5", discountCode: "SAVE10" });

    expect(res.status).toBe(201);
    expect(res.body.subtotalCents).toBe(7999);
    expect(res.body.discountCents).toBe(800); // round(7999 * 10 / 100) = 800
    expect(res.body.totalCents).toBe(7199);
    expect(res.body.discountCode).toBe("SAVE10");
  });

  it("marks the code as used after checkout", async () => {
    addDiscountCode({ code: "SAVE10B", percentage: 10, used: false, mintedAtSequence: 0 });
    await buildCart("cart6", [{ productId: HEADPHONES_ID, quantity: 1 }]);
    await request(app).post("/checkout").send({ cartId: "cart6", discountCode: "SAVE10B" });

    expect(getStore().discountCodes.get("SAVE10B")!.used).toBe(true);
  });

  it("stores the orderId on the redeemed code", async () => {
    addDiscountCode({ code: "SAVE10C", percentage: 10, used: false, mintedAtSequence: 0 });
    await buildCart("cart7", [{ productId: HEADPHONES_ID, quantity: 1 }]);
    const res = await request(app).post("/checkout").send({ cartId: "cart7", discountCode: "SAVE10C" });

    const dc = getStore().discountCodes.get("SAVE10C")!;
    expect(dc.redeemedByOrderId).toBe(res.body.id);
  });
});

// ─── Empty cart ───────────────────────────────────────────────────────────────

describe("POST /checkout — empty cart", () => {
  it("returns 400 EmptyCart for a cart with no items", async () => {
    const res = await request(app).post("/checkout").send({ cartId: "empty-cart" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("EmptyCart");
  });

  it("returns 400 EmptyCart for a cart that was cleared after checkout", async () => {
    await buildCart("cart8", [{ productId: HEADPHONES_ID, quantity: 1 }]);
    await request(app).post("/checkout").send({ cartId: "cart8" });

    // Second checkout on same (now empty) cart
    const res = await request(app).post("/checkout").send({ cartId: "cart8" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("EmptyCart");
  });
});

// ─── Invalid discount code ───────────────────────────────────────────────────

describe("POST /checkout — invalid discount code", () => {
  it("rejects with 400 when code does not exist", async () => {
    await buildCart("cart9", [{ productId: HEADPHONES_ID, quantity: 1 }]);
    const res = await request(app)
      .post("/checkout")
      .send({ cartId: "cart9", discountCode: "FAKECODE" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("InvalidDiscountCode");
  });

  it("does NOT increment orderCount when code is invalid (whole checkout fails)", async () => {
    await buildCart("cart10", [{ productId: HEADPHONES_ID, quantity: 1 }]);
    await request(app).post("/checkout").send({ cartId: "cart10", discountCode: "FAKECODE" });
    expect(getStore().orderCount).toBe(0);
  });
});

// ─── Double-redemption prevention ───────────────────────────────────────────

describe("POST /checkout — double-redemption", () => {
  it("rejects the second use of a code with 400 DiscountCodeAlreadyUsed", async () => {
    addDiscountCode({ code: "ONCE0001", percentage: 10, used: false, mintedAtSequence: 0 });

    await buildCart("cartA", [{ productId: HEADPHONES_ID, quantity: 1 }]);
    await request(app).post("/checkout").send({ cartId: "cartA", discountCode: "ONCE0001" });

    await buildCart("cartB", [{ productId: HEADPHONES_ID, quantity: 1 }]);
    const res = await request(app).post("/checkout").send({ cartId: "cartB", discountCode: "ONCE0001" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("DiscountCodeAlreadyUsed");
  });
});

// ─── Sequence numbers ────────────────────────────────────────────────────────

describe("POST /checkout — sequence numbers", () => {
  it("assigns sequence 1 to the first order and 2 to the second", async () => {
    await buildCart("cartC", [{ productId: HEADPHONES_ID, quantity: 1 }]);
    const r1 = await request(app).post("/checkout").send({ cartId: "cartC" });

    await buildCart("cartD", [{ productId: HEADPHONES_ID, quantity: 1 }]);
    const r2 = await request(app).post("/checkout").send({ cartId: "cartD" });

    expect(r1.body.sequence).toBe(1);
    expect(r2.body.sequence).toBe(2);
  });
});
