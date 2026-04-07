-- CreateEnum
CREATE TYPE "MpesaTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "mpesa_transactions" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "merchantRequestId" TEXT,
    "checkoutRequestId" TEXT,
    "resultCode" INTEGER,
    "resultDesc" TEXT,
    "receiptNumber" TEXT,
    "transactionDate" TIMESTAMP(3),
    "status" "MpesaTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "callbackPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mpesa_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mpesa_transactions_checkoutRequestId_key" ON "mpesa_transactions"("checkoutRequestId");

-- CreateIndex
CREATE INDEX "mpesa_transactions_invoiceId_status_idx" ON "mpesa_transactions"("invoiceId", "status");

-- AddForeignKey
ALTER TABLE "mpesa_transactions" ADD CONSTRAINT "mpesa_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
