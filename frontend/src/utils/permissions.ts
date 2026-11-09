export type UserRole =
  | 'ADMIN'
  | 'ACCOUNTANT'
  | 'SALES_USER'
  | 'INVENTORY_MANAGER'
  | 'HR_MANAGER'
  | 'PROCUREMENT_OFFICER';

/** Roles that can open the POS terminal and make sales */
export const POS_ROLES: UserRole[] = ['ADMIN', 'SALES_USER'];

/** Which roles can see each nav module on the web */
export const MODULE_ACCESS: Record<string, UserRole[]> = {
  dashboard: ['ADMIN', 'ACCOUNTANT', 'SALES_USER', 'INVENTORY_MANAGER', 'HR_MANAGER', 'PROCUREMENT_OFFICER'],
  pos: ['ADMIN', 'SALES_USER'],
  sales: ['ADMIN', 'SALES_USER'],
  accounting: ['ADMIN', 'ACCOUNTANT'],
  inventory: ['ADMIN', 'INVENTORY_MANAGER', 'PROCUREMENT_OFFICER'],
  procurement: ['ADMIN', 'PROCUREMENT_OFFICER'],
  hr: ['ADMIN', 'HR_MANAGER'],
  etims: ['ADMIN'],
  contacts: ['ADMIN', 'SALES_USER'],
  crm: ['ADMIN', 'SALES_USER'],
  mrp: ['ADMIN'],
  analytics: ['ADMIN', 'ACCOUNTANT'],
  aiInsights: ['ADMIN'],
  approvals: ['ADMIN', 'ACCOUNTANT', 'SALES_USER', 'INVENTORY_MANAGER', 'HR_MANAGER', 'PROCUREMENT_OFFICER'],
  notifications: ['ADMIN', 'ACCOUNTANT', 'SALES_USER', 'INVENTORY_MANAGER', 'HR_MANAGER', 'PROCUREMENT_OFFICER'],
  settings: ['ADMIN'],
};

export function canAccess(role: string, module: string, posOnly = false): boolean {
  if (module === 'pos') return posOnly || POS_ROLES.includes(role as UserRole);
  const allowed = MODULE_ACCESS[module];
  if (!allowed) return true; // unknown module defaults to visible
  return allowed.includes(role as UserRole);
}

export function canUsePOS(role: string, posOnly = false): boolean {
  return posOnly || POS_ROLES.includes(role as UserRole);
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  ACCOUNTANT: 'Accountant',
  SALES_USER: 'Sales',
  INVENTORY_MANAGER: 'Inventory Manager',
  HR_MANAGER: 'HR Manager',
  PROCUREMENT_OFFICER: 'Procurement Officer',
};
