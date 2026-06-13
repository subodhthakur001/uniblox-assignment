import { config } from "../config";
import {
  getDiscountCode,
  getOrderCount,
  getCodesIssued,
  addDiscountCode,
  incrementCodesIssued,
  generateCodeString,
} from "../store";
import type { DiscountCode } from "../types";
import { AppError } from "./cartService";

/**
 * How many discount codes are owed but not yet minted.
 *
 * Pure function — takes counts as arguments so it can be unit-tested
 * without touching the store.
 *
 * Accumulates across skipped milestones: if orderCount hits 10 but only
 * 1 code was ever minted, pendingCount is 2 - 1 = 1, not 0.
 * Returns 0 immediately after a mint (spam-mint guard).
 */
export function pendingCodeCount(
  orderCount: number,
  codesIssued: number,
  nthOrder: number
): number {
  return Math.floor(orderCount / nthOrder) - codesIssued;
}

/**
 * Compute discount in cents, rounded to nearest cent.
 * Pure — no I/O.
 */
export function computeDiscountCents(subtotalCents: number, percentage: number): number {
  return Math.round((subtotalCents * percentage) / 100);
}

/**
 * Validate a discount code string against the store.
 * Throws AppError if the code doesn't exist or is already used.
 * Returns the DiscountCode record on success.
 */
export function validateDiscountCode(code: string): DiscountCode {
  const dc = getDiscountCode(code);
  if (!dc) {
    throw new AppError(400, "InvalidDiscountCode", `discount code "${code}" does not exist`);
  }
  if (dc.used) {
    throw new AppError(400, "DiscountCodeAlreadyUsed", `discount code "${code}" has already been used`);
  }
  return dc;
}

/**
 * Mint a new discount code if a milestone is pending.
 * Throws AppError(400, "NotEligible") if pendingCodeCount is 0.
 *
 * The read-check-mint is kept synchronous (no await) so two concurrent
 * calls cannot both pass the guard on the same milestone.
 */
export function mintDiscountCode(): DiscountCode {
  const pending = pendingCodeCount(getOrderCount(), getCodesIssued(), config.nthOrder);
  if (pending <= 0) {
    throw new AppError(
      400,
      "NotEligible",
      `no discount code is owed yet (next milestone at order ${(getCodesIssued() + 1) * config.nthOrder})`
    );
  }

  const dc: DiscountCode = {
    code: generateCodeString(),
    percentage: config.discountPercentage,
    used: false,
    mintedAtSequence: getOrderCount(),
  };

  addDiscountCode(dc);
  incrementCodesIssued();
  return dc;
}
