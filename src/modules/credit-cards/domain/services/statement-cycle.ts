import { addMonthsToCompetencyMonth } from "../../../financial/domain/value-objects/competency-month.js";

/**
 * referenceMonth YYYY-MM = mês de fechamento do ciclo.
 * Compra **no dia do fechamento** conta na **próxima** fatura (não na que fecha nesse dia).
 */
export function purchaseToClosingReferenceMonth(purchaseDate: Date, closingDay: number): string {
  const purchaseYear = purchaseDate.getUTCFullYear();
  const purchaseMonthIndex0 = purchaseDate.getUTCMonth();
  const purchaseDay = purchaseDate.getUTCDate();
  if (purchaseDay < closingDay) {
    return `${purchaseYear}-${String(purchaseMonthIndex0 + 1).padStart(2, "0")}`;
  }
  const nextMonthStart = new Date(Date.UTC(purchaseYear, purchaseMonthIndex0 + 1, 1));
  return `${nextMonthStart.getUTCFullYear()}-${String(nextMonthStart.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Último instante UTC incluído no período da fatura (compras no `closingDay` já são da fatura seguinte). */
function periodEndInclusiveUtc(referenceMonth: string, closingDay: number): Date {
  const [referenceYear, referenceMonthNum] = referenceMonth.split("-").map(Number);
  const closingMonthIndex0 = referenceMonthNum - 1;
  const lastInMonth = new Date(Date.UTC(referenceYear, closingMonthIndex0 + 1, 0)).getUTCDate();

  if (closingDay > 1) {
    const endDay = Math.min(closingDay - 1, lastInMonth);
    return new Date(Date.UTC(referenceYear, closingMonthIndex0, endDay, 23, 59, 59, 999));
  }

  const prevMonthLast = new Date(Date.UTC(referenceYear, closingMonthIndex0, 0));
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
  const [refYear, refMonthNum] = referenceMonth.split("-").map(Number);
  const prevFirst = new Date(Date.UTC(refYear, refMonthNum - 2, 1));
  const prevYm = `${prevFirst.getUTCFullYear()}-${String(prevFirst.getUTCMonth() + 1).padStart(2, "0")}`;

  const periodEnd = periodEndInclusiveUtc(referenceMonth, closingDay);
  const prevEnd = periodEndInclusiveUtc(prevYm, closingDay);

  const previousPeriodEndYear = prevEnd.getUTCFullYear();
  const previousPeriodEndMonthIndex0 = prevEnd.getUTCMonth();
  const previousPeriodEndDay = prevEnd.getUTCDate();
  const periodStart = new Date(
    Date.UTC(previousPeriodEndYear, previousPeriodEndMonthIndex0, previousPeriodEndDay + 1, 0, 0, 0, 0),
  );

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
  const [closingRefYear, closingRefMonthNum] = referenceMonth.split("-").map(Number);
  const closingMonthIndex0 = closingRefMonthNum - 1;

  let dueYear = closingRefYear;
  let dueMonthIndex0 = closingMonthIndex0;

  if (dueDay < closingDay) {
    dueMonthIndex0 = closingMonthIndex0 + 1;
    if (dueMonthIndex0 > 11) {
      dueYear += 1;
      dueMonthIndex0 = 0;
    }
  }

  const lastDayOfDueMonth = new Date(Date.UTC(dueYear, dueMonthIndex0 + 1, 0)).getUTCDate();
  const dueDayClamped = Math.min(dueDay, lastDayOfDueMonth);
  return new Date(Date.UTC(dueYear, dueMonthIndex0, dueDayClamped, 23, 59, 59, 999));
}

export function closingDateForReferenceMonth(referenceMonth: string, closingDay: number): Date {
  const [refYear, refMonthNum] = referenceMonth.split("-").map(Number);
  const closingMonthIndex0 = refMonthNum - 1;
  const lastDayOfMonth = new Date(Date.UTC(refYear, closingMonthIndex0 + 1, 0)).getUTCDate();
  const closingDayClamped = Math.min(closingDay, lastDayOfMonth);
  return new Date(Date.UTC(refYear, closingMonthIndex0, closingDayClamped, 23, 59, 59, 999));
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
  const installmentCount = input.totalInstallments;
  if (!input.isInstallmentPurchase || installmentCount < 1) {
    return { totalAmountCents: input.totalAmountCents };
  }
  const installmentAmountCents = input.installmentAmountCents;
  if (installmentAmountCents != null && installmentAmountCents > 0) {
    const derivedTotalCents = installmentAmountCents * installmentCount;
    return { totalAmountCents: derivedTotalCents, equalInstallmentCents: installmentAmountCents };
  }
  return { totalAmountCents: input.totalAmountCents };
}
