import { getOrders, getAllDiscountCodes } from "../store";
import { mintDiscountCode } from "./discountService";
import type { DiscountCode } from "../types";

export interface DiscountCodeStatus {
  code: string;
  percentage: number;
  used: boolean;
  mintedAtSequence: number;
  redeemedByOrderId?: string;
}

export interface StatsResult {
  itemsPurchased: number;
  totalRevenueCents: number;
  discountCodes: DiscountCodeStatus[];
  totalDiscountCents: number;
}

export function getStats(): StatsResult {
  const orders = getOrders();

  const itemsPurchased = orders.reduce(
    (sum, order) => sum + order.items.reduce((s, item) => s + item.quantity, 0),
    0
  );

  // Net revenue after discounts — invariant: totalRevenueCents + totalDiscountCents === gross subtotal
  const totalRevenueCents = orders.reduce((sum, order) => sum + order.totalCents, 0);

  const totalDiscountCents = orders.reduce((sum, order) => sum + order.discountCents, 0);

  const discountCodes: DiscountCodeStatus[] = getAllDiscountCodes().map((dc: DiscountCode) => ({
    code: dc.code,
    percentage: dc.percentage,
    used: dc.used,
    mintedAtSequence: dc.mintedAtSequence,
    ...(dc.redeemedByOrderId ? { redeemedByOrderId: dc.redeemedByOrderId } : {}),
  }));

  return { itemsPurchased, totalRevenueCents, discountCodes, totalDiscountCents };
}

export { mintDiscountCode };
