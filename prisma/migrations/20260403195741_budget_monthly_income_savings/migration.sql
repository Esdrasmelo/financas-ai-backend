-- CreateTable
CREATE TABLE "MonthlyIncomePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencyMonth" TEXT NOT NULL,
    "salaryCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SavingsDeposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencyMonth" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyIncomePlan_competencyMonth_key" ON "MonthlyIncomePlan"("competencyMonth");

-- CreateIndex
CREATE INDEX "SavingsDeposit_competencyMonth_idx" ON "SavingsDeposit"("competencyMonth");
