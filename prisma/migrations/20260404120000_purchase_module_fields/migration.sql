-- AlterEnum: add CANCELLED to RFQStatus
ALTER TYPE "RFQStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable: add Odoo-style fields to RequestForQuotation
ALTER TABLE "requests_for_quotation"
  ADD COLUMN IF NOT EXISTS "vendorReference"  TEXT,
  ADD COLUMN IF NOT EXISTS "paymentTerms"     TEXT,
  ADD COLUMN IF NOT EXISTS "orderDeadline"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expectedArrival"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliverTo"        TEXT;

-- AlterTable: add line totals to RFQItem
ALTER TABLE "rfq_items"
  ADD COLUMN IF NOT EXISTS "taxRate"   DECIMAL(5,2)  NOT NULL DEFAULT 0.16,
  ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lineTotal" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable: link PurchaseOrder back to originating RFQ
ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "rfqId" TEXT;

-- Unique index so each RFQ produces at most one PO
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_rfqId_key" ON "purchase_orders"("rfqId");

-- Foreign key constraint
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_rfqId_fkey"
  FOREIGN KEY ("rfqId")
  REFERENCES "requests_for_quotation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
