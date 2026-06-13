import { getProducts, getProductById } from "../store";
import type { Product } from "../types";

export function listProducts(): Product[] {
  return getProducts();
}

export function findProduct(id: string): Product | undefined {
  return getProductById(id);
}
