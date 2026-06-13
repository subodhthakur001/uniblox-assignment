import { getOrCreateCart, getCart, getProductById } from "../store";
import type { Cart } from "../types";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function addItemToCart(
  cartId: string,
  productId: string,
  quantity: number
): Cart {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(400, "InvalidQuantity", "quantity must be a positive integer");
  }

  const product = getProductById(productId);
  if (!product) {
    throw new AppError(404, "ProductNotFound", `product ${productId} does not exist`);
  }

  const cart = getOrCreateCart(cartId);
  // Merge quantities so adding the same product accumulates rather than replaces.
  const existing = cart.items.get(productId) ?? 0;
  cart.items.set(productId, existing + quantity);

  return cart;
}

export function getCartById(cartId: string): Cart {
  const cart = getCart(cartId);
  if (!cart) {
    throw new AppError(404, "CartNotFound", `cart ${cartId} does not exist`);
  }
  return cart;
}

// Serialise a Cart's Map for JSON output.
export function cartToJSON(cart: Cart): object {
  return {
    id: cart.id,
    items: Object.fromEntries(cart.items),
  };
}
