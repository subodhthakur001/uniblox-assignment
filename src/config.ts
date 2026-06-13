// n and x are deployment-time policy, not runtime API.
// See DECISIONS.md: "n/x as config vs runtime API".
const nthOrder = parseInt(process.env.NTH_ORDER ?? "5", 10);
const discountPercentage = parseInt(process.env.DISCOUNT_PERCENTAGE ?? "10", 10);

// Fail fast at startup rather than producing silent wrong results later.
if (!Number.isInteger(nthOrder) || nthOrder < 1) {
  throw new Error(`NTH_ORDER must be a positive integer, got: ${process.env.NTH_ORDER}`);
}
if (!Number.isInteger(discountPercentage) || discountPercentage <= 0 || discountPercentage > 100) {
  throw new Error(
    `DISCOUNT_PERCENTAGE must be an integer in (0, 100], got: ${process.env.DISCOUNT_PERCENTAGE}`
  );
}

export const config = {
  nthOrder,
  discountPercentage,
} as const;
