import { v4 as uuidv4 } from "uuid";
import type { Product, Cart, Order, DiscountCode } from "../types";

// Seeded product catalog — fixed at startup, never mutated.
const SEED_PRODUCTS: Product[] = [
  { id: "prod_001", name: "Wireless Headphones", priceCents: 7999 },
  { id: "prod_002", name: "Mechanical Keyboard", priceCents: 12999 },
  { id: "prod_003", name: "USB-C Hub", priceCents: 3499 },
  { id: "prod_004", name: "Webcam 1080p", priceCents: 5999 },
  { id: "prod_005", name: "Desk Lamp LED", priceCents: 2499 },
];

interface Store {
  products: Product[];
  carts: Map<string, Cart>;
  orders: Order[];
  orderCount: number;   // increments on every successful checkout
  codesIssued: number;  // increments on every minted discount code
  discountCodes: Map<string, DiscountCode>; // code string -> DiscountCode
}

// Single mutable store instance shared across the app.
let store: Store = createFreshStore();

function createFreshStore(): Store {
  return {
    products: SEED_PRODUCTS,
    carts: new Map(),
    orders: [],
    orderCount: 0,
    codesIssued: 0,
    discountCodes: new Map(),
  };
}

// Replace the store with a clean slate — used by tests to avoid cross-test pollution.
export function resetStore(): void {
  store = createFreshStore();
}

export function getStore(): Store {
  return store;
}

// Convenience helpers so callers don't import getStore everywhere.

export function getProducts(): Product[] {
  return store.products;
}

export function getProductById(id: string): Product | undefined {
  return store.products.find((p) => p.id === id);
}

export function getCart(id: string): Cart | undefined {
  return store.carts.get(id);
}

export function getOrCreateCart(id: string): Cart {
  if (!store.carts.has(id)) {
    store.carts.set(id, { id, items: new Map() });
  }
  return store.carts.get(id)!;
}

export function getDiscountCode(code: string): DiscountCode | undefined {
  return store.discountCodes.get(code);
}

export function addDiscountCode(dc: DiscountCode): void {
  store.discountCodes.set(dc.code, dc);
}

export function getAllDiscountCodes(): DiscountCode[] {
  return Array.from(store.discountCodes.values());
}

export function getOrders(): Order[] {
  return store.orders;
}

export function pushOrder(order: Order): void {
  store.orders.push(order);
}

export function incrementOrderCount(): number {
  store.orderCount += 1;
  return store.orderCount;
}

export function incrementCodesIssued(): void {
  store.codesIssued += 1;
}

export function getOrderCount(): number {
  return store.orderCount;
}

export function getCodesIssued(): number {
  return store.codesIssued;
}

// Generate a short alphanumeric code string for discount codes.
export function generateCodeString(): string {
  return uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase();
}
