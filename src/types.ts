export interface Product {
  id: string;
  name: string;
  priceCents: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Cart {
  id: string;
  // Map serialised as plain object for JSON responses; internally a Map
  items: Map<string, number>; // productId -> quantity
}

export interface OrderItem {
  productId: string;
  name: string;         // snapshotted at purchase time
  unitPriceCents: number; // snapshotted at purchase time
  quantity: number;
  lineTotalCents: number;
}

export interface Order {
  id: string;
  sequence: number;      // 1-based global order counter value at time of purchase
  items: OrderItem[];
  subtotalCents: number;
  discountCode?: string;
  discountCents: number;
  totalCents: number;
  createdAt: string;     // ISO timestamp
}

export interface DiscountCode {
  code: string;
  percentage: number;    // e.g. 10 means 10%
  used: boolean;
  mintedAtSequence: number; // orderCount at the time this code was minted
  redeemedByOrderId?: string;
}
