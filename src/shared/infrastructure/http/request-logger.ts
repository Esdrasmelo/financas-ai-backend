import type { NextFunction, Request, Response } from "express";
import { logger } from "../logger/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();

  res.on("finish", () => {
    const duration = performance.now() - start;
    logger.request(req.method, req.originalUrl, res.statusCode, duration);
  });

  next();
}
