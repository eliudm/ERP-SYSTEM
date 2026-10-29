import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from './api/settings.api';
import { localeToLanguage, LANGUAGE_STORAGE_KEY } from './i18n/languageMap';
import { useAuthStore } from './store/auth.store';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { InvoicesPage } from './pages/sales/invoices/InvoicesPage';
import { InvoiceDetailPage } from './pages/sales/invoices/InvoiceDetailPage';
import { CustomersPage } from './pages/sales/customers/CustomersPage';
import { POSPage } from './pages/sales/pos/POSPage';
import { QuotationsPage } from './pages/sales/quotes/QuotationsPage';
import { QuotationFormPage } from './pages/sales/quotes/QuotationFormPage';
import { AccountsPage } from './pages/accounting/accounts/AccountsPage';
import { JournalEntriesPage } from './pages/accounting/journals/JournalEntriesPage';
import { ExpensesPage } from './pages/accounting/expenses/ExpensesPage';
import { TrialBalancePage } from './pages/accounting/reports/TrialBalancePage';
import { ProfitLossPage } from './pages/accounting/reports/ProfitLossPage';
import { BalanceSheetPage } from './pages/accounting/reports/BalanceSheetPage';
import { CashFlowPage } from './pages/accounting/reports/CashFlowPage';
import { AgedReceivablesPage } from './pages/accounting/reports/AgedReceivablesPage';
import { AgedPayablesPage } from './pages/accounting/reports/AgedPayablesPage';
import { GeneralLedgerPage } from './pages/accounting/reports/GeneralLedgerPage';
import { PaymentModesPage } from './pages/accounting/reports/PaymentModesPage';
import { ProductsPage } from './pages/inventory/ProductsPage';
import { WarehousesPage } from './pages/inventory/WarehousesPage';
import { StockMovementsPage } from './pages/inventory/StockMovementsPage';
import { SuppliersPage } from './pages/procurement/SuppliersPage';
import { PurchaseOrdersPage } from './pages/procurement/PurchaseOrdersPage';
import { EmployeesPage } from './pages/hr/EmployeesPage';
import { PayrollPage } from './pages/hr/PayrollPage';
import { LeavePage } from './pages/hr/LeavePage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { GeneralSettingsPage } from './pages/settings/GeneralSettingsPage';
import { UsersSettingsPage } from './pages/settings/UsersSettingsPage';
import { CompaniesSettingsPage } from './pages/settings/CompaniesSettingsPage';
import { LocalizationSettingsPage } from './pages/settings/LocalizationSettingsPage';
import { EtimsConfigPage } from './pages/etims/EtimsConfigPage';
// New pages
import ContactsPage from './pages/contacts/ContactsPage';
import BankAccountsPage from './pages/accounting/BankAccountsPage';
import TaxRatesPage from './pages/settings/TaxRatesPage';
import RFQPage from './pages/procurement/RFQPage';
import VendorBillsPage from './pages/procurement/VendorBillsPage';
import PurchaseReturnsPage from './pages/procurement/PurchaseReturnsPage';
import AttendancePage from './pages/hr/AttendancePage';
import RecruitmentPage from './pages/hr/RecruitmentPage';
import AppraisalsPage from './pages/hr/AppraisalsPage';
import AllowancesLoansPage from './pages/hr/AllowancesLoansPage';
import StockTransfersPage from './pages/inventory/StockTransfersPage';
import StockCountsPage from './pages/inventory/StockCountsPage';
import LotsPage from './pages/inventory/LotsPage';
import SerialNumbersPage from './pages/inventory/SerialNumbersPage';
import CreditNotesPage from './pages/sales/CreditNotesPage';
import PriceListsPage from './pages/sales/PriceListsPage';
// POS Module
import { POSDashboardPage } from './pages/pos/POSDashboardPage';
import { POSOrdersPage } from './pages/pos/POSOrdersPage';
import { POSProductsPage } from './pages/pos/POSProductsPage';
import { POSReportingPage } from './pages/pos/POSReportingPage';
import { POSConfigurationPage } from './pages/pos/POSConfigurationPage';
// Phase 3: previously-backend-only modules
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import AiInsightsPage from './pages/ai-insights/AiInsightsPage';
import AuditLogPage from './pages/audit/AuditLogPage';
import BranchesPage from './pages/branches/BranchesPage';
import PluginsPage from './pages/plugins/PluginsPage';
import BudgetsPage from './pages/budget/BudgetsPage';
import TaxReportsPage from './pages/tax/TaxReportsPage';
import CrmPage from './pages/crm/CrmPage';
import ApprovalsPage from './pages/workflow/ApprovalsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import BomsPage from './pages/mrp/BomsPage';
import WorkOrdersPage from './pages/mrp/WorkOrdersPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const ANTD_LOCALES: Record<string, typeof enUS> = { en: enUS, fr: frFR };

const App: React.FC = () => {
  const { i18n } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.getSystemSettings(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!settings?.defaultLanguage) {
      return;
    }
    const language = localeToLanguage(settings.defaultLanguage);
    i18n.changeLanguage(language);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // storage unavailable (private mode, etc.) — language still applies for this session
    }
  }, [settings?.defaultLanguage, i18n]);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
      locale={ANTD_LOCALES[i18n.language]}
    >
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          {/* POS Module */}
          <Route path="pos" element={<Navigate to="/pos/dashboard" replace />} />
          <Route path="pos/dashboard" element={<POSDashboardPage />} />
          <Route path="pos/session" element={<POSPage />} />
          <Route path="pos/orders" element={<POSOrdersPage />} />
          <Route path="pos/products" element={<POSProductsPage />} />
          <Route path="pos/reporting" element={<POSReportingPage />} />
          <Route path="pos/configuration" element={<POSConfigurationPage />} />
          {/* Sales */}
          <Route path="sales/pos" element={<Navigate to="/pos/session" replace />} />
          <Route path="sales/quotes" element={<QuotationsPage />} />
          <Route path="sales/quotes/:id" element={<QuotationFormPage />} />
          <Route path="sales/invoices" element={<InvoicesPage />} />
          <Route path="sales/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="sales/customers" element={<CustomersPage />} />
          <Route path="sales/credit-notes" element={<CreditNotesPage />} />
          <Route path="sales/price-lists" element={<PriceListsPage />} />
          {/* Accounting */}
          <Route path="accounting/accounts" element={<AccountsPage />} />
          <Route path="accounting/journals" element={<JournalEntriesPage />} />
          <Route path="accounting/expenses" element={<ExpensesPage />} />
          <Route path="accounting/trial-balance" element={<TrialBalancePage />} />
          <Route path="accounting/pnl" element={<ProfitLossPage />} />
          <Route path="accounting/bank-accounts" element={<BankAccountsPage />} />
          {/* Inventory */}
          <Route path="inventory/products" element={<ProductsPage />} />
          <Route path="inventory/warehouses" element={<WarehousesPage />} />
          <Route path="inventory/movements" element={<StockMovementsPage />} />
          <Route path="inventory/transfers" element={<StockTransfersPage />} />
          <Route path="inventory/counts" element={<StockCountsPage />} />
          <Route path="inventory/lots" element={<LotsPage />} />
          <Route path="inventory/serials" element={<SerialNumbersPage />} />
          {/* Procurement */}
          <Route path="procurement/suppliers" element={<SuppliersPage />} />
          <Route path="procurement/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="procurement/rfq" element={<RFQPage />} />
          <Route path="procurement/vendor-bills" element={<VendorBillsPage />} />
          <Route path="procurement/returns" element={<PurchaseReturnsPage />} />
          {/* HR */}
          <Route path="hr/employees" element={<EmployeesPage />} />
          <Route path="hr/payroll" element={<PayrollPage />} />
          <Route path="hr/leave" element={<LeavePage />} />
          <Route path="hr/attendance" element={<AttendancePage />} />
          <Route path="hr/recruitment" element={<RecruitmentPage />} />
          <Route path="hr/appraisals" element={<AppraisalsPage />} />
          <Route path="hr/allowances" element={<AllowancesLoansPage />} />
          {/* System */}
          <Route path="settings" element={<SettingsPage />}>
            <Route index element={<Navigate to="/settings/general" replace />} />
            <Route path="general" element={<GeneralSettingsPage />} />
            <Route path="users" element={<UsersSettingsPage />} />
            <Route path="companies" element={<CompaniesSettingsPage />} />
            <Route path="localization" element={<LocalizationSettingsPage />} />
            <Route path="tax" element={<TaxRatesPage />} />
            <Route path="branches" element={<BranchesPage />} />
            <Route path="plugins" element={<PluginsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
          </Route>
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="etims/config" element={<EtimsConfigPage />} />
          {/* Analytics & Insights */}
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="ai-insights" element={<AiInsightsPage />} />
          {/* CRM */}
          <Route path="crm/leads" element={<CrmPage />} />
          {/* Manufacturing (MRP) */}
          <Route path="mrp/bom" element={<BomsPage />} />
          <Route path="mrp/work-orders" element={<WorkOrdersPage />} />
          {/* Approvals (Workflow) */}
          <Route path="workflow/approvals" element={<ApprovalsPage />} />
          {/* Notifications */}
          <Route path="notifications" element={<NotificationsPage />} />
          {/* Accounting additions */}
          <Route path="accounting/budgets" element={<BudgetsPage />} />
          <Route path="accounting/tax-reports" element={<TaxReportsPage />} />
          <Route path="accounting/balance-sheet" element={<BalanceSheetPage />} />
          <Route path="accounting/cash-flow" element={<CashFlowPage />} />
          <Route path="accounting/aged-receivables" element={<AgedReceivablesPage />} />
          <Route path="accounting/aged-payables" element={<AgedPayablesPage />} />
          <Route path="accounting/general-ledger" element={<GeneralLedgerPage />} />
          <Route path="accounting/payment-modes" element={<PaymentModesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
