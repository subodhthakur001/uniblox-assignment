import { Router, Request, Response, NextFunction } from "express";
import { checkout } from "../services/checkoutService";

const router = Router();

router.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cartId, discountCode } = req.body;

    if (!cartId || typeof cartId !== "string") {
      res.status(400).json({ error: { code: "MissingField", message: "cartId is required" } });
      return;
    }

    const { order } = checkout(cartId, discountCode);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

export default router;
