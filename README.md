# Uniblox In-Memory Ecommerce Backend

A Node.js + TypeScript + Express REST API implementing an ecommerce backend with a milestone-based discount system. All state lives in memory — no database required.

## What it does

- Serve a seeded product catalog
- Manage shopping carts (merge quantities on repeated adds)
- Checkout carts into orders, optionally applying a discount code
- Issue discount codes when every Nth order is placed (configurable)
- Report purchase and revenue stats to admins

## Setup

```bash
npm install
```

## Running

```bash
# Development (ts-node, no build step)
npm run dev

# Production (compile first)
npm run build
npm start
```

The server listens on `http://localhost:3000` by default.

### Environment variables

| Variable             | Default | Description                                      |
|----------------------|---------|--------------------------------------------------|
| `PORT`               | `3000`  | HTTP port                                        |
| `NTH_ORDER`          | `5`     | Mint a code every Nth order                      |
| `DISCOUNT_PERCENTAGE`| `10`    | Percentage off applied by each discount code     |

`NTH_ORDER` and `DISCOUNT_PERCENTAGE` are validated at startup — the process exits with an error if they are out of range.

## Running tests

```bash
npm test
```

All 42 tests run in-memory; each test suite resets the store in `beforeEach`.

---

## Endpoint reference

### Products

#### `GET /products`
Returns the full seeded catalog.

```
GET /products
```

**Response 200:**
```json
[
  { "id": "prod_001", "name": "Wireless Headphones", "priceCents": 7999 },
  ...
]
```

---

### Cart

#### `POST /cart/items`
Add a product to a cart (creates the cart if it doesn't exist). Adding the same product merges quantities.

```
POST /cart/items
Content-Type: application/json

{
  "cartId": "my-cart",
  "productId": "prod_001",
  "quantity": 2
}
```

**Response 200:** current cart state  
**Response 400:** `InvalidQuantity` — quantity ≤ 0  
**Response 404:** `ProductNotFound` — unknown productId  

#### `GET /cart/:cartId`
Fetch a cart by ID.

**Response 200:** cart with items map  
**Response 404:** `CartNotFound`

---

### Checkout

#### `POST /checkout`
Convert a cart into an order. Optionally apply a discount code.

```
POST /checkout
Content-Type: application/json

{
  "cartId": "my-cart",
  "discountCode": "ABC12345"   // optional
}
```

**Response 201:** the created order  
**Response 400:** `EmptyCart` — cart has no items  
**Response 400:** `InvalidDiscountCode` — code does not exist  
**Response 400:** `DiscountCodeAlreadyUsed` — code was already redeemed  

The entire checkout is rejected if the code is invalid — the order is never partially created.

---

### Admin

#### `POST /admin/discount-code`
Mint a new discount code. Only succeeds when `floor(orderCount / NTH_ORDER) - codesIssued > 0`.

```
POST /admin/discount-code
```

**Response 201:** the new discount code  
**Response 400:** `NotEligible` — no milestone is pending yet  

#### `GET /admin/stats`
Revenue and discount summary across all orders.

```
GET /admin/stats
```

**Response 200:**
```json
{
  "itemsPurchased": 12,
  "totalRevenueCents": 98400,
  "totalDiscountCents": 1600,
  "discountCodes": [
    {
      "code": "ABC12345",
      "percentage": 10,
      "used": true,
      "mintedAtSequence": 5,
      "redeemedByOrderId": "uuid-..."
    }
  ]
}
```

Invariant: `totalRevenueCents + totalDiscountCents === sum of all order subtotals`.

---

## Error shape

All error responses use a consistent envelope:

```json
{
  "error": {
    "code": "InvalidDiscountCode",
    "message": "discount code \"XYZ\" does not exist"
  }
}
```
