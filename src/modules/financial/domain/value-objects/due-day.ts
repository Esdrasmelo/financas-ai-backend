import { ValidationError } from "../../../../shared/domain/errors/domain-error.js";

export function assertDueDay(day: number, label = "dia"): void {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new ValidationError(`${label} deve ser inteiro entre 1 e 31`);
  }
}
