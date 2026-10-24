import type { PrismaClient } from '@prisma/client';
import { getCurrentTenantId } from './tenant-context';

/**
 * Models isolated per tenant (Phase 1 — the highest-traffic core entities).
 * Every other model is NOT yet tenant-scoped: queries on them run exactly as
 * before. Expanding this set is the natural next phase of multi-tenancy.
 */
const TENANT_SCOPED_MODELS = new Set([
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
            UNIQUE_WHERE_OPERATIONS.has(operation) ||
            FILTER_WHERE_OPERATIONS.has(operation)
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
            scopedArgs.where = { ...(scopedArgs.where ?? {}), tenantId };
            scopedArgs.create = { tenantId, ...(scopedArgs.create ?? {}) };
          }

          return query(scopedArgs);
        },
      },
    },
  }) as unknown as T;
}
