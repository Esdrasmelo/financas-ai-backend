import { addMonthsToCompetencyMonth } from "../../../financial/domain/value-objects/competency-month.js";

/**
 * referenceMonth YYYY-MM = mês de fechamento do ciclo.
 * Compra **no dia do fechamento** conta na **próxima** fatura (não na que fecha nesse dia).
 */
export function purchaseToClosingReferenceMonth(purchaseDate: Date, closingDay: number): string {
  const y = purchaseDate.getUTCFullYear();
  const m0 = purchaseDate.getUTCMonth();
  const d = purchaseDate.getUTCDate();
  if (d < closingDay) {
    return `${y}-${String(m0 + 1).padStart(2, "0")}`;
  }
  const next = new Date(Date.UTC(y, m0 + 1, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Último instante UTC incluído no período da fatura (compras no `closingDay` já são da fatura seguinte). */
function periodEndInclusiveUtc(referenceMonth: string, closingDay: number): Date {
  const [ys, ms] = referenceMonth.split("-").map(Number);
  const closingM0 = ms - 1;
  const y = ys;
  const lastInMonth = new Date(Date.UTC(y, closingM0 + 1, 0)).getUTCDate();

  if (closingDay > 1) {
    const endDay = Math.min(closingDay - 1, lastInMonth);
    return new Date(Date.UTC(y, closingM0, endDay, 23, 59, 59, 999));
  }

  const prevMonthLast = new Date(Date.UTC(y, closingM0, 0));
  return new Date(
    Date.UTC(
      prevMonthLast.getUTCFullYear(),
      prevMonthLast.getUTCMonth(),
      prevMonthLast.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

export function periodBoundsForReferenceMonth(
  referenceMonth: string,
  closingDay: number,
): { periodStart: Date; periodEnd: Date } {
  const [ys, ms] = referenceMonth.split("-").map(Number);
  const prevFirst = new Date(Date.UTC(ys, ms - 2, 1));
  const prevYm = `${prevFirst.getUTCFullYear()}-${String(prevFirst.getUTCMonth() + 1).padStart(2, "0")}`;

  const periodEnd = periodEndInclusiveUtc(referenceMonth, closingDay);
  const prevEnd = periodEndInclusiveUtc(prevYm, closingDay);

  const sy = prevEnd.getUTCFullYear();
  const sm0 = prevEnd.getUTCMonth();
  const sd = prevEnd.getUTCDate();
  const periodStart = new Date(Date.UTC(sy, sm0, sd + 1, 0, 0, 0, 0));

  return { periodStart, periodEnd };
}

/**
 * Data de vencimento da fatura (`referenceMonth` = mês do fechamento).
 * Regra usual no Brasil: se o dia de vencimento é depois do fechamento no calendário, vence no **mesmo** mês;
 * se o vencimento é antes do dia de fechamento, cai no **mês seguinte** (ex.: fecha dia 25, vence dia 5).
 */
export function dueDateForReferenceMonth(
  referenceMonth: string,
  dueDay: number,
  closingDay: number,
): Date {
  const [ys, ms] = referenceMonth.split("-").map(Number);
  const closingM0 = ms - 1;

  let dueYear = ys;
  let dueM0 = closingM0;

  if (dueDay < closingDay) {
    dueM0 = closingM0 + 1;
    if (dueM0 > 11) {
      dueYear += 1;
      dueM0 = 0;
    }
  }

  const last = new Date(Date.UTC(dueYear, dueM0 + 1, 0)).getUTCDate();
  const day = Math.min(dueDay, last);
  return new Date(Date.UTC(dueYear, dueM0, day, 23, 59, 59, 999));
}

export function closingDateForReferenceMonth(referenceMonth: string, closingDay: number): Date {
  const [ys, ms] = referenceMonth.split("-").map(Number);
  const m0 = ms - 1;
  const last = new Date(Date.UTC(ys, m0 + 1, 0)).getUTCDate();
  const day = Math.min(closingDay, last);
  return new Date(Date.UTC(ys, m0, day, 23, 59, 59, 999));
}

/**
 * Mês de fechamento (YYYY-MM) da fatura onde cai a parcela `installmentNumber` (1-based).
 * A parcela 1 usa o fechamento da compra; cada parcela seguinte avança um mês de fatura.
 */
export function installmentClosingReferenceMonth(
  firstInstallmentClosingReferenceMonth: string,
  installmentNumber: number,
): string {
  if (!Number.isInteger(installmentNumber) || installmentNumber < 1) {
    throw new Error("installmentNumber deve ser inteiro >= 1");
  }
  return addMonthsToCompetencyMonth(firstInstallmentClosingReferenceMonth, installmentNumber - 1);
}

export function splitInstallmentCents(totalCents: number, totalInstallments: number): number[] {
  const base = Math.floor(totalCents / totalInstallments);
  const rem = totalCents - base * totalInstallments;
  const arr: number[] = [];
  for (let i = 0; i < totalInstallments; i++) {
    arr.push(base + (i < rem ? 1 : 0));
  }
  return arr;
}

/**
 * Compra parcelada: pode informar `installmentAmountCents` (valor fixo de cada parcela);
 * o total da compra vira `installmentAmountCents * totalInstallments`.
 * Caso contrário usa-se `totalAmountCents` com repartição via `splitInstallmentCents`.
 */
export function resolvePurchaseTotalAndInstallmentMode(input: {
  isInstallmentPurchase: boolean;
  totalInstallments: number;
  totalAmountCents: number;
  installmentAmountCents?: number | null;
}): { totalAmountCents: number; equalInstallmentCents?: number } {
  const n = input.totalInstallments;
  if (!input.isInstallmentPurchase || n < 1) {
    return { totalAmountCents: input.totalAmountCents };
  }
  const per = input.installmentAmountCents;
  if (per != null && per > 0) {
    const total = per * n;
    return { totalAmountCents: total, equalInstallmentCents: per };
  }
  return { totalAmountCents: input.totalAmountCents };
}
