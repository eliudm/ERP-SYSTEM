-- Performance: add missing indexes on foreign keys, status columns, and date columns
-- that are filtered/joined on frequently but had no index backing them.

-- accounts
CREATE INDEX "accounts_parentId_idx" ON "accounts"("parentId");

-- journal_entries
CREATE INDEX "journal_entries_entryDate_idx" ON "journal_entries"("entryDate");
CREATE INDEX "journal_entries_status_idx" ON "journal_entries"("status");
CREATE INDEX "journal_entries_sourceType_sourceId_idx" ON "journal_entries"("sourceType", "sourceId");

-- journal_lines
CREATE INDEX "journal_lines_journalEntryId_idx" ON "journal_lines"("journalEntryId");
CREATE INDEX "journal_lines_accountId_idx" ON "journal_lines"("accountId");

-- sales_invoices
CREATE INDEX "sales_invoices_customerId_idx" ON "sales_invoices"("customerId");
CREATE INDEX "sales_invoices_branchId_idx" ON "sales_invoices"("branchId");
CREATE INDEX "sales_invoices_status_idx" ON "sales_invoices"("status");
CREATE INDEX "sales_invoices_invoiceDate_idx" ON "sales_invoices"("invoiceDate");

-- sales_invoice_items
CREATE INDEX "sales_invoice_items_invoiceId_idx" ON "sales_invoice_items"("invoiceId");
CREATE INDEX "sales_invoice_items_productId_idx" ON "sales_invoice_items"("productId");

-- stock_movements
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");
CREATE INDEX "stock_movements_warehouseId_idx" ON "stock_movements"("warehouseId");
CREATE INDEX "stock_movements_lotId_idx" ON "stock_movements"("lotId");
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- warehouses
CREATE INDEX "warehouses_branchId_idx" ON "warehouses"("branchId");

-- products
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");
CREATE INDEX "products_isActive_idx" ON "products"("isActive");

-- purchase_orders
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
CREATE INDEX "purchase_orders_orderDate_idx" ON "purchase_orders"("orderDate");

-- procurement_items
CREATE INDEX "procurement_items_purchaseOrderId_idx" ON "procurement_items"("purchaseOrderId");
CREATE INDEX "procurement_items_productId_idx" ON "procurement_items"("productId");

-- employees
CREATE INDEX "employees_status_idx" ON "employees"("status");
CREATE INDEX "employees_department_idx" ON "employees"("department");

-- payroll_lines
CREATE INDEX "payroll_lines_payrollId_idx" ON "payroll_lines"("payrollId");
CREATE INDEX "payroll_lines_employeeId_idx" ON "payroll_lines"("employeeId");

-- leave_requests
CREATE INDEX "leave_requests_employeeId_idx" ON "leave_requests"("employeeId");
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- notifications
CREATE INDEX "notifications_invoiceId_idx" ON "notifications"("invoiceId");
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- audit_logs
CREATE INDEX "audit_logs_tableName_recordId_idx" ON "audit_logs"("tableName", "recordId");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- etims_submission_logs
CREATE INDEX "etims_submission_logs_etimsId_idx" ON "etims_submission_logs"("etimsId");

-- bank_statement_lines
CREATE INDEX "bank_statement_lines_statementId_idx" ON "bank_statement_lines"("statementId");
CREATE INDEX "bank_statement_lines_isMatched_idx" ON "bank_statement_lines"("isMatched");

-- sales_quotes
CREATE INDEX "sales_quotes_customerId_idx" ON "sales_quotes"("customerId");
CREATE INDEX "sales_quotes_status_idx" ON "sales_quotes"("status");

-- sales_quote_items
CREATE INDEX "sales_quote_items_quoteId_idx" ON "sales_quote_items"("quoteId");
CREATE INDEX "sales_quote_items_productId_idx" ON "sales_quote_items"("productId");

-- credit_notes
CREATE INDEX "credit_notes_customerId_idx" ON "credit_notes"("customerId");
CREATE INDEX "credit_notes_status_idx" ON "credit_notes"("status");

-- credit_note_items
CREATE INDEX "credit_note_items_creditNoteId_idx" ON "credit_note_items"("creditNoteId");
CREATE INDEX "credit_note_items_productId_idx" ON "credit_note_items"("productId");

-- lots
CREATE INDEX "lots_productId_idx" ON "lots"("productId");
CREATE INDEX "lots_expiryDate_idx" ON "lots"("expiryDate");

-- serial_numbers
CREATE INDEX "serial_numbers_productId_idx" ON "serial_numbers"("productId");
CREATE INDEX "serial_numbers_warehouseId_idx" ON "serial_numbers"("warehouseId");
CREATE INDEX "serial_numbers_status_idx" ON "serial_numbers"("status");

-- landed_costs
CREATE INDEX "landed_costs_purchaseOrderId_idx" ON "landed_costs"("purchaseOrderId");

-- landed_cost_items
CREATE INDEX "landed_cost_items_landedCostId_idx" ON "landed_cost_items"("landedCostId");
CREATE INDEX "landed_cost_items_productId_idx" ON "landed_cost_items"("productId");

-- stock_counts
CREATE INDEX "stock_counts_warehouseId_idx" ON "stock_counts"("warehouseId");
CREATE INDEX "stock_counts_status_idx" ON "stock_counts"("status");

-- stock_count_lines
CREATE INDEX "stock_count_lines_stockCountId_idx" ON "stock_count_lines"("stockCountId");
CREATE INDEX "stock_count_lines_productId_idx" ON "stock_count_lines"("productId");

-- stock_transfers
CREATE INDEX "stock_transfers_fromWarehouseId_idx" ON "stock_transfers"("fromWarehouseId");
CREATE INDEX "stock_transfers_toWarehouseId_idx" ON "stock_transfers"("toWarehouseId");
CREATE INDEX "stock_transfers_status_idx" ON "stock_transfers"("status");

-- stock_transfer_lines
CREATE INDEX "stock_transfer_lines_stockTransferId_idx" ON "stock_transfer_lines"("stockTransferId");
CREATE INDEX "stock_transfer_lines_productId_idx" ON "stock_transfer_lines"("productId");

-- requests_for_quotation
CREATE INDEX "requests_for_quotation_supplierId_idx" ON "requests_for_quotation"("supplierId");
CREATE INDEX "requests_for_quotation_status_idx" ON "requests_for_quotation"("status");

-- rfq_items
CREATE INDEX "rfq_items_rfqId_idx" ON "rfq_items"("rfqId");
CREATE INDEX "rfq_items_productId_idx" ON "rfq_items"("productId");

-- vendor_bills
CREATE INDEX "vendor_bills_supplierId_idx" ON "vendor_bills"("supplierId");
CREATE INDEX "vendor_bills_purchaseOrderId_idx" ON "vendor_bills"("purchaseOrderId");
CREATE INDEX "vendor_bills_status_idx" ON "vendor_bills"("status");

-- vendor_bill_items
CREATE INDEX "vendor_bill_items_vendorBillId_idx" ON "vendor_bill_items"("vendorBillId");
CREATE INDEX "vendor_bill_items_productId_idx" ON "vendor_bill_items"("productId");

-- purchase_returns
CREATE INDEX "purchase_returns_supplierId_idx" ON "purchase_returns"("supplierId");
CREATE INDEX "purchase_returns_purchaseOrderId_idx" ON "purchase_returns"("purchaseOrderId");

-- purchase_return_items
CREATE INDEX "purchase_return_items_purchaseReturnId_idx" ON "purchase_return_items"("purchaseReturnId");
CREATE INDEX "purchase_return_items_productId_idx" ON "purchase_return_items"("productId");

-- attendance_records
CREATE INDEX "attendance_records_employeeId_idx" ON "attendance_records"("employeeId");
CREATE INDEX "attendance_records_clockIn_idx" ON "attendance_records"("clockIn");

-- job_applications
CREATE INDEX "job_applications_jobPostingId_idx" ON "job_applications"("jobPostingId");
CREATE INDEX "job_applications_status_idx" ON "job_applications"("status");

-- interviews
CREATE INDEX "interviews_jobApplicationId_idx" ON "interviews"("jobApplicationId");

-- appraisals
CREATE INDEX "appraisals_employeeId_idx" ON "appraisals"("employeeId");
CREATE INDEX "appraisals_status_idx" ON "appraisals"("status");

-- appraisal_items
CREATE INDEX "appraisal_items_appraisalId_idx" ON "appraisal_items"("appraisalId");

-- allowances
CREATE INDEX "allowances_employeeId_idx" ON "allowances"("employeeId");
CREATE INDEX "allowances_isActive_idx" ON "allowances"("isActive");

-- loan_deductions
CREATE INDEX "loan_deductions_employeeId_idx" ON "loan_deductions"("employeeId");
CREATE INDEX "loan_deductions_isActive_idx" ON "loan_deductions"("isActive");

-- crm_leads
CREATE INDEX "crm_leads_stage_idx" ON "crm_leads"("stage");

-- crm_lead_activities
CREATE INDEX "crm_lead_activities_leadId_idx" ON "crm_lead_activities"("leadId");

-- budget_lines
CREATE INDEX "budget_lines_accountId_idx" ON "budget_lines"("accountId");

-- work_orders
CREATE INDEX "work_orders_bomId_idx" ON "work_orders"("bomId");
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- price_list_items
CREATE INDEX "price_list_items_productId_idx" ON "price_list_items"("productId");

-- bom_lines
CREATE INDEX "bom_lines_productId_idx" ON "bom_lines"("productId");

-- bills_of_material
CREATE INDEX "bills_of_material_productId_idx" ON "bills_of_material"("productId");
CREATE INDEX "bills_of_material_status_idx" ON "bills_of_material"("status");
