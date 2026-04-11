-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "ip" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "isp" TEXT,
    "timezone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'expense',
    "color" TEXT,
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("color", "createdAt", "icon", "id", "name", "type", "updatedAt") SELECT "color", "createdAt", "icon", "id", "name", "type", "updatedAt" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE INDEX "Category_userId_idx" ON "Category"("userId");
CREATE TABLE "new_CreditCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "themeColor" TEXT,
    "limitCents" INTEGER,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreditCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CreditCard" ("brand", "closingDay", "createdAt", "dueDay", "id", "isActive", "limitCents", "name", "themeColor", "updatedAt") SELECT "brand", "closingDay", "createdAt", "dueDay", "id", "isActive", "limitCents", "name", "themeColor", "updatedAt" FROM "CreditCard";
DROP TABLE "CreditCard";
ALTER TABLE "new_CreditCard" RENAME TO "CreditCard";
CREATE INDEX "CreditCard_userId_idx" ON "CreditCard"("userId");
CREATE TABLE "new_FixedExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "isVariableAmount" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRecurringMonthly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FixedExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FixedExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FixedExpense" ("amountCents", "categoryId", "createdAt", "description", "dueDay", "id", "isActive", "isRecurringMonthly", "isVariableAmount", "name", "updatedAt") SELECT "amountCents", "categoryId", "createdAt", "description", "dueDay", "id", "isActive", "isRecurringMonthly", "isVariableAmount", "name", "updatedAt" FROM "FixedExpense";
DROP TABLE "FixedExpense";
ALTER TABLE "new_FixedExpense" RENAME TO "FixedExpense";
CREATE INDEX "FixedExpense_userId_idx" ON "FixedExpense"("userId");
CREATE TABLE "new_IncomeReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "competencyMonth" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IncomeReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_IncomeReceipt" ("amountCents", "competencyMonth", "createdAt", "id", "note", "updatedAt") SELECT "amountCents", "competencyMonth", "createdAt", "id", "note", "updatedAt" FROM "IncomeReceipt";
DROP TABLE "IncomeReceipt";
ALTER TABLE "new_IncomeReceipt" RENAME TO "IncomeReceipt";
CREATE INDEX "IncomeReceipt_userId_idx" ON "IncomeReceipt"("userId");
CREATE INDEX "IncomeReceipt_competencyMonth_idx" ON "IncomeReceipt"("competencyMonth");
CREATE TABLE "new_MonthlyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "competencyMonth" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "fixedExpenseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonthlyEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonthlyEntry_fixedExpenseId_fkey" FOREIGN KEY ("fixedExpenseId") REFERENCES "FixedExpense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MonthlyEntry" ("amountCents", "categoryId", "competencyMonth", "createdAt", "date", "description", "fixedExpenseId", "id", "paymentMethod", "sourceType", "updatedAt") SELECT "amountCents", "categoryId", "competencyMonth", "createdAt", "date", "description", "fixedExpenseId", "id", "paymentMethod", "sourceType", "updatedAt" FROM "MonthlyEntry";
DROP TABLE "MonthlyEntry";
ALTER TABLE "new_MonthlyEntry" RENAME TO "MonthlyEntry";
CREATE INDEX "MonthlyEntry_userId_idx" ON "MonthlyEntry"("userId");
CREATE INDEX "MonthlyEntry_competencyMonth_idx" ON "MonthlyEntry"("competencyMonth");
CREATE TABLE "new_MonthlyIncomePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "competencyMonth" TEXT NOT NULL,
    "salaryCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyIncomePlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MonthlyIncomePlan" ("competencyMonth", "createdAt", "id", "salaryCents", "updatedAt") SELECT "competencyMonth", "createdAt", "id", "salaryCents", "updatedAt" FROM "MonthlyIncomePlan";
DROP TABLE "MonthlyIncomePlan";
ALTER TABLE "new_MonthlyIncomePlan" RENAME TO "MonthlyIncomePlan";
CREATE UNIQUE INDEX "MonthlyIncomePlan_userId_competencyMonth_key" ON "MonthlyIncomePlan"("userId", "competencyMonth");
CREATE TABLE "new_SavingsDeposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "competencyMonth" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavingsDeposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SavingsDeposit" ("amountCents", "competencyMonth", "createdAt", "id", "note", "updatedAt") SELECT "amountCents", "competencyMonth", "createdAt", "id", "note", "updatedAt" FROM "SavingsDeposit";
DROP TABLE "SavingsDeposit";
ALTER TABLE "new_SavingsDeposit" RENAME TO "SavingsDeposit";
CREATE INDEX "SavingsDeposit_userId_idx" ON "SavingsDeposit"("userId");
CREATE INDEX "SavingsDeposit_competencyMonth_idx" ON "SavingsDeposit"("competencyMonth");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LoginHistory_userId_idx" ON "LoginHistory"("userId");

-- CreateIndex
CREATE INDEX "LoginHistory_createdAt_idx" ON "LoginHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

