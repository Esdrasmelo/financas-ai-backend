-- CreateTable
CREATE TABLE "IncomeReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencyMonth" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "IncomeReceipt_competencyMonth_idx" ON "IncomeReceipt"("competencyMonth");
