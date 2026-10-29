import type { PrismaClient } from '@prisma/client';
import { getCurrentTenantId } from './tenant-context';

/**
 * Models isolated per tenant. CurrencyRate, Plugin, and FeatureFlag are
 * deliberately NOT included — kept as shared/global data (market exchange
 * rates, platform-level config), not per-company data.
 */
const TENANT_SCOPED_MODELS = new Set([
  // Phase 1
  'User',
  'Branch',
  'Customer',
  'SalesInvoice',
  'Account',
  'JournalEntry',
  'Product',
  'Warehouse',
  'StockMovement',
  'Supplier',
  'PurchaseOrder',
  'Employee',
  'Payroll',
  // Phase 2
  'AccountingPeriod',
  'BankAccount',
  'BankStatement',
  'TaxRate',
  'TaxGroup',
  'AuditLog',
  'Notification',
  'SystemSetting',
  'ApprovalRequest',
  'SalesQuote',
  'CreditNote',
  'PriceList',
  'RecurringInvoiceTemplate',
  'ProductCategory',
  'Lot',
  'SerialNumber',
  'LandedCost',
  'StockCount',
  'StockTransfer',
  'ReorderRule',
  'RequestForQuotation',
  'VendorBill',
  'PurchaseReturn',
  'LeaveRequest',
  'AttendanceRecord',
  'JobPosting',
  'JobApplication',
  'Appraisal',
  'Allowance',
  'LoanDeduction',
  'Contact',
  'CrmLead',
  'Budget',
  'BillOfMaterial',
  'WorkOrder',
  'PosSession',
]);

const UNIQUE_WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
]);

const FILTER_WHERE_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'updateMany',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * True if `where` already pins a tenant itself — either a bare `tenantId`
 * key, or a compound-unique key whose name starts with `tenantId_` (e.g.
 * `tenantId_key`, `tenantId_code`). Blindly adding a top-level `tenantId` on
 * top of one of those would send Prisma an unrecognized field and fail at
 * runtime, so those callers are left exactly as they are.
 */
function alreadyTenantScoped(where: Record<string, any> | undefined): boolean {
  if (!where) return false;
  return Object.keys(where).some(
    (key) => key === 'tenantId' || key.startsWith('tenantId_'),
  );
}

/**
 * Wraps a PrismaClient so every operation on a TENANT_SCOPED_MODELS model is
 * transparently filtered/stamped with the current request's tenantId (from
 * tenant-context.ts). With no ambient tenantId — e.g. login, registration, or
 * a standalone script — operations pass through unscoped; those flows set
 * tenantId explicitly where it's actually needed (see AuthService.register).
 */
export function withTenantScoping<T extends PrismaClient>(client: T): T {
  return client.$extends({
    name: 'tenant-scoping',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const tenantId = getCurrentTenantId();
          if (!tenantId) {
            return query(args);
          }

          const scopedArgs = args as Record<string, any>;

          if (
            (UNIQUE_WHERE_OPERATIONS.has(operation) ||
              FILTER_WHERE_OPERATIONS.has(operation)) &&
            !alreadyTenantScoped(scopedArgs.where)
          ) {
            scopedArgs.where = { ...(scopedArgs.where ?? {}), tenantId };
          }

          if (operation === 'create') {
            scopedArgs.data = { tenantId, ...(scopedArgs.data ?? {}) };
          }

          if (operation === 'createMany' && Array.isArray(scopedArgs.data)) {
            scopedArgs.data = scopedArgs.data.map(
              (row: Record<string, any>) => ({ tenantId, ...row }),
            );
          }

          if (operation === 'upsert') {
            if (!alreadyTenantScoped(scopedArgs.where)) {
              scopedArgs.where = { ...(scopedArgs.where ?? {}), tenantId };
            }
            scopedArgs.create = { tenantId, ...(scopedArgs.create ?? {}) };
          }

          return query(scopedArgs);
        },
      },
    },
  }) as unknown as T;
}
