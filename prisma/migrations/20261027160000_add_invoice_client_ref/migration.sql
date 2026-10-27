-- AlterTable
ALTER TABLE "sales_invoices" ADD COLUMN     "clientRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_tenantId_clientRef_key" ON "sales_invoices"("tenantId", "clientRef");
