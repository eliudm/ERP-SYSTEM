-- AlterTable: Add barcode to products
ALTER TABLE "products" ADD COLUMN "barcode" TEXT;

-- CreateIndex: unique barcode
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateTable: ReorderRule
CREATE TABLE "reorder_rules" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "preferredSupplierId" TEXT,
    "reorderPoint" DECIMAL(18,2) NOT NULL,
    "reorderQty" DECIMAL(18,2) NOT NULL,
    "maxStock" DECIMAL(18,2),
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reorder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reorder_rules_productId_key" ON "reorder_rules"("productId");

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_preferredSupplierId_fkey" FOREIGN KEY ("preferredSupplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
