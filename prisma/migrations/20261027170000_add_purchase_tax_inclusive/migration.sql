-- AlterTable
ALTER TABLE "products" ADD COLUMN     "costPrice" DECIMAL(18,2),
ADD COLUMN     "costPriceIncludesVat" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "procurement_items" ADD COLUMN     "isTaxInclusive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "rfq_items" ADD COLUMN     "isTaxInclusive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "vendor_bill_items" ADD COLUMN     "isTaxInclusive" BOOLEAN NOT NULL DEFAULT true;
