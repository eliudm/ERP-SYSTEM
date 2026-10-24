-- Phase 1 multi-tenancy, step 1 of 2: add Tenant table and a NULLABLE
-- tenantId on the core models. Step 2 (after backfilling existing rows to a
-- default tenant) makes tenantId required and adds the per-tenant unique
-- constraints that replace today's global ones.

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- AlterTable: add nullable tenantId to each core model
ALTER TABLE "users" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "accounts" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "journal_entries" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "customers" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "sales_invoices" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "warehouses" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "branches" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "products" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "employees" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "payrolls" ADD COLUMN "tenantId" TEXT;

-- CreateIndex: tenantId lookup indexes (non-unique, cheap to add now)
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
CREATE INDEX "accounts_tenantId_idx" ON "accounts"("tenantId");
CREATE INDEX "journal_entries_tenantId_idx" ON "journal_entries"("tenantId");
CREATE INDEX "customers_tenantId_idx" ON "customers"("tenantId");
CREATE INDEX "sales_invoices_tenantId_idx" ON "sales_invoices"("tenantId");
CREATE INDEX "warehouses_tenantId_idx" ON "warehouses"("tenantId");
CREATE INDEX "branches_tenantId_idx" ON "branches"("tenantId");
CREATE INDEX "products_tenantId_idx" ON "products"("tenantId");
CREATE INDEX "stock_movements_tenantId_idx" ON "stock_movements"("tenantId");
CREATE INDEX "suppliers_tenantId_idx" ON "suppliers"("tenantId");
CREATE INDEX "purchase_orders_tenantId_idx" ON "purchase_orders"("tenantId");
CREATE INDEX "employees_tenantId_idx" ON "employees"("tenantId");
CREATE INDEX "payrolls_tenantId_idx" ON "payrolls"("tenantId");

-- AddForeignKey (nullable FK for now; SET NULL is irrelevant once required,
-- but valid while tenantId can still be null during the backfill window)
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
