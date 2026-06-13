import { resetStore, getStore, addDiscountCode, incrementCodesIssued, incrementOrderCount } from "../src/store";
import {
  pendingCodeCount,
  computeDiscountCents,
  validateDiscountCode,
  mintDiscountCode,
} from "../src/services/discountService";
import { AppError } from "../src/services/cartService";

beforeEach(() => {
  resetStore();
  // Override config defaults by resetting env (config module is loaded once,
  // so we test pendingCodeCount as a pure function with explicit args instead).
});

// ─── pendingCodeCount (pure function) ────────────────────────────────────────

describe("pendingCodeCount", () => {
  it("returns 0 when no orders yet", () => {
    expect(pendingCodeCount(0, 0, 5)).toBe(0);
  });

  it("returns 0 just before the first milestone", () => {
    expect(pendingCodeCount(4, 0, 5)).toBe(0);
  });

  it("returns 1 at the first milestone", () => {
    expect(pendingCodeCount(5, 0, 5)).toBe(1);
  });

  it("returns 0 immediately after minting (spam-mint guard)", () => {
    // 5 orders, 1 code already issued
    expect(pendingCodeCount(5, 1, 5)).toBe(0);
  });

  it("accumulates if milestones are skipped", () => {
    // 15 orders but only 1 code minted → owed 3 - 1 = 2
    expect(pendingCodeCount(15, 1, 5)).toBe(2);
  });

  it("accumulates across multiple skipped milestones", () => {
    expect(pendingCodeCount(20, 0, 5)).toBe(4);
  });

  it("works with nthOrder = 1", () => {
    expect(pendingCodeCount(3, 2, 1)).toBe(1);
  });
});

// ─── computeDiscountCents (pure function) ────────────────────────────────────

describe("computeDiscountCents", () => {
  it("computes 10% of 1000 cents = 100", () => {
    expect(computeDiscountCents(1000, 10)).toBe(100);
  });

  it("rounds 0.5 up (Math.round semantics)", () => {
    // 10% of 1005 = 100.5 → rounds to 101
    expect(computeDiscountCents(1005, 10)).toBe(101);
  });

  it("handles 100% discount", () => {
    expect(computeDiscountCents(5000, 100)).toBe(5000);
  });

  it("handles an odd percentage", () => {
    // 15% of 200 = 30
    expect(computeDiscountCents(200, 15)).toBe(30);
  });

  it("handles zero subtotal", () => {
    expect(computeDiscountCents(0, 10)).toBe(0);
  });
});

// ─── validateDiscountCode ────────────────────────────────────────────────────

describe("validateDiscountCode", () => {
  it("throws InvalidDiscountCode when code does not exist", () => {
    expect(() => validateDiscountCode("GHOST123")).toThrow(AppError);
    try {
      validateDiscountCode("GHOST123");
    } catch (e) {
      expect((e as AppError).code).toBe("InvalidDiscountCode");
      expect((e as AppError).statusCode).toBe(400);
    }
  });

  it("throws DiscountCodeAlreadyUsed when code is used", () => {
    addDiscountCode({ code: "USED1234", percentage: 10, used: true, mintedAtSequence: 5 });
    expect(() => validateDiscountCode("USED1234")).toThrow(AppError);
    try {
      validateDiscountCode("USED1234");
    } catch (e) {
      expect((e as AppError).code).toBe("DiscountCodeAlreadyUsed");
    }
  });

  it("returns the code record when valid", () => {
    addDiscountCode({ code: "VALID001", percentage: 10, used: false, mintedAtSequence: 5 });
    const dc = validateDiscountCode("VALID001");
    expect(dc.code).toBe("VALID001");
    expect(dc.used).toBe(false);
  });
});

// ─── mintDiscountCode ─────────────────────────────────────────────────────────

describe("mintDiscountCode", () => {
  it("throws NotEligible when no milestone is pending", () => {
    // orderCount=0, codesIssued=0 → pendingCodeCount=0
    expect(() => mintDiscountCode()).toThrow(AppError);
    try {
      mintDiscountCode();
    } catch (e) {
      expect((e as AppError).code).toBe("NotEligible");
    }
  });

  it("mints successfully when milestone is pending", () => {
    // Simulate 5 orders (default nthOrder)
    for (let i = 0; i < 5; i++) incrementOrderCount();
    const dc = mintDiscountCode();
    expect(dc.used).toBe(false);
    expect(dc.code).toHaveLength(8);
  });

  it("cannot mint a second code immediately after minting (spam-mint guard)", () => {
    for (let i = 0; i < 5; i++) incrementOrderCount();
    mintDiscountCode();
    expect(() => mintDiscountCode()).toThrow(AppError);
    try {
      mintDiscountCode();
    } catch (e) {
      expect((e as AppError).code).toBe("NotEligible");
    }
  });

  it("increments codesIssued after minting", () => {
    for (let i = 0; i < 5; i++) incrementOrderCount();
    mintDiscountCode();
    expect(getStore().codesIssued).toBe(1);
  });
});
