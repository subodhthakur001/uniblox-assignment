import { Router, Request, Response, NextFunction } from "express";
import { addItemToCart, getCartById, cartToJSON } from "../services/cartService";

const router = Router();

router.post("/items", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cartId, productId, quantity } = req.body;

    if (!cartId || typeof cartId !== "string") {
      res.status(400).json({ error: { code: "MissingField", message: "cartId is required" } });
      return;
    }
    if (!productId || typeof productId !== "string") {
      res.status(400).json({ error: { code: "MissingField", message: "productId is required" } });
      return;
    }

    const cart = addItemToCart(cartId, productId, quantity);
    res.status(200).json(cartToJSON(cart));
  } catch (err) {
    next(err);
  }
});

router.get("/:cartId", (req: Request, res: Response, next: NextFunction) => {
  try {
    const cart = getCartById(req.params.cartId);
    res.json(cartToJSON(cart));
  } catch (err) {
    next(err);
  }
});

export default router;
