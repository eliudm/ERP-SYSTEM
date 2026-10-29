-- DropForeignKey
ALTER TABLE "crm_lead_activities" DROP CONSTRAINT "crm_lead_activities_leadId_fkey";

-- DropForeignKey
ALTER TABLE "recurring_invoice_runs" DROP CONSTRAINT "recurring_invoice_runs_templateId_fkey";

-- DropForeignKey
ALTER TABLE "recurring_invoice_template_items" DROP CONSTRAINT "recurring_invoice_template_items_templateId_fkey";

-- DropIndex
DROP INDEX "approval_requests_assignedRole_status_idx";

-- AlterTable
ALTER TABLE "sales_invoices" ADD COLUMN     "cashierId" TEXT,
ADD COLUMN     "posSessionId" TEXT;

-- CreateTable
CREATE TABLE "pos_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionRef" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "branchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closingNote" TEXT,
    "closingCounts" JSONB,

    CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_sessions_tenantId_idx" ON "pos_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "pos_sessions_cashierId_idx" ON "pos_sessions"("cashierId");

-- CreateIndex
CREATE INDEX "pos_sessions_status_idx" ON "pos_sessions"("status");

-- CreateIndex
CREATE INDEX "sales_invoices_cashierId_idx" ON "sales_invoices"("cashierId");

-- CreateIndex
CREATE INDEX "sales_invoices_posSessionId_idx" ON "sales_invoices"("posSessionId");

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_activities" ADD CONSTRAINT "crm_lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoice_template_items" ADD CONSTRAINT "recurring_invoice_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "recurring_invoice_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoice_runs" ADD CONSTRAINT "recurring_invoice_runs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "recurring_invoice_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
