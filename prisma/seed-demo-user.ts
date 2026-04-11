import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

async function main() {
  const passwordHash = await argon2.hash("demo1234");

  const user = await prisma.user.upsert({
    where: { email: "demo@financasai.com" },
    update: {},
    create: {
      name: "Lucas Demo",
      email: "demo@financasai.com",
      passwordHash,
    },
  });
  const uid = user.id;
  console.log(`User: ${uid} (demo@financasai.com / demo1234)`);

  // ─── Categorias ───
  const cats = await Promise.all([
    prisma.category.create({ data: { userId: uid, name: "Moradia", type: "expense", color: "#3B82F6", icon: "home" } }),
    prisma.category.create({ data: { userId: uid, name: "Alimentação", type: "expense", color: "#F59E0B", icon: "utensils" } }),
    prisma.category.create({ data: { userId: uid, name: "Transporte", type: "expense", color: "#8B5CF6", icon: "car" } }),
    prisma.category.create({ data: { userId: uid, name: "Saúde", type: "expense", color: "#EF4444", icon: "heart-pulse" } }),
    prisma.category.create({ data: { userId: uid, name: "Lazer", type: "expense", color: "#EC4899", icon: "gamepad-2" } }),
    prisma.category.create({ data: { userId: uid, name: "Educação", type: "expense", color: "#06B6D4", icon: "graduation-cap" } }),
    prisma.category.create({ data: { userId: uid, name: "Assinaturas", type: "expense", color: "#6366F1", icon: "tv" } }),
    prisma.category.create({ data: { userId: uid, name: "Roupas", type: "expense", color: "#D946EF", icon: "shirt" } }),
    prisma.category.create({ data: { userId: uid, name: "Mercado", type: "expense", color: "#22C55E", icon: "shopping-cart" } }),
    prisma.category.create({ data: { userId: uid, name: "Energia", type: "expense", color: "#FACC15", icon: "zap" } }),
    prisma.category.create({ data: { userId: uid, name: "Internet", type: "expense", color: "#0EA5E9", icon: "wifi" } }),
    prisma.category.create({ data: { userId: uid, name: "Freelance", type: "income", color: "#10B981", icon: "briefcase" } }),
  ]);
  const [moradia, alimentacao, transporte, saude, lazer, educacao, assinaturas, roupas, mercado, energia, internet, freelance] = cats;
  console.log(`${cats.length} categorias criadas`);

  // ─── Despesas Fixas ───
  const fixeds = [
    { name: "Aluguel", amountCents: 180000, categoryId: moradia.id, dueDay: 10 },
    { name: "Condomínio", amountCents: 45000, categoryId: moradia.id, dueDay: 15 },
    { name: "Energia elétrica", amountCents: 22000, categoryId: energia.id, dueDay: 20, isVariableAmount: true },
    { name: "Internet fibra", amountCents: 11990, categoryId: internet.id, dueDay: 5 },
    { name: "Spotify", amountCents: 2190, categoryId: assinaturas.id, dueDay: 7 },
    { name: "Netflix", amountCents: 4490, categoryId: assinaturas.id, dueDay: 12 },
    { name: "ChatGPT Plus", amountCents: 10400, categoryId: assinaturas.id, dueDay: 1 },
    { name: "Academia", amountCents: 9990, categoryId: saude.id, dueDay: 5 },
    { name: "Plano de saúde", amountCents: 38000, categoryId: saude.id, dueDay: 25 },
    { name: "Curso online", amountCents: 4990, categoryId: educacao.id, dueDay: 15 },
  ];
  for (const f of fixeds) {
    await prisma.fixedExpense.create({
      data: { userId: uid, ...f, isVariableAmount: f.isVariableAmount ?? false, isActive: true, isRecurringMonthly: true },
    });
  }
  console.log(`${fixeds.length} despesas fixas criadas`);

  // ─── Lançamentos mensais (jan–abr 2026) ───
  const months = ["2026-01", "2026-02", "2026-03", "2026-04"];
  const variableExpenses = [
    { desc: "Supermercado semanal", cat: mercado.id, min: 28000, max: 42000, pm: "debit" as const },
    { desc: "Uber / 99", cat: transporte.id, min: 4000, max: 12000, pm: "pix" as const },
    { desc: "Farmácia", cat: saude.id, min: 5000, max: 15000, pm: "debit" as const },
    { desc: "Jantar fora", cat: alimentacao.id, min: 6000, max: 15000, pm: "pix" as const },
    { desc: "iFood", cat: alimentacao.id, min: 3000, max: 8000, pm: "pix" as const },
    { desc: "Gasolina", cat: transporte.id, min: 15000, max: 25000, pm: "debit" as const },
    { desc: "Cinema", cat: lazer.id, min: 4000, max: 7000, pm: "debit" as const },
    { desc: "Café / padaria", cat: alimentacao.id, min: 1500, max: 4000, pm: "cash" as const },
  ];

  let entryCount = 0;

  for (const month of months) {
    const [y, m] = month.split("-").map(Number);

    // fixed entries
    for (const f of fixeds) {
      const day = Math.min(f.dueDay, 28);
      let amount = f.amountCents;
      if (f.isVariableAmount) {
        amount = f.amountCents + Math.round((Math.random() - 0.5) * 6000);
      }
      await prisma.monthlyEntry.create({
        data: {
          userId: uid,
          description: f.name,
          amountCents: amount,
          date: utcDate(y, m, day),
          competencyMonth: month,
          categoryId: f.categoryId,
          paymentMethod: "pix",
          sourceType: "fixed_expense",
        },
      });
      entryCount++;
    }

    // variable entries (2-4 per type per month)
    for (const v of variableExpenses) {
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const day = 1 + Math.floor(Math.random() * 27);
        const amount = v.min + Math.floor(Math.random() * (v.max - v.min));
        await prisma.monthlyEntry.create({
          data: {
            userId: uid,
            description: v.desc,
            amountCents: amount,
            date: utcDate(y, m, day),
            competencyMonth: month,
            categoryId: v.cat,
            paymentMethod: v.pm,
            sourceType: "variable",
          },
        });
        entryCount++;
      }
    }
  }
  console.log(`${entryCount} lançamentos criados (${months.join(", ")})`);

  // ─── Cartões de crédito ───
  const nubank = await prisma.creditCard.create({
    data: { userId: uid, name: "Nubank", brand: "mastercard", themeColor: "#8A05BE", limitCents: 1200000, closingDay: 3, dueDay: 10 },
  });
  const inter = await prisma.creditCard.create({
    data: { userId: uid, name: "Inter", brand: "mastercard", themeColor: "#FF7A00", limitCents: 800000, closingDay: 15, dueDay: 22 },
  });
  const c6 = await prisma.creditCard.create({
    data: { userId: uid, name: "C6 Bank", brand: "mastercard", themeColor: "#1A1A1A", limitCents: 500000, closingDay: 20, dueDay: 27 },
  });
  console.log("3 cartões de crédito criados");

  // ─── Compras no cartão ───
  const purchases = [
    // Nubank
    { card: nubank, desc: "Tênis Nike", cat: roupas.id, amount: 59990, date: utcDate(2026, 1, 8), inst: 5 },
    { card: nubank, desc: "iPhone 15 capa", cat: lazer.id, amount: 12900, date: utcDate(2026, 1, 15), inst: 1 },
    { card: nubank, desc: "Supermercado Pão de Açúcar", cat: mercado.id, amount: 34500, date: utcDate(2026, 2, 2), inst: 1 },
    { card: nubank, desc: "Jantar Outback", cat: alimentacao.id, amount: 18900, date: utcDate(2026, 2, 14), inst: 1 },
    { card: nubank, desc: "Passagem aérea SP-RJ", cat: lazer.id, amount: 48000, date: utcDate(2026, 2, 20), inst: 3 },
    { card: nubank, desc: "Mercado Livre - Mouse", cat: lazer.id, amount: 15990, date: utcDate(2026, 3, 5), inst: 2 },
    { card: nubank, desc: "Dentista", cat: saude.id, amount: 35000, date: utcDate(2026, 3, 10), inst: 4 },
    { card: nubank, desc: "Restaurante japonês", cat: alimentacao.id, amount: 12500, date: utcDate(2026, 3, 22), inst: 1 },
    { card: nubank, desc: "Presente aniversário", cat: lazer.id, amount: 8900, date: utcDate(2026, 4, 1), inst: 1 },
    // Inter
    { card: inter, desc: "Notebook stand", cat: educacao.id, amount: 18900, date: utcDate(2026, 1, 20), inst: 3 },
    { card: inter, desc: "Curso Udemy", cat: educacao.id, amount: 2790, date: utcDate(2026, 2, 5), inst: 1 },
    { card: inter, desc: "Camiseta polo", cat: roupas.id, amount: 8990, date: utcDate(2026, 2, 18), inst: 1 },
    { card: inter, desc: "Monitor 24\"", cat: educacao.id, amount: 89900, date: utcDate(2026, 3, 1), inst: 10 },
    { card: inter, desc: "Livro Clean Architecture", cat: educacao.id, amount: 6990, date: utcDate(2026, 3, 15), inst: 1 },
    // C6
    { card: c6, desc: "Tênis corrida Asics", cat: saude.id, amount: 44990, date: utcDate(2026, 1, 25), inst: 4 },
    { card: c6, desc: "Fone Bluetooth", cat: lazer.id, amount: 25900, date: utcDate(2026, 2, 10), inst: 3 },
    { card: c6, desc: "Óculos de sol", cat: roupas.id, amount: 19900, date: utcDate(2026, 3, 8), inst: 2 },
    { card: c6, desc: "Pizza delivery", cat: alimentacao.id, amount: 7800, date: utcDate(2026, 4, 2), inst: 1 },
  ];

  for (const p of purchases) {
    const totalInstallments = p.inst;
    const installmentAmountCents = Math.floor(p.amount / totalInstallments);
    const isInstallmentPurchase = totalInstallments > 1;

    const purchaseRow = await prisma.creditCardPurchase.create({
      data: {
        creditCardId: p.card.id,
        categoryId: p.cat,
        description: p.desc,
        purchaseDate: p.date,
        totalAmountCents: p.amount,
        isInstallmentPurchase,
        totalInstallments,
        currentInstallment: 1,
        installmentAmountCents: isInstallmentPurchase ? installmentAmountCents : p.amount,
      },
    });

    // Determine first closing reference month
    const purchaseDay = p.date.getUTCDate();
    const purchaseMonth0 = p.date.getUTCMonth();
    const purchaseYear = p.date.getUTCFullYear();
    let firstRefYear: number, firstRefMonth1: number;
    if (purchaseDay < p.card.closingDay) {
      firstRefYear = purchaseYear;
      firstRefMonth1 = purchaseMonth0 + 1;
    } else {
      const next = new Date(Date.UTC(purchaseYear, purchaseMonth0 + 1, 1));
      firstRefYear = next.getUTCFullYear();
      firstRefMonth1 = next.getUTCMonth() + 1;
    }

    const remaining = isInstallmentPurchase
      ? splitCents(p.amount, totalInstallments)
      : [p.amount];

    for (let i = 0; i < totalInstallments; i++) {
      let refMonth0 = firstRefMonth1 - 1 + i;
      let refYear = firstRefYear;
      while (refMonth0 > 11) { refMonth0 -= 12; refYear++; }
      const refMonth = `${refYear}-${String(refMonth0 + 1).padStart(2, "0")}`;

      const closingDay = p.card.closingDay;
      const dueDay = p.card.dueDay;
      const lastDay = new Date(Date.UTC(refYear, refMonth0 + 1, 0)).getUTCDate();

      const periodStart = utcDate(refYear, refMonth0 + 1, 1);
      const periodEnd = utcDate(refYear, refMonth0 + 1, lastDay);
      const closingDate = utcDate(refYear, refMonth0 + 1, Math.min(closingDay, lastDay));
      const dueDateVal = utcDate(refYear, refMonth0 + 1, Math.min(dueDay, lastDay));

      let stmt = await prisma.statement.findUnique({
        where: { creditCardId_referenceMonth: { creditCardId: p.card.id, referenceMonth: refMonth } },
      });
      if (!stmt) {
        stmt = await prisma.statement.create({
          data: {
            creditCardId: p.card.id,
            referenceMonth: refMonth,
            periodStart,
            periodEnd,
            closingDate,
            dueDate: dueDateVal,
            status: "open",
          },
        });
      }

      await prisma.purchaseInstallment.create({
        data: {
          purchaseId: purchaseRow.id,
          statementId: stmt.id,
          installmentNumber: i + 1,
          totalInstallments,
          amountCents: remaining[i],
          competencyMonth: refMonth,
          status: "pending",
        },
      });
    }
  }
  console.log(`${purchases.length} compras no cartão criadas`);

  // Mark some old statements as paid
  const stmtsToPay = await prisma.statement.findMany({
    where: {
      creditCard: { userId: uid },
      referenceMonth: { lt: "2026-04" },
    },
  });
  for (const s of stmtsToPay) {
    await prisma.statement.update({ where: { id: s.id }, data: { status: "paid" } });
    await prisma.purchaseInstallment.updateMany({
      where: { statementId: s.id },
      data: { status: "paid" },
    });
  }
  console.log(`${stmtsToPay.length} faturas marcadas como pagas`);

  // ─── Renda e poupança ───
  for (const month of months) {
    await prisma.monthlyIncomePlan.create({
      data: { userId: uid, competencyMonth: month, salaryCents: 850000 },
    });
  }

  // Freelance extra
  await prisma.incomeReceipt.create({
    data: { userId: uid, competencyMonth: "2026-01", amountCents: 200000, note: "Projeto freelance site" },
  });
  await prisma.incomeReceipt.create({
    data: { userId: uid, competencyMonth: "2026-03", amountCents: 150000, note: "Consultoria React" },
  });

  // Poupança
  await prisma.savingsDeposit.create({
    data: { userId: uid, competencyMonth: "2026-01", amountCents: 100000, note: "Reserva de emergência" },
  });
  await prisma.savingsDeposit.create({
    data: { userId: uid, competencyMonth: "2026-02", amountCents: 80000, note: "Reserva de emergência" },
  });
  await prisma.savingsDeposit.create({
    data: { userId: uid, competencyMonth: "2026-03", amountCents: 120000, note: "Reserva de emergência" },
  });
  await prisma.savingsDeposit.create({
    data: { userId: uid, competencyMonth: "2026-04", amountCents: 100000, note: "Reserva de emergência" },
  });

  console.log("Renda, receitas extras e poupança criados");
  console.log("\n✓ Seed completo!");
  console.log("  Login: demo@financasai.com");
  console.log("  Senha: demo1234");
}

function splitCents(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
