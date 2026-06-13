import { Router, Request, Response, NextFunction } from "express";
import { getStats, mintDiscountCode } from "../services/adminService";

const router = Router();

// Mint a new discount code — only succeeds if a milestone is pending.
// The read-check-mint in mintDiscountCode is synchronous (no await),
// so two concurrent calls cannot both pass the pending guard.
router.post("/discount-code", (req: Request, res: Response, next: NextFunction) => {
  try {
    const dc = mintDiscountCode();
    res.status(201).json(dc);
  } catch (err) {
    next(err);
  }
});

router.get("/stats", (_req: Request, res: Response) => {
  res.json(getStats());
});

export default router;
