import type { NextFunction, Request, Response } from "express";
import { AuthenticationError, DomainError, NotFoundError, ValidationError } from "../../domain/errors/domain-error.js";
import { logger } from "../logger/logger.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AuthenticationError) {
    logger.warn(`${req.method} ${req.originalUrl} → 401 ${err.code}: ${err.message}`);
    res.status(401).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof NotFoundError) {
    logger.warn(`${req.method} ${req.originalUrl} → 404 ${err.code}: ${err.message}`);
    res.status(404).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof ValidationError) {
    logger.warn(`${req.method} ${req.originalUrl} → 400 ${err.code}: ${err.message}`);
    res.status(400).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof DomainError) {
    logger.warn(`${req.method} ${req.originalUrl} → 422 ${err.code}: ${err.message}`);
    res.status(422).json({ error: err.code, message: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(`${req.method} ${req.originalUrl} → 500 INTERNAL: ${message}`);
  if (stack) logger.debug(stack);

  res.status(500).json({ error: "INTERNAL", message: "Erro interno do servidor. Tente novamente mais tarde." });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}
