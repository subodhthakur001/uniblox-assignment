import express from "express";
import "./config"; // validates NTH_ORDER and DISCOUNT_PERCENTAGE at startup
import productsRouter from "./routes/products";
import cartRouter from "./routes/cart";
import checkoutRouter from "./routes/checkout";
import adminRouter from "./routes/admin";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(express.json());

app.use("/products", productsRouter);
app.use("/cart", cartRouter);
app.use("/checkout", checkoutRouter);
app.use("/admin", adminRouter);

app.use(errorHandler);

const PORT = process.env.PORT ?? 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
