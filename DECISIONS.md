# Architecture Decisions

---

## Decision: Integer Cents for Money

**Context:**  
The system needs to store, compute, and return monetary values. JavaScript's floating-point numbers (IEEE 754) cause rounding errors with decimal arithmetic — `0.1 + 0.2 !== 0.3`. Discount calculations involve multiplication and division, making accumulated error a real risk.

**Options Considered:**  
- **Option A:** Store money as floating-point dollars (e.g., `79.99`)  
- **Option B:** Store money as integer cents (e.g., `7999`)

**Choice:** Option B — integer cents throughout.

**Why:**  
Integer arithmetic in JavaScript is exact up to `Number.MAX_SAFE_INTEGER` (≈ 9 quadrillion cents). There are no rounding surprises in addition, subtraction, or comparison. The only place rounding is needed is the single `Math.round` in `computeDiscountCents` when dividing by 100 — one explicit rounding call is far easier to reason about than floating-point drift accumulating across multiple operations. Values are only converted to decimal strings at the API response boundary.

---

## Decision: n and x as Config/Env, Not a Runtime API

**Context:**  
The system needs two parameters: `n` (every Nth order triggers a discount code) and `x` (the discount percentage). These could be configurable via a runtime admin API or baked in as deployment-time config.

**Options Considered:**  
- **Option A:** Expose `POST /admin/config { nthOrder, discountPercentage }` so operators can change them live  
- **Option B:** Read `NTH_ORDER` and `DISCOUNT_PERCENTAGE` from environment variables, validated at startup

**Choice:** Option B — environment variables.

**Why:**  
These parameters define discount policy for the business, not operational tuning. Changing them mid-flight would retroactively invalidate the meaning of already-issued codes and previously counted milestones (e.g., changing n from 5 to 3 after 8 orders would suddenly owe codes that were never expected). Making them deployment-time config makes the policy boundary explicit: update the env var and restart to change policy, with a clean slate or deliberate migration. The startup validation (fail fast if out of range) prevents silent misconfiguration.

---

## Decision: Global Order Count, Not Per-Customer

**Context:**  
The milestone counter that triggers discount code eligibility (`orderCount`) could be tracked per-customer (each customer gets a code every Nth purchase) or globally across all customers (the store issues a code every Nth order store-wide).

**Options Considered:**  
- **Option A:** Per-customer order count — each customer independently earns codes every N orders  
- **Option B:** Global order count — a single counter across all carts and customers

**Choice:** Option B — global count.

**Why:**  
The spec describes a store-level promotional mechanic, not a loyalty program. A global counter creates a shared milestone that's meaningful to the business (e.g., "we celebrate every 5th sale") and is simpler to implement without a customer identity system. Per-customer counting would require authentication or persistent customer IDs, which are out of scope. It also prevents a single high-volume customer from exhausting code supply while other customers receive none.

---

## Decision: Reject Entire Checkout on Invalid/Used Discount Code

**Context:**  
When a discount code is provided at checkout but is invalid (doesn't exist) or already used, the system must decide how to handle the order.

**Options Considered:**  
- **Option A:** Silently degrade — ignore the bad code and charge full price  
- **Option B:** Hard reject — return 400 and refuse to create the order

**Choice:** Option B — hard reject.

**Why:**  
Silent degradation is surprising and creates a trust problem: the customer believes they applied a discount, but the confirmation shows full price. Discovering this after the fact (in an order confirmation email, for example) destroys trust more than a clear upfront error. A 400 with an explicit error code lets the caller surface a meaningful message ("this code has already been used") so the customer can correct the situation before completing payment. It also prevents accidental double-charges in automated flows.

---

## Decision: Synchronous Critical Section for Checkout Atomicity

**Context:**  
Checkout involves multiple writes that must be consistent: incrementing `orderCount`, marking a discount code as used, and pushing the order. In a concurrent environment, two simultaneous checkout requests using the same discount code could both pass validation and then both commit — resulting in a code being used twice.

**Options Considered:**  
- **Option A:** Use an async lock (e.g., a mutex library) around the critical section  
- **Option B:** Keep the critical section fully synchronous — no `await` between validation and commit

**Choice:** Option B — exploit Node's single-threaded event loop.

**Why:**  
Node.js executes JavaScript on a single thread. The event loop only switches between concurrent requests at `await` points. As long as the sequence `[increment orderCount → mark code used → push order]` contains no `await`, it is guaranteed to run to completion without interleaving — effectively atomic without any locking primitive. This is not an accident or a hack: it is the documented, well-understood execution model of Node. Adding an async mutex would introduce complexity and the risk of deadlock for no benefit in a single-threaded runtime. The critical section is annotated with a comment explaining this invariant so future maintainers understand why `await` must not be added inside it.
