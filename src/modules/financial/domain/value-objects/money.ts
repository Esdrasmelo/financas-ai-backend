import { ValidationError } from "../../../../shared/domain/errors/domain-error.js";

export function assertNonNegativeCents(cents: number, field = "valor"): void {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new ValidationError(`${field} em centavos deve ser inteiro >= 0`);
  }
}

export function toCents(amount: number): number {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new ValidationError("valor numérico inválido");
  }
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}
