import { v4 as uuidv4 } from "uuid";
import { getCart, getProductById, pushOrder, incrementOrderCount } from "../store";
import { validateDiscountCode, computeDiscountCents } from "./discountService";
import type { Order, OrderItem } from "../types";
import type { DiscountCode } from "../types";
import { AppError } from "./cartService";

export interface CheckoutResult {
  order: Order;
}

export function checkout(cartId: string, discountCode?: string): CheckoutResult {
  // Step 1: load cart and reject if empty.
  const cart = getCart(cartId);
  if (!cart || cart.items.size === 0) {
    throw new AppError(400, "EmptyCart", "cart is empty or does not exist");
  }

  // Step 2: snapshot items and compute subtotal.
  const orderItems: OrderItem[] = [];
  for (const [productId, quantity] of cart.items) {
    const product = getProductById(productId);
    // Products are seeded at startup and never removed, so this would only
    // fail if the store was tampered with externally.
    if (!product) {
      throw new AppError(500, "InternalError", `product ${productId} no longer exists`);
    }
    const lineTotalCents = product.priceCents * quantity;
    orderItems.push({
      productId,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity,
      lineTotalCents,
    });
  }
  const subtotalCents = orderItems.reduce((sum, item) => sum + item.lineTotalCents, 0);

  // Step 3: validate discount code BEFORE committing anything.
  // An invalid or used code rejects the whole checkout — no silent degradation.
  let validatedCode: DiscountCode | undefined;
  if (discountCode) {
    validatedCode = validateDiscountCode(discountCode); // throws AppError on failure
  }

  const discountCents = validatedCode
    ? computeDiscountCents(subtotalCents, validatedCode.percentage)
    : 0;
  const totalCents = subtotalCents - discountCents;

  // ─── CRITICAL SECTION ────────────────────────────────────────────────────
  // Node.js is single-threaded: as long as there is NO await between here and
  // the closing brace, no other request can interleave. This makes the
  // read-then-write on the discount code and orderCount effectively atomic —
  // two simultaneous POST /checkout calls with the same code cannot both pass
  // step 3 and then both commit here.
  const sequence = incrementOrderCount();
  const orderId = uuidv4();

  if (validatedCode) {
    validatedCode.used = true;
    validatedCode.redeemedByOrderId = orderId;
  }

  const order: Order = {
    id: orderId,
    sequence,
    items: orderItems,
    subtotalCents,
    discountCode: validatedCode?.code,
    discountCents,
    totalCents,
    createdAt: new Date().toISOString(),
  };

  pushOrder(order);
  // ─── END CRITICAL SECTION ─────────────────────────────────────────────────

  // Clear the cart after successful checkout.
  cart.items.clear();

  return { order };
}
