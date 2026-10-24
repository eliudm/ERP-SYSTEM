-- Phase 2 multi-tenancy, step 2 of 2: make tenantId required now that every
-- existing row has been backfilled to the "Default Company" tenant, replace
-- the old global-uniqueness constraints with per-tenant compound ones, and
-- tighten the tenantId foreign keys from SET NULL to RESTRICT.

-- Drop the old nullable-era tenantId FKs (SET NULL) before re-adding as RESTRICT
ALTER TABLE "accounting_periods" DROP CONSTRAINT "accounting_periods_tenantId_fkey";
ALTER TABLE "allowances" DROP CONSTRAINT "allowances_tenantId_fkey";
ALTER TABLE "appraisals" DROP CONSTRAINT "appraisals_tenantId_fkey";
ALTER TABLE "approval_requests" DROP CONSTRAINT "approval_requests_tenantId_fkey";
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_tenantId_fkey";
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_tenantId_fkey";
ALTER TABLE "bank_accounts" DROP CONSTRAINT "bank_accounts_tenantId_fkey";
ALTER TABLE "bank_statements" DROP CONSTRAINT "bank_statements_tenantId_fkey";
ALTER TABLE "bills_of_material" DROP CONSTRAINT "bills_of_material_tenantId_fkey";
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_tenantId_fkey";
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_tenantId_fkey";
ALTER TABLE "credit_notes" DROP CONSTRAINT "credit_notes_tenantId_fkey";
ALTER TABLE "crm_leads" DROP CONSTRAINT "crm_leads_tenantId_fkey";
ALTER TABLE "job_applications" DROP CONSTRAINT "job_applications_tenantId_fkey";
ALTER TABLE "job_postings" DROP CONSTRAINT "job_postings_tenantId_fkey";
ALTER TABLE "landed_costs" DROP CONSTRAINT "landed_costs_tenantId_fkey";
ALTER TABLE "leave_requests" DROP CONSTRAINT "leave_requests_tenantId_fkey";
ALTER TABLE "loan_deductions" DROP CONSTRAINT "loan_deductions_tenantId_fkey";
ALTER TABLE "lots" DROP CONSTRAINT "lots_tenantId_fkey";
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_tenantId_fkey";
ALTER TABLE "price_lists" DROP CONSTRAINT "price_lists_tenantId_fkey";
ALTER TABLE "product_categories" DROP CONSTRAINT "product_categories_tenantId_fkey";
ALTER TABLE "purchase_returns" DROP CONSTRAINT "purchase_returns_tenantId_fkey";
ALTER TABLE "recurring_invoice_templates" DROP CONSTRAINT "recurring_invoice_templates_tenantId_fkey";
ALTER TABLE "reorder_rules" DROP CONSTRAINT "reorder_rules_tenantId_fkey";
ALTER TABLE "requests_for_quotation" DROP CONSTRAINT "requests_for_quotation_tenantId_fkey";
ALTER TABLE "sales_quotes" DROP CONSTRAINT "sales_quotes_tenantId_fkey";
ALTER TABLE "serial_numbers" DROP CONSTRAINT "serial_numbers_tenantId_fkey";
ALTER TABLE "stock_counts" DROP CONSTRAINT "stock_counts_tenantId_fkey";
ALTER TABLE "stock_transfers" DROP CONSTRAINT "stock_transfers_tenantId_fkey";
ALTER TABLE "system_settings" DROP CONSTRAINT "system_settings_tenantId_fkey";
ALTER TABLE "tax_groups" DROP CONSTRAINT "tax_groups_tenantId_fkey";
ALTER TABLE "tax_rates" DROP CONSTRAINT "tax_rates_tenantId_fkey";
ALTER TABLE "vendor_bills" DROP CONSTRAINT "vendor_bills_tenantId_fkey";
ALTER TABLE "work_orders" DROP CONSTRAINT "work_orders_tenantId_fkey";

-- Drop the old global-uniqueness indexes being replaced by per-tenant ones
DROP INDEX "budgets_fiscalYear_name_key";
DROP INDEX "credit_notes_creditNoteNumber_key";
DROP INDEX "lots_lotNumber_key";
DROP INDEX "product_categories_name_key";
DROP INDEX "purchase_returns_returnNumber_key";
DROP INDEX "requests_for_quotation_rfqNumber_key";
DROP INDEX "sales_quotes_quoteNumber_key";
DROP INDEX "serial_numbers_serial_key";
DROP INDEX "stock_counts_reference_key";
DROP INDEX "stock_transfers_reference_key";
DROP INDEX "vendor_bills_billNumber_key";
DROP INDEX "work_orders_reference_key";

-- tenantId is now required on every Phase 2 model (all existing rows were
-- backfilled to the Default Company tenant in the data-migration step)
ALTER TABLE "accounting_periods" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "allowances" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "appraisals" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "approval_requests" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "attendance_records" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "bank_accounts" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "bank_statements" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "bills_of_material" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "budgets" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "contacts" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "credit_notes" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "crm_leads" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "job_applications" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "job_postings" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "landed_costs" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "leave_requests" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "loan_deductions" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "lots" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "price_lists" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "product_categories" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "purchase_returns" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "recurring_invoice_templates" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "reorder_rules" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "requests_for_quotation" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "sales_quotes" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "serial_numbers" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "stock_counts" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "stock_transfers" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "system_settings" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "tax_groups" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "tax_rates" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "vendor_bills" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "work_orders" ALTER COLUMN "tenantId" SET NOT NULL;

-- Per-tenant compound uniqueness (replacing the old global-uniqueness ones)
CREATE UNIQUE INDEX "budgets_tenantId_fiscalYear_name_key" ON "budgets"("tenantId", "fiscalYear", "name");
CREATE UNIQUE INDEX "credit_notes_tenantId_creditNoteNumber_key" ON "credit_notes"("tenantId", "creditNoteNumber");
CREATE UNIQUE INDEX "lots_tenantId_lotNumber_key" ON "lots"("tenantId", "lotNumber");
CREATE UNIQUE INDEX "product_categories_tenantId_name_key" ON "product_categories"("tenantId", "name");
CREATE UNIQUE INDEX "purchase_returns_tenantId_returnNumber_key" ON "purchase_returns"("tenantId", "returnNumber");
CREATE UNIQUE INDEX "requests_for_quotation_tenantId_rfqNumber_key" ON "requests_for_quotation"("tenantId", "rfqNumber");
CREATE UNIQUE INDEX "sales_quotes_tenantId_quoteNumber_key" ON "sales_quotes"("tenantId", "quoteNumber");
CREATE UNIQUE INDEX "serial_numbers_tenantId_serial_key" ON "serial_numbers"("tenantId", "serial");
CREATE UNIQUE INDEX "stock_counts_tenantId_reference_key" ON "stock_counts"("tenantId", "reference");
CREATE UNIQUE INDEX "stock_transfers_tenantId_reference_key" ON "stock_transfers"("tenantId", "reference");
CREATE UNIQUE INDEX "system_settings_tenantId_key_key" ON "system_settings"("tenantId", "key");
CREATE UNIQUE INDEX "vendor_bills_tenantId_billNumber_key" ON "vendor_bills"("tenantId", "billNumber");
CREATE UNIQUE INDEX "work_orders_tenantId_reference_key" ON "work_orders"("tenantId", "reference");

-- Re-add tenantId FKs as RESTRICT (a tenant can no longer be deleted while
-- it still owns rows in any of these tables)
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_groups" ADD CONSTRAINT "tax_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_quotes" ADD CONSTRAINT "sales_quotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lots" ADD CONSTRAINT "lots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_invoice_templates" ADD CONSTRAINT "recurring_invoice_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "requests_for_quotation" ADD CONSTRAINT "requests_for_quotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "allowances" ADD CONSTRAINT "allowances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loan_deductions" ADD CONSTRAINT "loan_deductions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bills_of_material" ADD CONSTRAINT "bills_of_material_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
