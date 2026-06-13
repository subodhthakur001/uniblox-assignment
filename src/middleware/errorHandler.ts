import { Request, Response, NextFunction } from "express";
import { AppError } from "../services/cartService";

// Centralised error handler — all thrown AppErrors land here as structured JSON.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: { code: "InternalError", message: "An unexpected error occurred" },
  });
}
