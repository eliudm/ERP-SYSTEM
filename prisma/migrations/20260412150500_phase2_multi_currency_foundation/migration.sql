-- AlterTable
ALTER TABLE "journal_entries"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "currency_rates" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "rateDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "currency_rates_baseCurrency_quoteCurrency_rateDate_idx" ON "currency_rates"("baseCurrency", "quoteCurrency", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "currency_rates_baseCurrency_quoteCurrency_rateDate_key" ON "currency_rates"("baseCurrency", "quoteCurrency", "rateDate");
