import { ValidationError } from "../../../../shared/domain/errors/domain-error.js";

const RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseCompetencyMonth(value: string): string {
  if (!RE.test(value)) {
    throw new ValidationError("competencyMonth deve estar no formato YYYY-MM");
  }
  return value;
}

export function competencyMonthFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function addMonthsToCompetencyMonth(ym: string, delta: number): string {
  const [ys, ms] = ym.split("-").map(Number);
  const base = new Date(Date.UTC(ys, ms - 1 + delta, 1));
  return competencyMonthFromDate(base);
}
