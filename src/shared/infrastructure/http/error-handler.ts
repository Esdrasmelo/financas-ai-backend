import type { NextFunction, Request, Response } from "express";
import { DomainError, NotFoundError, ValidationError } from "../../domain/errors/domain-error.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof DomainError) {
    res.status(422).json({ error: err.code, message: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "INTERNAL", message: "Erro interno" });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}
