// ─── AUTH ────────────────────────────────────────────────
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  posOnly: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  access_token: string;
  user: { id: string; email: string; role: string; posOnly: boolean };
}

// ─── ACCOUNTING ──────────────────────────────────────────
export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  isActive: boolean;
  parent?: Account;
}

export interface JournalLine {
  id: string;
  accountId: string;
  account: Account;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntry {
  id: string;
  reference: string;
  description?: string;
  entryDate: string;
  status: 'DRAFT' | 'POSTED' | 'VOID';
  lines: JournalLine[];
  createdAt: string;
}

// ─── SALES ───────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxPin?: string;
  isActive: boolean;
}

export interface ProductCategory {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    products: number;
  };
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  categoryId?: string | null;
  category?: ProductCategory | null;
  unitPrice: number;
  taxRate: number;
  stockQuantity: number;
  reorderLevel?: number;
  isActive?: boolean;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  product: Product;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CREDIT';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT: 'Credit',
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  CASH: '💵',
  CARD: '💳',
  MOBILE_MONEY: '📱',
  BANK_TRANSFER: '🏦',
  CREDIT: '📑',
};

export interface Invoice {
  id: string;
  invoiceNo: string;
  customer: Customer;
  invoiceDate: string;
  dueDate?: string;
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'PAID' | 'VOID';
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  items: InvoiceItem[];
}

// ─── QUOTES / SALES ORDERS ───────────────────────────────
export interface QuoteItem {
  id?: string;
  productId: string;
  product?: Product;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface Quote {
  id: string;
  quoteNumber: string;
  customer: Customer;
  customerId: string;
  status: QuoteStatus;
  validUntil?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  items: QuoteItem[];
  invoice?: { id: string; invoiceNo: string } | null;
  createdAt: string;
  updatedAt: string;
}

// ─── PAGINATION ──────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── DASHBOARD ───────────────────────────────────────────
export interface DashboardStats {
  totalRevenue: number;
  totalInvoices: number;
  outstanding: number;
  totalPaid: number;
}

// ─── SETTINGS ────────────────────────────────────────────
export interface SystemSettings {
  key: string;
  companyName: string;
  companyLogo?: string | null;
  companyPin?: string | null;
  companyAddress?: string | null;
  receiptSlogan?: string | null;
  defaultCurrency: string;
  timezone: string;
  defaultLanguage: string;
  emailNotifications: boolean;
  autoApproveDrafts: boolean;
  showLowStockAlerts: boolean;
  lowStockThreshold: number;
  posReceiptBranding: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── TAX ─────────────────────────────────────────────────
export type TaxRateType = 'VAT' | 'EXCISE' | 'WHT';

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  type: TaxRateType;
  isDefault: boolean;
  isActive: boolean;
  glAccountId?: string | null;
  glAccount?: { id: string; name: string; code: string } | null;
  createdAt: string;
}

export interface TaxGroup {
  id: string;
  name: string;
  description?: string;
  taxRateIds: string[];
  createdAt: string;
}

// ─── BANK ─────────────────────────────────────────────────
export type BankStatementStatus = 'DRAFT' | 'RECONCILED';

export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  isActive: boolean;
  glAccountId?: string | null;
  glAccount?: { id: string; name: string; code: string } | null;
  createdAt: string;
}

export interface BankStatementLine {
  id: string;
  transactionDate: string;
  description: string;
  debit: number;
  credit: number;
  isMatched: boolean;
  matchedJournalLineId?: string | null;
}

export interface BankStatement {
  id: string;
  bankAccountId: string;
  bankAccount?: BankAccount;
  statementDate: string;
  openingBalance: number;
  closingBalance: number;
  status: BankStatementStatus;
  lines: BankStatementLine[];
  createdAt: string;
}

// ─── PROCUREMENT EXTENSIONS ──────────────────────────────
export interface RFQ {
  id: string;
  rfqNumber: string;
  supplier: { id: string; name: string };
  status: string;
  expectedDelivery?: string;
  total: number;
  notes?: string;
  items: RFQItem[];
  createdAt: string;
}

export interface RFQItem {
  id: string;
  productId: string;
  product?: { name: string; code: string };
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface VendorBill {
  id: string;
  billNumber: string;
  supplier: { id: string; name: string };
  purchaseOrder?: { id: string; orderNo: string } | null;
  billDate: string;
  dueDate?: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  createdAt: string;
}

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  supplier: { id: string; name: string };
  purchaseOrder?: { id: string; orderNo: string } | null;
  returnDate: string;
  reason?: string;
  total: number;
  status: string;
  createdAt: string;
}

// ─── HR EXTENSIONS ───────────────────────────────────────
export interface AttendanceRecord {
  id: string;
  employee: { id: string; firstName: string; lastName: string; employeeNo: string };
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  status: string;
}

export interface JobApplication {
  id: string;
  jobTitle: string;
  applicantName: string;
  email: string;
  phone?: string;
  stage: string;
  appliedAt: string;
  notes?: string;
}

export interface Appraisal {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
  reviewPeriod: string;
  rating: number;
  comments?: string;
  reviewer?: string;
  status: string;
  createdAt: string;
}

export interface Allowance {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
  type: string;
  amount: number;
  description?: string;
  isRecurring: boolean;
  createdAt: string;
}

export interface LoanDeduction {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
  amount: number;
  monthlyDeduction: number;
  balance: number;
  reason?: string;
  startMonth: number;
  startYear: number;
  createdAt: string;
}

// ─── INVENTORY EXTENSIONS ────────────────────────────────
export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromWarehouse: { id: string; name: string };
  toWarehouse: { id: string; name: string };
  status: string;
  notes?: string;
  lines: StockTransferLine[];
  createdAt: string;
}

export interface StockTransferLine {
  id: string;
  product: { id: string; name: string; code: string };
  quantity: number;
}

export interface StockCount {
  id: string;
  countNumber: string;
  warehouse: { id: string; name: string };
  status: string;
  notes?: string;
  lines: StockCountLine[];
  createdAt: string;
}

export interface StockCountLine {
  id: string;
  product: { id: string; name: string; code: string };
  expectedQty: number;
  countedQty?: number;
  variance?: number;
}

export interface Lot {
  id: string;
  lotNumber: string;
  product: { id: string; name: string; code: string };
  quantity: number;
  expiryDate?: string;
  manufactureDate?: string;
  notes?: string;
  createdAt: string;
}

export interface SerialNumber {
  id: string;
  serial: string;
  product: { id: string; name: string; code: string };
  status: string;
  warehouseId?: string;
  soldInvoiceId?: string;
  createdAt: string;
}

// ─── SALES EXTENSIONS ────────────────────────────────────
export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  customer: Customer;
  invoice?: { id: string; invoiceNo: string } | null;
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  reason?: string;
  notes?: string;
  items: CreditNoteItem[];
  createdAt: string;
}

export interface CreditNoteItem {
  id?: string;
  productId: string;
  product?: Product;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface PriceList {
  id: string;
  name: string;
  description?: string;
  currency: string;
  isActive: boolean;
  validFrom?: string;
  validTo?: string;
  items: PriceListItem[];
  createdAt: string;
}

export interface PriceListItem {
  id: string;
  product: Product;
  price: number;
  minQty?: number;
  discountPct?: number;
}
