import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { InvoicesPage } from './pages/sales/invoices/InvoicesPage';
import { CustomersPage } from './pages/sales/customers/CustomersPage';
import { POSPage } from './pages/sales/pos/POSPage';
import { QuotationsPage } from './pages/sales/quotes/QuotationsPage';
import { QuotationFormPage } from './pages/sales/quotes/QuotationFormPage';
import { AccountsPage } from './pages/accounting/accounts/AccountsPage';
import { JournalEntriesPage } from './pages/accounting/journals/JournalEntriesPage';
import { TrialBalancePage } from './pages/accounting/reports/TrialBalancePage';
import { ProfitLossPage } from './pages/accounting/reports/ProfitLossPage';
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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
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
          <Route path="sales/customers" element={<CustomersPage />} />
          <Route path="sales/credit-notes" element={<CreditNotesPage />} />
          <Route path="sales/price-lists" element={<PriceListsPage />} />
          {/* Accounting */}
          <Route path="accounting/accounts" element={<AccountsPage />} />
          <Route path="accounting/journals" element={<JournalEntriesPage />} />
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
          </Route>
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="etims/config" element={<EtimsConfigPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
