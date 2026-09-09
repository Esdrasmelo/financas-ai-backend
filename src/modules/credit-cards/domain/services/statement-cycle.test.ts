import { describe, expect, it } from "vitest";
import {
  purchaseToClosingReferenceMonth,
  splitInstallmentCents,
  installmentClosingReferenceMonth,
  dueDateForReferenceMonth,
  resolvePurchaseTotalAndInstallmentMode,
} from "./statement-cycle.js";

describe("purchaseToClosingReferenceMonth", () => {
  it("fatura do mês quando compra antes do dia de fechamento", () => {
    const purchaseDate = new Date(Date.UTC(2026, 0, 5));
    expect(purchaseToClosingReferenceMonth(purchaseDate, 10)).toBe("2026-01");
  });

  it("vai para o próximo fechamento quando compra após o dia de fechamento", () => {
    const purchaseDate = new Date(Date.UTC(2026, 0, 15));
    expect(purchaseToClosingReferenceMonth(purchaseDate, 10)).toBe("2026-02");
  });

  it("compra no dia do fechamento vai para a próxima fatura", () => {
    const onClose = new Date(Date.UTC(2026, 3, 4, 12, 0, 0));
    expect(purchaseToClosingReferenceMonth(onClose, 4)).toBe("2026-05");
    const janClose = new Date(Date.UTC(2026, 0, 10, 12, 0, 0));
    expect(purchaseToClosingReferenceMonth(janClose, 10)).toBe("2026-02");
  });
});

describe("resolvePurchaseTotalAndInstallmentMode", () => {
  it("parcela fixa × quantidade = total", () => {
    const resolved = resolvePurchaseTotalAndInstallmentMode({
      isInstallmentPurchase: true,
      totalInstallments: 12,
      totalAmountCents: 0,
      installmentAmountCents: 8333,
    });
    expect(resolved.totalAmountCents).toBe(99996);
    expect(resolved.equalInstallmentCents).toBe(8333);
  });

  it("à vista ignora installmentAmountCents no total", () => {
    const resolved = resolvePurchaseTotalAndInstallmentMode({
      isInstallmentPurchase: false,
      totalInstallments: 12,
      totalAmountCents: 5000,
      installmentAmountCents: 100,
    });
    expect(resolved.totalAmountCents).toBe(5000);
    expect(resolved.equalInstallmentCents).toBeUndefined();
  });

  it("estorno grava valor negativo em parcela única", () => {
    const resolved = resolvePurchaseTotalAndInstallmentMode({
      isInstallmentPurchase: false,
      totalInstallments: 1,
      totalAmountCents: 21031,
      isRefund: true,
    });
    expect(resolved.totalAmountCents).toBe(-21031);
    expect(resolved.equalInstallmentCents).toBeUndefined();
  });

  it("estorno mantém o sinal negativo se o valor já vier negativo", () => {
    const resolved = resolvePurchaseTotalAndInstallmentMode({
      isInstallmentPurchase: false,
      totalInstallments: 1,
      totalAmountCents: -21031,
      isRefund: true,
    });
    expect(resolved.totalAmountCents).toBe(-21031);
  });
});

describe("splitInstallmentCents", () => {
  it("distribui centavos restantes nas primeiras parcelas", () => {
    expect(splitInstallmentCents(100, 3)).toEqual([34, 33, 33]);
  });
});

describe("dueDateForReferenceMonth", () => {
  it("fluxo compra 30/03, fecha 4, vence 10: fatura 2026-04 vence em 10/04 (não no mês seguinte)", () => {
    const purchase = new Date(Date.UTC(2026, 2, 30, 12, 0, 0));
    const firstRef = purchaseToClosingReferenceMonth(purchase, 4);
    expect(firstRef).toBe("2026-04");
    const dueDate = dueDateForReferenceMonth(firstRef, 10, 4);
    expect(dueDate.getUTCFullYear()).toBe(2026);
    expect(dueDate.getUTCMonth()).toBe(3);
    expect(dueDate.getUTCDate()).toBe(10);
  });

  it("vencimento no mesmo mês quando dueDay >= closingDay (fecha 4, vence 10 → dia 10 do mês do fechamento)", () => {
    const dueDate = dueDateForReferenceMonth("2026-04", 10, 4);
    expect(dueDate.getUTCFullYear()).toBe(2026);
    expect(dueDate.getUTCMonth()).toBe(3);
    expect(dueDate.getUTCDate()).toBe(10);
  });

  it("vencimento no mês seguinte quando dueDay < closingDay", () => {
    const dueDate = dueDateForReferenceMonth("2026-04", 5, 25);
    expect(dueDate.getUTCFullYear()).toBe(2026);
    expect(dueDate.getUTCMonth()).toBe(4);
    expect(dueDate.getUTCDate()).toBe(5);
  });
});

describe("installmentClosingReferenceMonth", () => {
  const firstRef = "2026-01";

  it("parcela 1 no primeiro fechamento", () => {
    expect(installmentClosingReferenceMonth(firstRef, 1)).toBe("2026-01");
  });

  it("cada parcela avança um mês de fatura", () => {
    expect(installmentClosingReferenceMonth(firstRef, 4)).toBe("2026-04");
    expect(installmentClosingReferenceMonth(firstRef, 8)).toBe("2026-08");
  });
});
