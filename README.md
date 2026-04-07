# ERP Backend

NestJS + Prisma + PostgreSQL backend for a full-featured ERP system built for Kenyan SMEs.

Base URL used by all frontend clients:

```text
http://localhost:3000/api/v1
```

---

## Table of Contents

1. [System Modules](#system-modules)
2. [Tech Stack](#tech-stack)
3. [Quick Start](#quick-start)
4. [Environment Variables](#environment-variables)
5. [M-Pesa Integration](#m-pesa-integration)
6. [ngrok Tunnel Helper](#ngrok-tunnel-helper)
7. [API Reference](#api-reference)
8. [Control Flow Diagrams](#control-flow-diagrams)
9. [Operational Guide](#operational-guide)
10. [Role-Based User Manual](#role-based-user-manual)
11. [Daily Checklists](#daily-checklists)
12. [Error Reference](#error-reference)
13. [Developer Notes](#developer-notes)

---

## System Modules

| # | Module | Description |
| --- | -------- | ------------- |
| 1 | **Auth / Users** | JWT login, role-based access, user management, POS-only access flag |
| 2 | **Sales / POS** | Invoices, customers, quotes, credit notes, price lists, daily cash summary |
| 3 | **M-Pesa Payments** | Safaricom Daraja STK push, callback, pending queue management, manual reconciliation |
| 4 | **Accounting** | Chart of accounts, journal entries, bank accounts, bank reconciliation, financial reports |
| 5 | **Inventory** | Products, categories, warehouses, stock movements, transfers, stock counts, serial/lot tracking, landed costs |
| 6 | **Procurement** | RFQ, purchase orders, goods receipt, vendor bills, purchase returns, supplier management |
| 7 | **HR & Payroll** | Employees, payroll, attendance, leave, appraisals, recruitment pipeline |
| 8 | **Contacts** | Company and individual contacts with parent/child linking |
| 9 | **eTIMS (KRA)** | Kenya Revenue Authority eTIMS invoice submission via BullMQ async queue |
| 10 | **Notifications** | System notifications including low-stock alerts |
| 11 | **Settings** | Company profile, logo, system configuration |
| 12 | **Tax** | Tax rate management |

---

## Tech Stack

- **NestJS** (TypeScript) — API framework
- **Prisma ORM** — Database access layer
- **PostgreSQL** — Primary database
- **Redis + BullMQ** — Async job queue (eTIMS submission, background tasks)
- **JWT** — Stateless authentication
- **Axios** — Outbound HTTP (Daraja, eTIMS)
- **Nodemailer** — Email (quotes, notifications)
- **Docker** — PostgreSQL and Redis containers for local development

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure (Docker)

```bash
docker-compose up -d
```

This starts PostgreSQL on `localhost:5434` and Redis on `localhost:6379`.

### 3. Configure environment

Copy `.env.example` to `.env` and fill in all required values (see [Environment Variables](#environment-variables)).

### 4. Run database migrations

```bash
npx prisma migrate deploy
```

### 5. Generate Prisma client

```bash
npx prisma generate
```

### 6. Seed initial data (optional)

```bash
npx ts-node src/seed.ts
```

### 7. Start the server

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run start:prod
```

### Quality checks

```bash
npx tsc --noEmit   # type check
npm run lint        # lint
npm run test        # unit tests
npm run test:e2e    # end-to-end tests
```

---

## Environment Variables

Full list of supported `.env` keys:

```bash
# ── Database ───────────────────────────────────────────────
DATABASE_URL=postgresql://erpuser:erppassword@localhost:5434/erpdb

# ── Redis ──────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379

# ── JWT ────────────────────────────────────────────────────
JWT_SECRET=change_this_to_a_long_random_secret
JWT_EXPIRES_IN=7d

# ── App ────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ── M-Pesa (Safaricom Daraja) ──────────────────────────────
MPESA_BASE_URL=https://sandbox.safaricom.co.ke
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=174379
MPESA_PASSKEY=...
MPESA_CALLBACK_URL=https://your-tunnel.ngrok-free.app/api/v1/payments/mpesa/callback
MPESA_CALLBACK_TOKEN=long-random-secret

# Initiator credentials (B2C / reversal / query-status APIs)
MPESA_INITIATOR_NAME=testapi
MPESA_INITIATOR_PASSWORD=...
MPESA_PARTY_A=600980
MPESA_PARTY_B=600000
MPESA_TEST_PHONE=254708374149

# Optional callback hardening (leave empty for sandbox)
MPESA_CALLBACK_IP_ALLOWLIST=196.201.214.200,196.201.214.206
MPESA_CALLBACK_SIGNATURE_SECRET=shared-hmac-secret

# ── eTIMS (KRA) ────────────────────────────────────────────
ETIMS_BASE_URL=https://etims-api.kra.go.ke/etims-api
ETIMS_SANDBOX_URL=https://etims-sbx-api.kra.go.ke/etims-api
ETIMS_SELLER_PIN=A012345678Z
ETIMS_DEVICE_SERIAL=...
ETIMS_ENV=sandbox
```

---

## M-Pesa Integration

The backend integrates with Safaricom Daraja for mobile money (`MOBILE_MONEY`) payments via STK push.

### Sandbox credentials (Daraja test environment)

| Field | Value |
| ------- | ------- |
| Base URL | `https://sandbox.safaricom.co.ke` |
| Business ShortCode | `174379` |
| Passkey | `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919` |
| Initiator Name | `testapi` |
| Party A | `600980` |
| Party B | `600000` |
| Test phone | `254708374149` |

### STK Push flow

```text
1.  POS creates and approves a sales invoice.
2.  POS calls POST /api/v1/sales/invoices/:id/mpesa/stk-push  { phoneNumber }
3.  Backend generates password (Base64 of shortcode+passkey+timestamp) and
    calls Daraja InitiateTransaction API.
4.  Customer sees STK prompt on their phone.
5.  Safaricom calls POST /api/v1/payments/mpesa/callback?token=...
6.  Backend verifies token (+ optional IP allowlist + HMAC signature).
7.  On SUCCESS: records MpesaTransaction, marks invoice PAID with method MOBILE_MONEY.
    On FAILED / CANCELLED: transaction stays FAILED for cashier follow-up.
```

### Callback hardening

| Env variable | Purpose |
| --- | --- |
| `MPESA_CALLBACK_TOKEN` | Required token in callback query string |
| `MPESA_CALLBACK_IP_ALLOWLIST` | Comma-separated Safaricom IP list (leave empty for sandbox) |
| `MPESA_CALLBACK_SIGNATURE_SECRET` | HMAC-SHA256 shared secret in `x-callback-signature` header (leave empty for sandbox) |

### POS pending-queue endpoints

Cashiers use these when an STK push times out or fails:

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/sales/invoices/mpesa/pending` | List PENDING and FAILED transactions (optional `?status=PENDING\|FAILED`) |
| `POST` | `/sales/invoices/mpesa/transactions/:id/retry` | Re-send STK push for a stuck transaction |
| `PATCH` | `/sales/invoices/mpesa/transactions/:id/reconcile` | Manually confirm with receipt number and mark invoice PAID |

`reconcile` body:

```json
{
  "receiptNumber": "QGH7X9LMN2",
  "phoneNumber": "2547XXXXXXXX",
  "amount": 1500.00,
  "notes": "Customer confirmed payment"
}
```

### Check transaction status

```text
GET /sales/invoices/:id/mpesa/status
```

---

## ngrok Tunnel Helper

Daraja sandbox cannot call `localhost`. Use the included helper script to keep `MPESA_CALLBACK_URL` in sync with your active ngrok tunnel.

### Workflow

```bash
# Terminal 1 — start tunnel
ngrok http 3000

# Terminal 2 — update .env with the live URL
npm run ngrok:update

# Or update .env AND restart the backend automatically
npm run ngrok:update:restart
```

The script (`scripts/update-ngrok-url.js`):

1. Polls `http://localhost:4040/api/tunnels` until ngrok is up (up to 30 s).
2. Extracts the HTTPS public URL.
3. Replaces `MPESA_CALLBACK_URL` in `.env` in-place.
4. With `--restart`: kills any process on port 3000 and spawns `npm run start:dev` detached.

---

## API Reference

All endpoints are prefixed with `/api/v1`. Authentication via `Authorization: Bearer <token>` unless noted.

---

### Auth — `/auth`

| Method | Path | Description | Roles |
| -------- | ------ | ------------- | ------- |
| `POST` | `/auth/register` | Create first admin account | Public |
| `POST` | `/auth/login` | Login and receive JWT | Public |
| `GET` | `/auth/profile` | Current user profile | Authenticated |
| `GET` | `/auth/users` | List all users | Admin |
| `POST` | `/auth/users` | Create user | Admin |
| `PATCH` | `/auth/users/:id` | Update user | Admin |
| `POST` | `/auth/users/:id/reset-password` | Reset user password | Admin |
| `PATCH` | `/auth/users/:id/deactivate` | Deactivate user | Admin |
| `PATCH` | `/auth/users/:id/access` | Toggle POS-only access flag | Admin |

---

### Sales — `/sales`

#### Customers

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/sales/customers` | List / search customers |
| `POST` | `/sales/customers` | Create customer |
| `PATCH` | `/sales/customers/:id` | Update customer |
| `GET` | `/sales/customers/:id/statement` | Customer account statement |

> Cashiers can create customers directly from the POS customer dropdown using the **+** button — no navigation away from POS required.

#### Invoices

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/sales/invoices` | Create invoice |
| `GET` | `/sales/invoices` | List invoices |
| `GET` | `/sales/invoices/summary` | Invoice summary stats |
| `GET` | `/sales/invoices/monthly` | Monthly revenue breakdown |
| `GET` | `/sales/invoices/daily-summary` | Daily summary by payment method |
| `GET` | `/sales/invoices/mpesa/pending` | List pending/failed M-Pesa transactions |
| `POST` | `/sales/invoices/mpesa/transactions/:id/retry` | Retry STK push |
| `PATCH` | `/sales/invoices/mpesa/transactions/:id/reconcile` | Manual reconcile |
| `GET` | `/sales/invoices/:id` | Get invoice by ID |
| `PATCH` | `/sales/invoices/:id/approve` | Approve invoice (posts accounting entries) |
| `PATCH` | `/sales/invoices/:id/paid` | Mark as paid with payment method |
| `POST` | `/sales/invoices/:id/mpesa/stk-push` | Initiate M-Pesa STK push |
| `GET` | `/sales/invoices/:id/mpesa/status` | Check M-Pesa transaction status |
| `PATCH` | `/sales/invoices/:id/void` | Void invoice |

#### Quotes

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/sales/quotes` | Create quote |
| `GET` | `/sales/quotes` | List quotes |
| `GET` | `/sales/quotes/:id` | Get quote |
| `PATCH` | `/sales/quotes/:id` | Update quote |
| `POST` | `/sales/quotes/:id/send` | Send quote to customer |
| `POST` | `/sales/quotes/:id/convert` | Convert quote to invoice |
| `POST` | `/sales/quotes/:id/email` | Email quote to customer |
| `PATCH` | `/sales/quotes/:id/decline` | Mark quote declined |
| `PATCH` | `/sales/quotes/:id/expire` | Mark quote expired |

#### Credit Notes

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/sales/credit-notes` | Create credit note |
| `GET` | `/sales/credit-notes` | List credit notes |
| `GET` | `/sales/credit-notes/:id` | Get credit note |
| `POST` | `/sales/credit-notes/:id/approve` | Approve credit note |
| `POST` | `/sales/credit-notes/:id/apply/:invoiceId` | Apply credit note to invoice |

#### Price Lists

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/sales/price-lists` | Create price list |
| `GET` | `/sales/price-lists` | List price lists |
| `GET` | `/sales/price-lists/effective` | Get currently effective price lists |
| `GET` | `/sales/price-lists/:id` | Get price list |
| `PATCH` | `/sales/price-lists/:id` | Update price list |
| `PATCH` | `/sales/price-lists/:id/deactivate` | Deactivate price list |
| `POST` | `/sales/price-lists/:id/items` | Add item to price list |
| `GET` | `/sales/price-lists/:id/items` | List price list items |
| `DELETE` | `/sales/price-lists/items/:itemId` | Remove item from price list |

#### M-Pesa Callback (public — no JWT required)

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/payments/mpesa/callback` | Safaricom Daraja callback (requires `?token=`) |

---

### Accounting — `/accounting`

#### Chart of Accounts

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/accounting/accounts` | Create account |
| `GET` | `/accounting/accounts` | List accounts |
| `GET` | `/accounting/accounts/:id` | Get account |
| `PATCH` | `/accounting/accounts/:id` | Update account |

#### Journal Entries

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/accounting/journal-entries` | Create journal entry |
| `GET` | `/accounting/journal-entries` | List journal entries |
| `GET` | `/accounting/journal-entries/:id` | Get journal entry |
| `PATCH` | `/accounting/journal-entries/:id/post` | Post journal entry |
| `PATCH` | `/accounting/journal-entries/:id/void` | Void journal entry |

#### Bank Accounts and Reconciliation

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/accounting/bank-accounts` | Create bank account |
| `GET` | `/accounting/bank-accounts` | List bank accounts |
| `GET` | `/accounting/bank-accounts/:id` | Get bank account |
| `PATCH` | `/accounting/bank-accounts/:id/deactivate` | Deactivate account |
| `POST` | `/accounting/bank-accounts/:id/statements` | Create bank statement |
| `GET` | `/accounting/bank-accounts/:id/statements` | List statements |
| `GET` | `/accounting/bank-accounts/:id/statements/:stmtId` | Get statement |
| `POST` | `/accounting/bank-accounts/:id/statements/:stmtId/lines` | Add statement line |
| `POST` | `/accounting/bank-accounts/:id/statements/:stmtId/import` | Bulk import statement lines |
| `POST` | `/accounting/bank-accounts/:id/statements/:stmtId/auto-match` | Auto-match lines to GL entries |
| `PATCH` | `/accounting/bank-accounts/:id/statements/:stmtId/lines/:lineId/match` | Manual line match |
| `POST` | `/accounting/bank-accounts/:id/statements/:stmtId/finalize` | Finalize reconciled statement |

#### Financial Reports

| Method | Path | Query params | Description |
| -------- | ------ | --- | ------------- |
| `GET` | `/accounting/reports/balance-sheet` | `date` | Balance sheet |
| `GET` | `/accounting/reports/cash-flow` | `startDate`, `endDate` | Cash flow statement |
| `GET` | `/accounting/reports/aged-receivables` | `asOf` | Aged receivables |
| `GET` | `/accounting/reports/aged-payables` | `asOf` | Aged payables |
| `GET` | `/accounting/reports/general-ledger` | `startDate`, `endDate`, `accountId` | General ledger |
| `GET` | `/accounting/reports/vat-return` | `startDate`, `endDate` | VAT return |
| `GET` | `/accounting/reports/payment-modes` | `startDate`, `endDate`, `paymentMethod?` | Sales vs bank by payment mode |

---

### Inventory — `/inventory`

#### Products

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/inventory/products` | Create product |
| `GET` | `/inventory/products` | List / search products |
| `GET` | `/inventory/products/low-stock` | Products below reorder threshold |
| `GET` | `/inventory/products/valuation` | Inventory valuation report |
| `GET` | `/inventory/products/:id` | Get product |
| `PATCH` | `/inventory/products/:id` | Update product |
| `PATCH` | `/inventory/products/:id/deactivate` | Deactivate product |

#### Categories

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/inventory/product-categories` | Create category |
| `GET` | `/inventory/product-categories` | List categories |
| `PATCH` | `/inventory/product-categories/:id` | Update category |
| `DELETE` | `/inventory/product-categories/:id` | Delete category |

#### Warehouses

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/inventory/warehouses` | Create warehouse |
| `GET` | `/inventory/warehouses` | List warehouses |
| `GET` | `/inventory/warehouses/:id` | Get warehouse |
| `PATCH` | `/inventory/warehouses/:id` | Update warehouse |

#### Stock Movements

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/inventory/stock-movements` | Record movement |
| `GET` | `/inventory/stock-movements` | List movements |
| `GET` | `/inventory/stock-movements/summary` | Movement summary |
| `GET` | `/inventory/stock-movements/:id` | Get movement |
| `POST` | `/inventory/stock-movements/adjust` | Manual stock adjustment |

#### Stock Transfers

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/inventory/stock-transfers` | Create transfer |
| `GET` | `/inventory/stock-transfers` | List transfers |
| `GET` | `/inventory/stock-transfers/:id` | Get transfer |
| `POST` | `/inventory/stock-transfers/:id/complete` | Complete transfer |
| `PATCH` | `/inventory/stock-transfers/:id/cancel` | Cancel transfer |

#### Stock Counts (Physical Inventory)

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/inventory/stock-counts` | Create count session |
| `GET` | `/inventory/stock-counts` | List count sessions |
| `GET` | `/inventory/stock-counts/:id` | Get session |
| `POST` | `/inventory/stock-counts/:id/start` | Start counting |
| `PATCH` | `/inventory/stock-counts/:id/lines/:productId` | Update counted quantity |
| `POST` | `/inventory/stock-counts/:id/validate` | Validate and post adjustments |

#### Serial Numbers and Lot Tracking

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/inventory/serial-numbers` | Register serial number |
| `GET` | `/inventory/serial-numbers` | List serial numbers |
| `POST` | `/inventory/lots` | Create lot |
| `GET` | `/inventory/lots` | List lots |

#### Landed Costs

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/inventory/landed-costs` | Create landed cost |
| `GET` | `/inventory/landed-costs` | List landed costs |
| `POST` | `/inventory/landed-costs/:id/allocate` | Allocate across products |

---

### Procurement — `/procurement`

#### Suppliers

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/procurement/suppliers` | Create supplier |
| `GET` | `/procurement/suppliers` | List suppliers |
| `GET` | `/procurement/suppliers/:id` | Get supplier |
| `PATCH` | `/procurement/suppliers/:id` | Update supplier |

#### RFQ and Purchase Orders

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/procurement/rfq` | Create RFQ |
| `GET` | `/procurement/rfq` | List RFQs |
| `GET` | `/procurement/rfq/:id` | Get RFQ |
| `PATCH` | `/procurement/rfq/:id` | Update RFQ |
| `POST` | `/procurement/rfq/:id/send` | Send RFQ to supplier |
| `POST` | `/procurement/rfq/:id/confirm` | Confirm as Purchase Order |
| `POST` | `/procurement/rfq/:id/receive` | Receive goods (updates stock) |
| `GET` | `/procurement/purchase-orders` | List purchase orders |
| `GET` | `/procurement/purchase-orders/:id` | Get purchase order |
| `POST` | `/procurement/purchase-orders/:id/create-bill` | Create vendor bill from PO |

#### Vendor Bills

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/procurement/vendor-bills` | Create vendor bill |
| `GET` | `/procurement/vendor-bills` | List vendor bills |
| `GET` | `/procurement/vendor-bills/:id` | Get vendor bill |
| `POST` | `/procurement/vendor-bills/:id/approve` | Approve / validate bill |
| `POST` | `/procurement/vendor-bills/:id/pay` | Pay vendor bill |
| `PATCH` | `/procurement/vendor-bills/:id/void` | Void vendor bill |

#### Purchase Returns

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/procurement/purchase-returns` | Create purchase return |
| `GET` | `/procurement/purchase-returns` | List purchase returns |
| `POST` | `/procurement/purchase-returns/:id/confirm` | Confirm purchase return |

---

### HR and Payroll — `/hr`

#### Employees

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/hr/employees` | Create employee |
| `GET` | `/hr/employees` | List employees |
| `GET` | `/hr/employees/headcount` | Headcount summary |
| `GET` | `/hr/employees/departments` | Department list |
| `GET` | `/hr/employees/:id` | Get employee |
| `PATCH` | `/hr/employees/:id` | Update employee |
| `PATCH` | `/hr/employees/:id/terminate` | Terminate employee |

#### Payroll

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/hr/payroll/generate` | Generate payroll run |
| `GET` | `/hr/payroll` | List payroll runs |
| `GET` | `/hr/payroll/summary` | Payroll summary |
| `GET` | `/hr/payroll/:id` | Get payroll run |
| `GET` | `/hr/payroll/:id/payslip/:employeeId` | Get individual payslip |
| `PATCH` | `/hr/payroll/:id/approve` | Approve payroll run |
| `PATCH` | `/hr/payroll/:id/paid` | Mark payroll as paid |

#### Allowances and Loans

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/hr/allowances` | Create allowance |
| `GET` | `/hr/allowances` | List allowances |
| `POST` | `/hr/loans` | Create loan |
| `GET` | `/hr/loans` | List loans |
| `PATCH` | `/hr/loans/:id/repay` | Record loan repayment |

#### Attendance

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/hr/attendance/clock-in` | Clock in |
| `POST` | `/hr/attendance/clock-out` | Clock out |
| `GET` | `/hr/attendance` | List attendance records |
| `GET` | `/hr/attendance/summary/:employeeId` | Employee attendance summary |
| `POST` | `/hr/attendance/bulk-import` | Bulk import attendance records |

#### Leave Management

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/hr/leave` | Submit leave request |
| `GET` | `/hr/leave` | List leave requests |
| `GET` | `/hr/leave/:employeeId/balance` | Leave balance by type |
| `PATCH` | `/hr/leave/:id/approve` | Approve leave |
| `PATCH` | `/hr/leave/:id/reject` | Reject leave |

#### Appraisals

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/hr/appraisals` | Create appraisal |
| `GET` | `/hr/appraisals` | List appraisals |
| `GET` | `/hr/appraisals/:id` | Get appraisal |
| `POST` | `/hr/appraisals/:id/items` | Add appraisal item / KPI |
| `PATCH` | `/hr/appraisals/:appraisalId/items/:itemId/score` | Score an item |
| `POST` | `/hr/appraisals/:id/submit` | Submit for review |
| `POST` | `/hr/appraisals/:id/approve` | Approve appraisal |

#### Recruitment

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/hr/recruitment/postings` | Create job posting |
| `GET` | `/hr/recruitment/postings` | List postings |
| `GET` | `/hr/recruitment/postings/:id` | Get posting |
| `PATCH` | `/hr/recruitment/postings/:id` | Update posting |
| `POST` | `/hr/recruitment/postings/:id/close` | Close posting |
| `POST` | `/hr/recruitment/applications` | Submit application |
| `GET` | `/hr/recruitment/applications` | List applications |
| `GET` | `/hr/recruitment/applications/:id` | Get application |
| `POST` | `/hr/recruitment/applications/:id/shortlist` | Shortlist applicant |
| `POST` | `/hr/recruitment/applications/:id/reject` | Reject applicant |
| `POST` | `/hr/recruitment/applications/:id/offer` | Send offer |
| `POST` | `/hr/recruitment/interviews` | Schedule interview |
| `PATCH` | `/hr/recruitment/interviews/:id/result` | Record interview result |
| `POST` | `/hr/recruitment/applications/:id/hire` | Hire and create employee record |

---

### Contacts — `/contacts`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/contacts` | List all contacts |
| `GET` | `/contacts/companies` | Company contacts only |
| `GET` | `/contacts/:id` | Get contact |
| `POST` | `/contacts` | Create contact |
| `PATCH` | `/contacts/:id` | Update contact |
| `DELETE` | `/contacts/:id` | Delete contact |

---

### eTIMS (KRA) — `/etims`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/etims/submit/:invoiceId` | Manually trigger eTIMS submission |
| `GET` | `/etims/logs` | List submission logs |
| `GET` | `/etims/status/:invoiceId` | Submission status for invoice |

Automatic submission queues via BullMQ when an invoice is approved and `ETIMS_ENV` is configured.

---

### Settings — `/settings`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/settings/system` | Get system settings (company name, logo, PIN, eTIMS env) |
| `PATCH` | `/settings/system` | Update system settings |

---

## Control Flow Diagrams

### Authentication Flow

```mermaid
flowchart TD
    A([Client Request]) --> B{Has JWT Token?}
    B -- No --> C[POST /auth/login]
    C --> D{Credentials Valid?}
    D -- No --> E([401 Unauthorized])
    D -- Yes --> F[Issue JWT with role claim]
    F --> G([Return token])
    B -- Yes --> H{Token Expired?}
    H -- Yes --> E
    H -- No --> I{Role Authorized?}
    I -- No --> J([403 Forbidden])
    I -- Yes --> K([Process Request])
```

---

### Sales Invoice Lifecycle

```mermaid
flowchart TD
    A([Start]) --> B[Create Invoice — DRAFT]
    B --> C{Review OK?}
    C -- No --> D[Edit Invoice]
    D --> C
    C -- Yes --> E[POST approve — APPROVED\nPosts AR + Revenue + VAT entries]
    E --> F{Payment method?}
    F -- CASH/CARD/BANK_TRANSFER/CREDIT --> G[PATCH paid\nPosts payment GL entry]
    F -- MOBILE_MONEY --> H[POST mpesa/stk-push\nSend STK to customer phone]
    H --> I{Callback received?}
    I -- SUCCESS --> G
    I -- FAILED/TIMEOUT --> J[Transaction PENDING or FAILED\nAppears in cashier queue]
    J --> K{Cashier action}
    K -- Retry --> H
    K -- Reconcile manually --> G
    G --> L([PAID — available for bank reconciliation])
```

---

### STK Push — M-Pesa Payment Flow

```mermaid
flowchart TD
    A([POS triggers STK push]) --> B[Backend generates password\nBase64 shortcode+passkey+timestamp]
    B --> C[POST to Daraja InitiateTransaction]
    C --> D{Response OK?}
    D -- Error --> E([BadRequestException with Daraja message])
    D -- Success --> F[Record MpesaTransaction PENDING\nReturn checkoutRequestId to POS]
    F --> G([POS polls status and shows spinner])
    G --> H{Safaricom calls callback}
    H -- ResultCode 0 = SUCCESS --> I[Update transaction SUCCESS\nMark invoice PAID]
    H -- ResultCode not 0 = FAILED --> J[Update transaction FAILED]
    J --> K([Cashier uses retry or reconcile])
```

---

### Purchase and Procurement Lifecycle

```mermaid
flowchart TD
    A([Start]) --> B[Create RFQ — DRAFT]
    B --> C[Send RFQ — SENT]
    C --> D{Vendor Quote Accepted?}
    D -- No --> E([Cancel or revise])
    D -- Yes --> F[Confirm — PURCHASE_ORDER]
    F --> G[Receive Products\nInventory stock updated]
    G --> H{All items received?}
    H -- No --> G
    H -- Yes --> I[Create Vendor Bill from PO]
    I --> J{Bill correct?}
    J -- No --> K[Adjust Vendor Bill]
    K --> J
    J -- Yes --> L[Approve Vendor Bill\nPost AP journal entry]
    L --> M[Pay Vendor Bill]
    M --> N([PAID — Procurement complete])
```

---

### Bank Reconciliation Flow

```mermaid
flowchart TD
    A([Start]) --> B[Create Bank Account]
    B --> C[Create Bank Statement for period]
    C --> D[Import Statement Lines\ninclude paymentMethod when known]
    D --> E[Run Auto-Match]
    E --> F{All lines matched?}
    F -- No --> G[Review Unmatched Lines]
    G --> H{Manual match possible?}
    H -- Yes --> I[Link to GL journal line]
    I --> F
    H -- No --> J[Raise Reconciliation Exception]
    J --> K[Investigate and correct data]
    K --> D
    F -- Yes --> L[Finalize Statement — RECONCILED]
    L --> M([Period reconciliation complete])
```

---

### eTIMS Submission Flow

```mermaid
flowchart TD
    A([Invoice APPROVED]) --> B{eTIMS enabled?}
    B -- No --> C([Skip])
    B -- Yes --> D[Queue invoice via BullMQ]
    D --> E[Worker picks up job]
    E --> F[Submit to KRA eTIMS API]
    F --> G{Successful?}
    G -- Yes --> H[Record success in etims_logs]
    H --> I[Update invoice with eTIMS confirmation code]
    G -- No --> J[Record failure in etims_logs]
    J --> K{Retry count exceeded?}
    K -- No --> L[Requeue with backoff]
    L --> E
    K -- Yes --> M[Mark FAILED — alert admin]
```

---

### System Module Interaction

```mermaid
flowchart LR
    subgraph Frontend["Frontend (React + Vite)"]
        UI[UI Pages + POS]
    end

    subgraph API["Backend API (NestJS)"]
        AUTH[Auth]
        SALES[Sales / POS]
        MPESA[M-Pesa]
        PROC[Procurement]
        ACC[Accounting]
        INV[Inventory]
        HR[HR and Payroll]
        CONT[Contacts]
        ETIMS[eTIMS]
        NOTIF[Notifications]
        SET[Settings]
    end

    subgraph Infra["Infrastructure"]
        PRISMA[Prisma ORM]
        DB[(PostgreSQL)]
        REDIS[(Redis)]
        DARAJA[Safaricom Daraja]
        KRA[KRA eTIMS API]
    end

    UI -- JWT REST --> AUTH
    UI --> SALES
    UI --> PROC
    UI --> ACC
    UI --> INV
    UI --> HR
    UI --> CONT

    SALES -- posts GL entries --> ACC
    SALES -- STK push --> MPESA
    MPESA -- callback --> SALES
    MPESA --> DARAJA
    PROC -- posts AP entries --> ACC
    PROC -- updates stock --> INV
    SALES -- stock check --> INV
    ETIMS --> KRA
    NOTIF -- low-stock alerts --> INV

    AUTH --> PRISMA
    SALES --> PRISMA
    PROC --> PRISMA
    ACC --> PRISMA
    INV --> PRISMA
    HR --> PRISMA
    CONT --> PRISMA
    ETIMS --> PRISMA
    NOTIF --> PRISMA
    SET --> PRISMA

    PRISMA --> DB
    ETIMS --> REDIS
```

---

## Operational Guide

### Sales to Accounting flow

1. Create sales invoice (DRAFT).
2. Approve invoice — AR debit, Revenue credit, VAT credit posted automatically.
3. Collect payment and mark invoice PAID with accurate payment method.
4. Payment entry posted — available for bank reconciliation.

### M-Pesa payment flow (cashier)

1. Select customer in POS, build cart, press Pay.
2. Choose Mobile Money, enter phone, confirm STK push.
3. Customer approves on phone. Invoice marks PAID automatically via callback.
4. If nothing happens within ~30 s, check the M-Pesa pending panel (auto-refreshes every 7 s).
5. Use **Retry** to resend STK or **Reconcile** to enter receipt number manually.

### Creating a customer from POS

In the customer dropdown, click the **+** button to open a quick-create form (Name, Phone, Email, Tax PIN). The new customer is auto-selected on save — no navigation away from POS required.

### Purchase flow

1. Create RFQ → Send → Confirm (becomes PO).
2. Receive goods → stock updated automatically.
3. Create vendor bill → Approve → Pay.

### Bank reconciliation flow

1. Create bank account and bank statement.
2. Import statement lines (capture `paymentMethod` where source is known).
3. Run auto-match, then manually match remaining lines.
4. Finalize when all lines are matched.

---

## Role-Based User Manual

### Admin

- Manage users, roles, and the POS-only access flag.
- Configure company profile, logo, tax PIN, and eTIMS environment.
- Review cross-module dashboards and approve sensitive actions.

### Accountant

- Review and approve invoices and vendor bills.
- Import bank statements and run auto-match reconciliation.
- Generate all financial reports (balance sheet, cash flow, general ledger, VAT return, payment mode report).
- Investigate variance between payment channels and bank records.

### Cashier / Sales User

- Create, approve, and pay invoices from POS.
- Select or create customers directly in the POS dropdown.
- Initiate M-Pesa STK push and monitor the pending queue panel.
- Retry or manually reconcile failed M-Pesa transactions without leaving POS.
- Review daily summary by payment method.

### Procurement Officer

- Create and send RFQs to suppliers.
- Confirm purchase orders.
- Record goods receipt (updates stock).
- Create vendor bills for accountant validation and payment.

### Inventory Manager

- Manage products, categories, and warehouses.
- Record stock movements and manual adjustments.
- Create and validate physical stock counts.
- Manage serial numbers and lot tracking.
- Apply landed costs to received stock.

### HR Manager

- Maintain employee records and departments.
- Generate, approve, and pay payroll runs; print payslips.
- Manage attendance (clock-in/out, bulk import), leave, allowances, and loans.
- Run appraisals and the full recruitment pipeline (posting → application → interview → offer → hire).

---

## Daily Checklists

### Sales and Cash Controls

- [ ] All completed sales are approved.
- [ ] All paid invoices have the correct `paymentMethod`.
- [ ] M-Pesa pending queue is clear — no stuck transactions.
- [ ] Daily summary totals reviewed per payment method.

### Banking and Reconciliation

- [ ] Latest bank statement lines imported.
- [ ] `paymentMethod` captured on lines where source is known.
- [ ] Auto-match run.
- [ ] Unmatched lines manually resolved.
- [ ] Payment mode report generated for variance analysis.
- [ ] Statement finalized only when unmatched lines = 0.

### Month-End Finance

- [ ] No outstanding unreconciled bank lines.
- [ ] Payment mode report for full month reviewed.
- [ ] Aged receivables and aged payables reviewed.
- [ ] Balance sheet, cash flow, general ledger, VAT return generated.
- [ ] Reports exported/archived for audit.

---

## Error Reference

| Error / Message | Cause | Fix |
| --- | --- | --- |
| 401 Unauthorized | Missing or expired JWT | Re-login and send `Authorization: Bearer <token>` |
| 403 Forbidden | Role lacks permission | Use account with required role |
| 404 Not Found | Wrong ID or endpoint path | Confirm ID exists and endpoint is correct |
| 409 Conflict | Duplicate unique field | Use unique value or check existing record |
| 422 Validation Failed | Missing or invalid fields | Check required fields and payload structure |
| `Invoice is already APPROVED/PAID` | Re-approve or re-pay attempt | Refresh status, only run the valid next action |
| `Only APPROVED invoices can be marked as paid` | Payment on wrong status | Approve invoice first, then mark as paid |
| `M-Pesa is not fully configured` | Placeholder values remain in `.env` | Set real values for all `MPESA_*` keys |
| `MPESA_SHORTCODE must be numeric` | Non-numeric shortcode | Set a valid numeric shortcode |
| Daraja `errorMessage` in response | Invalid credentials or config | Check consumer key/secret, shortcode, and passkey |
| `ngrok did not expose a tunnel` | ngrok not running | Start `ngrok http 3000` before running `npm run ngrok:update` |

---

## Developer Notes

- Always run `npx prisma migrate deploy` after pulling schema changes.
- Use explicit DTOs for any finance-critical field additions.
- Run `npx tsc --noEmit` and `npm run lint` before committing.
- `MPESA_CALLBACK_URL` must be a publicly reachable HTTPS URL — use `npm run ngrok:update` during local development.
- Leave `MPESA_CALLBACK_IP_ALLOWLIST` and `MPESA_CALLBACK_SIGNATURE_SECRET` empty for sandbox; set them for production hardening.
- BullMQ jobs (eTIMS) require Redis — ensure the Docker container is running.
- POS idle timeout is 5 minutes. The screen locks automatically and requires PIN re-entry.
- The `scripts/update-ngrok-url.js` helper uses only Node.js built-in modules — no additional npm install required.
