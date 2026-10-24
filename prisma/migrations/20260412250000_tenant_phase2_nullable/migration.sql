-- Phase 2 multi-tenancy, step 1 of 2: add a NULLABLE tenantId to the 34
-- remaining core-adjacent models (accounting extras, audit, notifications,
-- settings, workflow, CRM/contacts, sales extras, inventory extras,
-- procurement extras, HR extras, budget, MRP). Step 2 (after backfilling
-- existing rows to the Default Company tenant) makes tenantId required and
-- adds the per-tenant unique constraints that replace today's global ones.
--
-- CurrencyRate, Plugin, and FeatureFlag are deliberately NOT included here —
-- kept as shared/global data (market exchange rates, platform-level config).

-- AlterTable: add nullable tenantId to each model
ALTER TABLE "accounting_periods" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "allowances" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "appraisals" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "approval_requests" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "attendance_records" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "bank_accounts" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "bank_statements" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "bills_of_material" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "budgets" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "contacts" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "credit_notes" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "crm_leads" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "job_applications" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "job_postings" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "landed_costs" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "loan_deductions" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "lots" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "price_lists" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "product_categories" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "purchase_returns" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "recurring_invoice_templates" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "reorder_rules" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "requests_for_quotation" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "sales_quotes" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "serial_numbers" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "stock_counts" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "stock_transfers" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "tax_groups" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "tax_rates" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "vendor_bills" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "work_orders" ADD COLUMN "tenantId" TEXT;

-- SystemSetting: was a singleton keyed by "key" (always 'system'); becomes
-- one row per tenant, identified by a new uuid id, with "key" kept as a
-- plain field (default 'system') for continuity. "id" is added nullable
-- first and backfilled, since the table already has an existing row and a
-- NOT NULL column with no default cannot be added directly onto one.
ALTER TABLE "system_settings"
  DROP CONSTRAINT "system_settings_pkey",
  ADD COLUMN "id" TEXT,
  ADD COLUMN "tenantId" TEXT,
  ALTER COLUMN "key" SET DEFAULT 'system';

UPDATE "system_settings" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;

ALTER TABLE "system_settings"
  ALTER COLUMN "id" SET NOT NULL,
  ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");

-- CreateIndex: tenantId lookup indexes (non-unique, cheap to add now)
CREATE INDEX "accounting_periods_tenantId_idx" ON "accounting_periods"("tenantId");
CREATE INDEX "allowances_tenantId_idx" ON "allowances"("tenantId");
CREATE INDEX "appraisals_tenantId_idx" ON "appraisals"("tenantId");
CREATE INDEX "approval_requests_tenantId_idx" ON "approval_requests"("tenantId");
CREATE INDEX "attendance_records_tenantId_idx" ON "attendance_records"("tenantId");
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");
CREATE INDEX "bank_accounts_tenantId_idx" ON "bank_accounts"("tenantId");
CREATE INDEX "bank_statements_tenantId_idx" ON "bank_statements"("tenantId");
CREATE INDEX "bills_of_material_tenantId_idx" ON "bills_of_material"("tenantId");
CREATE INDEX "budgets_tenantId_idx" ON "budgets"("tenantId");
CREATE INDEX "contacts_tenantId_idx" ON "contacts"("tenantId");
CREATE INDEX "credit_notes_tenantId_idx" ON "credit_notes"("tenantId");
CREATE INDEX "crm_leads_tenantId_idx" ON "crm_leads"("tenantId");
CREATE INDEX "job_applications_tenantId_idx" ON "job_applications"("tenantId");
CREATE INDEX "job_postings_tenantId_idx" ON "job_postings"("tenantId");
CREATE INDEX "landed_costs_tenantId_idx" ON "landed_costs"("tenantId");
CREATE INDEX "leave_requests_tenantId_idx" ON "leave_requests"("tenantId");
CREATE INDEX "loan_deductions_tenantId_idx" ON "loan_deductions"("tenantId");
CREATE INDEX "lots_tenantId_idx" ON "lots"("tenantId");
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");
CREATE INDEX "price_lists_tenantId_idx" ON "price_lists"("tenantId");
CREATE INDEX "product_categories_tenantId_idx" ON "product_categories"("tenantId");
CREATE INDEX "purchase_returns_tenantId_idx" ON "purchase_returns"("tenantId");
CREATE INDEX "recurring_invoice_templates_tenantId_idx" ON "recurring_invoice_templates"("tenantId");
CREATE INDEX "reorder_rules_tenantId_idx" ON "reorder_rules"("tenantId");
CREATE INDEX "requests_for_quotation_tenantId_idx" ON "requests_for_quotation"("tenantId");
CREATE INDEX "sales_quotes_tenantId_idx" ON "sales_quotes"("tenantId");
CREATE INDEX "serial_numbers_tenantId_idx" ON "serial_numbers"("tenantId");
CREATE INDEX "stock_counts_tenantId_idx" ON "stock_counts"("tenantId");
CREATE INDEX "stock_transfers_tenantId_idx" ON "stock_transfers"("tenantId");
CREATE INDEX "system_settings_tenantId_idx" ON "system_settings"("tenantId");
CREATE INDEX "tax_groups_tenantId_idx" ON "tax_groups"("tenantId");
CREATE INDEX "tax_rates_tenantId_idx" ON "tax_rates"("tenantId");
CREATE INDEX "vendor_bills_tenantId_idx" ON "vendor_bills"("tenantId");
CREATE INDEX "work_orders_tenantId_idx" ON "work_orders"("tenantId");

-- AddForeignKey (nullable FK for now; tightened to RESTRICT in step 2)
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_groups" ADD CONSTRAINT "tax_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_quotes" ADD CONSTRAINT "sales_quotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lots" ADD CONSTRAINT "lots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recurring_invoice_templates" ADD CONSTRAINT "recurring_invoice_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requests_for_quotation" ADD CONSTRAINT "requests_for_quotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "allowances" ADD CONSTRAINT "allowances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "loan_deductions" ADD CONSTRAINT "loan_deductions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bills_of_material" ADD CONSTRAINT "bills_of_material_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
