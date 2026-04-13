-- Budget module tables
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

CREATE TABLE "budgets" (
    "id"          TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "fiscalYear"  INTEGER      NOT NULL,
    "startDate"   TIMESTAMP(3) NOT NULL,
    "endDate"     TIMESTAMP(3) NOT NULL,
    "status"      "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "notes"       TEXT,
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "budgets_fiscalYear_name_key" ON "budgets"("fiscalYear", "name");

CREATE TABLE "budget_lines" (
    "id"        TEXT            NOT NULL,
    "budgetId"  TEXT            NOT NULL,
    "accountId" TEXT            NOT NULL,
    "month"     INTEGER         NOT NULL,
    "amount"    DECIMAL(18,2)   NOT NULL,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)    NOT NULL,
    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "budget_lines_budgetId_accountId_month_key"
    ON "budget_lines"("budgetId", "accountId", "month");

ALTER TABLE "budget_lines"
    ADD CONSTRAINT "budget_lines_budgetId_fkey"
    FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "budget_lines"
    ADD CONSTRAINT "budget_lines_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
