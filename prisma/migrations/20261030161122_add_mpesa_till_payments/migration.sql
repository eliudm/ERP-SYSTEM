-- CreateTable
CREATE TABLE "mpesa_till_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "transId" TEXT NOT NULL,
    "transactionType" TEXT,
    "transTime" TIMESTAMP(3) NOT NULL,
    "transAmount" DECIMAL(18,2) NOT NULL,
    "businessShortCode" TEXT NOT NULL,
    "billRefNumber" TEXT,
    "msisdn" TEXT NOT NULL,
    "firstName" TEXT,
    "middleName" TEXT,
    "lastName" TEXT,
    "isMatched" BOOLEAN NOT NULL DEFAULT false,
    "matchedInvoiceId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchedByUserId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mpesa_till_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mpesa_till_payments_transId_key" ON "mpesa_till_payments"("transId");

-- CreateIndex
CREATE INDEX "mpesa_till_payments_isMatched_idx" ON "mpesa_till_payments"("isMatched");

-- CreateIndex
CREATE INDEX "mpesa_till_payments_transTime_idx" ON "mpesa_till_payments"("transTime");

-- AddForeignKey
ALTER TABLE "mpesa_till_payments" ADD CONSTRAINT "mpesa_till_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mpesa_till_payments" ADD CONSTRAINT "mpesa_till_payments_matchedInvoiceId_fkey" FOREIGN KEY ("matchedInvoiceId") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
