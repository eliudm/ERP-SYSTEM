-- Phase 1 multi-tenancy, step 2 of 2: make tenantId required now that every
-- existing row has been backfilled to the "Default Company" tenant, replace
-- the old global-uniqueness constraints with per-tenant compound ones, and
-- tighten the tenantId foreign keys from SET NULL to RESTRICT.

-- Drop the old nullable-era tenantId FKs (SET NULL) before re-adding as RESTRICT
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_tenantId_fkey";
ALTER TABLE "branches" DROP CONSTRAINT "branches_tenantId_fkey";
ALTER TABLE "customers" DROP CONSTRAINT "customers_tenantId_fkey";
ALTER TABLE "employees" DROP CONSTRAINT "employees_tenantId_fkey";
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_tenantId_fkey";
ALTER TABLE "payrolls" DROP CONSTRAINT "payrolls_tenantId_fkey";
ALTER TABLE "products" DROP CONSTRAINT "products_tenantId_fkey";
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_tenantId_fkey";
ALTER TABLE "sales_invoices" DROP CONSTRAINT "sales_invoices_tenantId_fkey";
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_tenantId_fkey";
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_tenantId_fkey";
ALTER TABLE "users" DROP CONSTRAINT "users_tenantId_fkey";
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_tenantId_fkey";

-- Drop the old global-uniqueness indexes being replaced by per-tenant ones
DROP INDEX "accounts_code_key";
DROP INDEX "branches_code_key";
DROP INDEX "employees_email_key";
DROP INDEX "employees_employeeNo_key";
DROP INDEX "journal_entries_reference_key";
DROP INDEX "payrolls_month_year_key";
DROP INDEX "products_barcode_key";
DROP INDEX "products_code_key";
DROP INDEX "purchase_orders_orderNo_key";
DROP INDEX "sales_invoices_invoiceNo_key";
DROP INDEX "warehouses_code_key";

-- tenantId is now required on every core model (all existing rows were
-- backfilled to the Default Company tenant in the data-migration step)
ALTER TABLE "accounts" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "branches" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "customers" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "employees" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "journal_entries" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "payrolls" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "purchase_orders" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "sales_invoices" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "stock_movements" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "suppliers" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "warehouses" ALTER COLUMN "tenantId" SET NOT NULL;

-- Per-tenant compound uniqueness (replacing the old global-uniqueness ones)
CREATE UNIQUE INDEX "accounts_tenantId_code_key" ON "accounts"("tenantId", "code");
CREATE UNIQUE INDEX "branches_tenantId_code_key" ON "branches"("tenantId", "code");
CREATE UNIQUE INDEX "employees_tenantId_employeeNo_key" ON "employees"("tenantId", "employeeNo");
CREATE UNIQUE INDEX "employees_tenantId_email_key" ON "employees"("tenantId", "email");
CREATE UNIQUE INDEX "journal_entries_tenantId_reference_key" ON "journal_entries"("tenantId", "reference");
CREATE UNIQUE INDEX "payrolls_tenantId_month_year_key" ON "payrolls"("tenantId", "month", "year");
CREATE UNIQUE INDEX "products_tenantId_code_key" ON "products"("tenantId", "code");
CREATE UNIQUE INDEX "products_tenantId_barcode_key" ON "products"("tenantId", "barcode");
CREATE UNIQUE INDEX "purchase_orders_tenantId_orderNo_key" ON "purchase_orders"("tenantId", "orderNo");
CREATE UNIQUE INDEX "sales_invoices_tenantId_invoiceNo_key" ON "sales_invoices"("tenantId", "invoiceNo");
CREATE UNIQUE INDEX "warehouses_tenantId_code_key" ON "warehouses"("tenantId", "code");

-- Re-add tenantId FKs as RESTRICT (a tenant can no longer be deleted while
-- it still owns rows in any of these tables)
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
