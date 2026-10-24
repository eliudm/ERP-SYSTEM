import { AsyncLocalStorage } from 'async_hooks';

interface TenantContextStore {
  tenantId: string;
}

/**
 * Carries the authenticated request's tenantId across the async call chain
 * (controller -> service -> PrismaService) without threading it through every
 * method signature. Populated by TenantContextInterceptor; read by
 * tenant-scoping.extension.ts.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContextStore>();

export function getCurrentTenantId(): string | undefined {
  return tenantContextStorage.getStore()?.tenantId;
}
