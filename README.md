# Nexora ERP

NestJS + Prisma + PostgreSQL backend for a full-featured, **multi-tenant** ERP system built for Kenyan SMEs — serving a React + Vite **web app** and an Expo/React Native **mobile app** over the same REST API, with real UI translation into **English, Kiswahili, and French**.

Base URL used by all clients:

```text
http://localhost:3000/api/v1
```

---

## Table of Contents

1. [System Modules](#system-modules)
2. [Tech Stack](#tech-stack)
3. [Multi-Tenancy](#multi-tenancy)
4. [Web App](#web-app)
5. [Mobile App](#mobile-app)
6. [Internationalization](#internationalization)
7. [Quick Start](#quick-start)
8. [Environment Variables](#environment-variables)
9. [M-Pesa Integration](#m-pesa-integration)
10. [ngrok Tunnel Helper](#ngrok-tunnel-helper)
11. [API Reference](#api-reference)
12. [Control Flow Diagrams](#control-flow-diagrams)
13. [Operational Guide](#operational-guide)
14. [Role-Based User Manual](#role-based-user-manual)
15. [Daily Checklists](#daily-checklists)
16. [Error Reference](#error-reference)
17. [Developer Notes](#developer-notes)

---

## System Modules

| # | Module | Description |
| --- | -------- | ------------- |
| 1 | **Auth / Users** | JWT login (access + refresh tokens), role-based access, user management, branch assignment, POS-only access flag, PIN-based quick register unlock |
| 2 | **Sales / POS** | Invoices, customers, quotes, credit notes, price lists, daily cash summary, POS cash-register sessions, offline-capable mobile checkout |
| 3 | **M-Pesa Payments** | Safaricom Daraja STK push, callback, pending queue management, manual reconciliation |
| 4 | **Accounting** | Chart of accounts, journal entries, bank accounts, bank reconciliation, budgets, 8 financial reports (incl. COGS-aware P&L) |
| 5 | **Inventory** | Products (with buying price / cost), categories, warehouses, stock movements, transfers, stock counts, serial/lot tracking, landed costs |
| 6 | **Procurement** | RFQ, purchase orders, goods receipt, vendor bills, purchase returns, supplier management, per-purchase VAT-inclusive/exclusive pricing |
| 7 | **HR & Payroll** | Employees, payroll, attendance, leave, appraisals, recruitment pipeline |
| 8 | **Contacts** | Company and individual contacts with parent/child linking |
| 9 | **CRM** | Lead pipeline (kanban stages), lead activities/notes |
| 10 | **Manufacturing (MRP)** | Bills of materials, component availability checks, work orders (confirm → start → complete) |
| 11 | **Branches** | Multi-location management, per-branch performance report, cross-branch revenue comparison |
| 12 | **Budgets** | Budget lines by account/period, status workflow, budget-vs-actual |
| 13 | **Tax** | Tax rates & groups, VAT return / WHT / annual tax reports |
| 14 | **Analytics** | Sales/expense/profit trend charts, top products & customers, sales-by-payment-method, inventory summary |
| 15 | **AI Insights** | Stock alerts, sales-trend callouts, payment-risk flags, dormant-customer detection |
| 16 | **Workflow / Approvals** | Configurable approval-request queue with approve/reject and an overdue sweep |
| 17 | **Audit Log** | Repo-wide change history viewer |
| 18 | **Plugins & Feature Flags** | Installable integrations/extensions, toggleable platform feature flags |
| 19 | **eTIMS (KRA)** | Kenya Revenue Authority eTIMS invoice submission via BullMQ async queue, QR receipt generation |
| 20 | **Notifications** | System notifications including low-stock/out-of-stock alerts, overdue-invoice reminders |
| 21 | **Settings** | Company profile, logo, receipt/invoice templates, localization (language/timezone/currency) |
| 22 | **Mobile (API)** | Lightweight aggregate endpoints (dashboard, POS data, search, sync status) purpose-built for the mobile app |

---

## Tech Stack

### Backend

- **NestJS** (TypeScript) — API framework
- **Prisma ORM 7** (with `@prisma/adapter-pg`) — Database access layer, multi-tenancy enforced via a Prisma Client Extension reading ambient tenant context (`AsyncLocalStorage`)
- **PostgreSQL** — Primary database
- **Redis + BullMQ** — Async job queue (eTIMS submission, background tasks), dashboard/analytics caching (fail-open if Redis is down)
- **JWT** — Stateless authentication with revocable, rotating refresh tokens
- **Axios** — Outbound HTTP (Daraja, eTIMS)
- **Nodemailer** — Email (quotes, notifications)
- **Helmet + `@nestjs/throttler`** — Security headers and rate limiting
- **Docker** — PostgreSQL and Redis containers for local development

### Web client (`frontend/`)

- React + Vite + TypeScript, Ant Design (antd), `@tanstack/react-query`, `recharts`, `i18next`/`react-i18next`

### Mobile client (`mobile/`)

- Expo SDK + Expo Router (file-based routing), React Native, `react-native-paper`, `@tanstack/react-query`, `expo-secure-store`, `expo-print`/`expo-sharing`, `i18next`/`react-i18next`

---

## Multi-Tenancy

Nexora is a true multi-company platform: every tenant (company) signing up via `POST /auth/register` gets its own isolated `Tenant` row, and `tenantId` scopes ~48 models across the schema — users, branches, customers, invoices, accounts, journal entries, products, warehouses, stock movements, suppliers, purchase orders, employees, payroll, accounting periods, bank accounts/statements, tax rates/groups, audit logs, notifications, system settings, approvals, quotes, credit notes, price lists, recurring invoices, product categories, lots, serials, landed costs, stock counts/transfers, reorder rules, RFQs, vendor bills, purchase returns, leave, attendance, recruitment, appraisals, allowances, loans, contacts, CRM leads, budgets, BOMs, and work orders.

Isolation is enforced centrally by a Prisma Client Extension (`src/tenant-scoping.extension.ts`) that reads the current request's tenant from an `AsyncLocalStorage`-backed context (`src/tenant-context.ts`), populated per-request by a `TenantContextInterceptor` — individual services never need to remember to filter by `tenantId` themselves. `CurrencyRate`, `Plugin`, and `FeatureFlag` are deliberately left global (shared/platform-level config, not per-tenant).

`POST /auth/register` creates a brand-new tenant (new company signup); `POST /auth/users` (admin-only) adds a user to the calling admin's own tenant automatically, via the same ambient context.

---

## Web App

The React + Vite web app (`frontend/`, its own [README](frontend/README.md) covers local dev commands) mirrors every backend module above with a full admin/back-office UI, plus a dedicated Odoo-style **POS terminal** (`/pos/session`) with a product grid, cart, Qty/%/Price numpad, payment tile screen, M-Pesa pending-transaction panel, cash-register open/close with daily reconciliation, and a show/hide column picker on the Orders list. Receipts and invoices render in 3 selectable designs each (Standard/Compact/Branded receipts; Modern/Classic/Minimal A4 invoices), printable or saved as PDF.

---

## Mobile App

A native Expo/React Native app (`mobile/`, see `mobile/AGENTS.md` for Expo-specific dev notes) over the same REST API — not a cut-down companion app, but POS-feature parity with the web terminal:

- **Tabs**: Dashboard, POS, Sales, Alerts, Profile for every user; POS-only accounts see just POS + Profile, matching the web app's own role restriction.
- **Admin Tools** (under Profile, ADMIN/ACCOUNTANT/INVENTORY_MANAGER as applicable): Stock receiving, eTIMS monitoring, Business Reports (P&L-based profit trend, top products/customers), AI Insights, Branch Comparison, Accounting Reports (Balance Sheet, Cash Flow, Aged Receivables/Payables, VAT Return).
- **POS terminal**: real checkout (create → approve → stock deduction), M-Pesa STK push, KRA eTIMS QR receipt, cash-register open/close, PIN-based quick register unlock with auto-lock on backgrounding, held/parked orders queue, order detail + refund (via Credit Notes) + print/reprint.
- **Offline-capable checkout**: Cash/Card/Bank Transfer/Credit sales complete and queue locally with no connectivity, syncing automatically on reconnect, app-foreground, or launch if a backlog exists — backed by an idempotent `clientRef` on invoice creation so a retried sync can't double-create a sale. M-Pesa stays online-only by design (STK push needs a live round-trip to the customer's phone). An offline receipt is unmistakably marked "not yet a tax receipt" until it syncs.

---

## Internationalization

Settings → Localization's Default Language drives a real `i18next`-based translation layer on both the web and mobile apps — not just a stored preference. Currently translated: the app shell/navigation, Login, Dashboard, and the full POS terminal, in **English, Kiswahili, and French** (every other page still renders in English and is translated incrementally using the same infrastructure).

Because the language setting lives on the authenticated tenant's `SystemSetting`, the pre-login screen can't read it — Login gets its own small, locally-persisted language switcher on both platforms, overridden by the tenant's configured language once signed in. Web's antd component chrome (date pickers, table pagination) follows along for English/French via antd's own locale packs; Kiswahili has no official antd pack, so that chrome stays English under Kiswahili while all of this app's own text is fully translated.

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

### Running the clients

The backend above serves both clients — start whichever you need separately:

```bash
# Web app
cd frontend && npm install && npm run dev          # see frontend/README.md for details

# Mobile app
cd mobile && npm install --legacy-peer-deps && npx expo start   # see mobile/AGENTS.md for Expo-specific notes
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
REFRESH_TOKEN_EXPIRES_DAYS=30

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
| `POST` | `/auth/login` | Login, receive access + refresh token | Public |
| `POST` | `/auth/refresh` | Exchange a refresh token for a new access token (rotates it) | Public |
| `POST` | `/auth/logout` | Revoke a refresh token | Public |
| `GET` | `/auth/profile` | Current user profile | Authenticated |
| `POST` | `/auth/set-pin` | Set/update the current user's quick-unlock PIN | Authenticated |
| `POST` | `/auth/verify-pin` | Verify the PIN to re-unlock an already-valid session (rate-limited 5/min) | Authenticated |
| `GET` | `/auth/users` | List all users | Admin |
| `POST` | `/auth/users` | Create user (accepts `branchId` — sets the user's home branch/outlet) | Admin |
| `PATCH` | `/auth/users/:id` | Update user (incl. `branchId`) | Admin |
| `POST` | `/auth/users/:id/reset-password` | Reset user password | Admin |
| `PATCH` | `/auth/users/:id/deactivate` | Deactivate user | Admin |
| `PATCH` | `/auth/users/:id/access` | Toggle POS-only access flag | Admin |

> `branchId` on a user drives the "Point of Sale" column on the Orders list and the default branch for a cashier's POS sessions — it's the cashier's own assigned outlet, independent of whichever warehouse a sale happens to be fulfilled from.

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
| `POST` | `/sales/invoices` | Create invoice (accepts an optional `clientRef` for idempotent retries — e.g. offline mobile sync — so a dropped response can't double-create a sale) |
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

> Refunds are modeled as Credit Notes, not a separate "refund" concept: cashiers draft one from an order's detail screen (web or mobile), ADMIN/ACCOUNTANT auto-approve it with stock restored in the same action.

#### POS Sessions (cash register)

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/sales/pos-sessions/open` | Open a cash-register shift for the current cashier (defaults to the cashier's own assigned branch unless one is passed explicitly) |
| `POST` | `/sales/pos-sessions/:id/close` | Close a shift, recording the closing note and per-payment-method cash counts |
| `GET` | `/sales/pos-sessions/current` | Get the current cashier's open session, if any |

> Mounted under `/sales/` deliberately — it inherits the existing POS-only route allowlist with zero guard changes. Every invoice created or approved during an open session is stamped with `cashierId`/`posSessionId`, which is what drives the Orders list's Cashier/Session/Point-of-Sale columns.

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
| `GET` | `/accounting/reports/trial-balance` | `date` | Trial balance |
| `GET` | `/accounting/reports/profit-and-loss` | `startDate`, `endDate` | P&L — revenue minus **COGS** (posted automatically on invoice approval) minus other expenses |
| `GET` | `/accounting/reports/balance-sheet` | `date` | Balance sheet |
| `GET` | `/accounting/reports/cash-flow` | `startDate`, `endDate` | Cash flow statement |
| `GET` | `/accounting/reports/aged-receivables` | `asOf` | Aged receivables |
| `GET` | `/accounting/reports/aged-payables` | `asOf` | Aged payables |
| `GET` | `/accounting/reports/general-ledger` | `startDate`, `endDate`, `accountId` | General ledger |
| `GET` | `/accounting/reports/vat-return` | `startDate`, `endDate` | VAT return |
| `GET` | `/accounting/reports/payment-modes` | `startDate`, `endDate`, `paymentMethod?` | Sales vs bank by payment mode |

#### Budgets

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/budgets` | Create budget |
| `GET` | `/budgets` | List budgets |
| `GET` | `/budgets/:id` | Get budget |
| `PATCH` | `/budgets/:id` | Update budget |
| `PATCH` | `/budgets/:id/status` | Change status (DRAFT/ACTIVE/CLOSED) |
| `POST` | `/budgets/:id/lines` | Add a budget line (account/period/amount) |
| `DELETE` | `/budgets/:id/lines/:lineId` | Remove a budget line |
| `GET` | `/budgets/:id/vs-actual` | Budget vs. actual spend comparison |

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

> Product `unitPrice` is treated as **VAT-inclusive** (tax is extracted, not added on top). A separate `costPrice` (buying price) plus a per-product `costPriceIncludesVat` default drives both Cost of Goods Sold on sale approval and the pre-fill (overridable per line) on Purchase Orders/RFQs/Vendor Bills.

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

### CRM — `/crm`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/crm/leads` | List / search leads |
| `GET` | `/crm/pipeline` | Leads grouped by pipeline stage |
| `GET` | `/crm/leads/:id` | Get lead |
| `POST` | `/crm/leads` | Create lead |
| `PATCH` | `/crm/leads/:id` | Update lead |
| `PATCH` | `/crm/leads/:id/stage` | Move lead to a different pipeline stage |
| `POST` | `/crm/leads/:id/activities` | Log an activity/note on a lead |

---

### Manufacturing (MRP) — `/mrp`

#### Bills of Materials

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/mrp/bom` | Create BOM |
| `GET` | `/mrp/bom` | List BOMs |
| `GET` | `/mrp/bom/:id` | Get BOM |
| `PATCH` | `/mrp/bom/:id` | Update BOM |
| `PATCH` | `/mrp/bom/:id/status` | Change BOM status |
| `POST` | `/mrp/bom/:id/lines` | Add a component line |
| `GET` | `/mrp/bom/:id/availability` | Check component stock availability |

#### Work Orders

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/mrp/work-orders` | Create work order |
| `GET` | `/mrp/work-orders` | List work orders |
| `GET` | `/mrp/work-orders/:id` | Get work order |
| `PATCH` | `/mrp/work-orders/:id/confirm` | Confirm work order |
| `PATCH` | `/mrp/work-orders/:id/start` | Start production |
| `PATCH` | `/mrp/work-orders/:id/complete` | Complete — consumes components, produces output stock |
| `PATCH` | `/mrp/work-orders/:id/cancel` | Cancel work order |

---

### Branches — `/branches`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/branches` | List branches |
| `GET` | `/branches/comparison` | Rank every active branch by revenue for a date range (`from`, `to`) |
| `GET` | `/branches/:id` | Get branch |
| `GET` | `/branches/:id/report` | Single-branch performance report |
| `POST` | `/branches` | Create branch |
| `PATCH` | `/branches/:id` | Update branch |
| `DELETE` | `/branches/:id` | Delete branch |

---

### Tax — `/tax`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/tax/rates` | Create tax rate |
| `GET` | `/tax/rates` | List tax rates |
| `GET` | `/tax/rates/:id` | Get tax rate |
| `PATCH` | `/tax/rates/:id` | Update tax rate |
| `POST` | `/tax/rates/:id/set-default` | Set as default rate |
| `POST` | `/tax/rates/:id/deactivate` | Deactivate rate |
| `POST` | `/tax/groups` | Create tax group |
| `GET` | `/tax/groups` | List tax groups |
| `GET` | `/tax/groups/:id` | Get tax group |
| `PATCH` | `/tax/groups/:id` | Update tax group |
| `DELETE` | `/tax/groups/:id` | Delete tax group |
| `GET` | `/tax/reports/vat-return` | VAT return report |
| `GET` | `/tax/reports/wht` | Withholding tax report |
| `GET` | `/tax/reports/summary` | Annual tax summary |

---

### Analytics — `/analytics`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/analytics/sales-trend` | Sales trend over a period |
| `GET` | `/analytics/expense-trend` | Expense trend over a period |
| `GET` | `/analytics/profit-trend` | Profit trend over a period |
| `GET` | `/analytics/top-products` | Best-selling products |
| `GET` | `/analytics/top-customers` | Highest-value customers |
| `GET` | `/analytics/sales-by-payment-method` | Sales split by payment method |
| `GET` | `/analytics/inventory-summary` | Stock-level summary |

---

### AI Insights — `/ai-insights`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/ai-insights` | Stock alerts, sales-trend callouts, payment-risk flags, dormant-customer detection |

---

### Workflow / Approvals — `/workflow/requests`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/workflow/requests` | List approval requests |
| `POST` | `/workflow/requests` | Create an approval request |
| `POST` | `/workflow/requests/run-overdue-check` | Sweep and flag overdue requests |
| `POST` | `/workflow/requests/:id/approve` | Approve a request |
| `POST` | `/workflow/requests/:id/reject` | Reject a request |

---

### Audit Log — `/audit/logs`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/audit/logs` | List audit log entries (who changed what, when) |

---

### Plugins & Feature Flags

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/plugins` | Register a plugin |
| `GET` | `/plugins` | List plugins |
| `GET` | `/plugins/active` | List active plugins |
| `GET` | `/plugins/:id` | Get plugin |
| `PATCH` | `/plugins/:id/activate` | Activate plugin |
| `PATCH` | `/plugins/:id/deactivate` | Deactivate plugin |
| `PATCH` | `/plugins/:id/config` | Update plugin config |
| `DELETE` | `/plugins/:id` | Remove plugin |
| `POST` | `/feature-flags` | Create feature flag |
| `GET` | `/feature-flags` | List feature flags |
| `GET` | `/feature-flags/enabled` | List enabled flags |
| `GET` | `/feature-flags/:key/check` | Check whether a flag is enabled |
| `PATCH` | `/feature-flags/:key/toggle` | Toggle a flag |
| `PATCH` | `/feature-flags/:key` | Update a flag |
| `DELETE` | `/feature-flags/:key` | Delete a flag |

---

### Notifications — `/notifications`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/notifications/unread` | List unread notifications |
| `GET` | `/notifications/unread-count` | Unread count (for the bell badge) |
| `GET` | `/notifications` | List all notifications (paginated) |
| `PATCH` | `/notifications/mark-all-read` | Mark all as read |
| `PATCH` | `/notifications/:id/read` | Mark one as read |
| `POST` | `/notifications/reminders/overdue-invoices` | Trigger overdue-invoice reminder sweep |

---

### Mobile (API) — `/mobile`

Lightweight, aggregated endpoints purpose-built for the mobile app's screens — not general CRUD, so they don't duplicate the module-specific endpoints above.

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/mobile/dashboard` | Aggregated dashboard stats for the mobile Dashboard tab |
| `GET` | `/mobile/pos-data` | Products, customers, warehouses bundled for the POS tab |
| `GET` | `/mobile/search` | Cross-entity quick search |
| `GET` | `/mobile/recent-invoices` | Recent invoices for the Sales tab |
| `GET` | `/mobile/sync-status` | Offline-queue sync status |

---

### eTIMS (KRA) — `/etims`

| Method | Path | Description | Roles |
| -------- | ------ | ------------- | ------- |
| `GET` | `/etims/stats` | Submission statistics | Admin, Accountant |
| `GET` | `/etims/failed` | List failed submissions | Admin, Accountant |
| `GET` | `/etims/queue/status` | BullMQ queue status | Admin |
| `POST` | `/etims/queue/retry-all` | Retry every failed submission in the queue | Admin |
| `GET` | `/etims/invoice/:invoiceId/status` | Submission status for one invoice | Admin, Accountant, Sales User |
| `GET` | `/etims/invoice/:invoiceId/qr` | QR code for the receipt (falls back to a "provisional" QR via a retry loop if the real one isn't ready yet) | Admin, Accountant, Sales User |
| `POST` | `/etims/invoice/:invoiceId/submit` | Manually queue an invoice for submission | Admin, Accountant |
| `POST` | `/etims/invoice/:invoiceId/retry` | Retry a failed submission | Admin, Accountant |

Automatic submission queues via BullMQ when an invoice is approved and `ETIMS_ENV` is configured. The `status`/`qr` endpoints are POS-only reachable too (a posOnly cashier token's route allowlist permits both), so cashier accounts get the real QR, not just the provisional one.

---

### Settings — `/settings`

| Method | Path | Description |
| -------- | ------ | ------------- |
| `GET` | `/settings/system` | Get per-tenant system settings — company profile (name, logo, PIN, address, phone), payment instructions, invoice/receipt template choice + branding toggle, `defaultCurrency`/`timezone`/`defaultLanguage`, low-stock threshold, auto-approve drafts |
| `PATCH` | `/settings/system` | Update system settings |

> `defaultLanguage` drives real UI translation (see [Internationalization](#internationalization)) on both web and mobile — not just a stored preference. `invoiceTemplate`/`receiptTemplate` select one of 3 designs each (Modern/Classic/Minimal invoices; Standard/Compact/Branded receipts), used consistently across web POS, web Sales, mobile POS, and mobile Sales.

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
    C -- Yes --> E[POST approve — APPROVED\nPosts AR + Revenue + VAT + COGS entries, deducts stock]
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
    subgraph Clients["Clients (i18next: en / sw / fr)"]
        WEB[Web — React + Vite + antd]
        MOB[Mobile — Expo / React Native]
    end

    subgraph API["Backend API (NestJS)"]
        AUTH[Auth]
        SALES[Sales / POS]
        MPESA[M-Pesa]
        PROC[Procurement]
        ACC[Accounting / Budgets]
        INV[Inventory / MRP]
        HR[HR and Payroll]
        CRMCONT[Contacts / CRM]
        BRANCH[Branches]
        ETIMS[eTIMS]
        ANALYTICS[Analytics / AI Insights]
        NOTIF[Notifications / Workflow]
        SET[Settings]
    end

    subgraph Tenancy["Tenant Scoping"]
        EXT["Prisma Client Extension<br/>+ AsyncLocalStorage context"]
    end

    subgraph Infra["Infrastructure"]
        PRISMA[Prisma ORM]
        DB[(PostgreSQL)]
        REDIS[(Redis)]
        DARAJA[Safaricom Daraja]
        KRA[KRA eTIMS API]
    end

    WEB -- JWT REST --> AUTH
    MOB -- JWT REST --> AUTH
    WEB --> SALES
    MOB --> SALES
    WEB --> PROC
    WEB --> ACC
    WEB --> INV
    WEB --> HR
    WEB --> CRMCONT
    WEB --> BRANCH
    MOB --> ANALYTICS

    SALES -- posts GL entries incl. COGS --> ACC
    SALES -- STK push --> MPESA
    MPESA -- callback --> SALES
    MPESA --> DARAJA
    PROC -- posts AP entries --> ACC
    PROC -- updates stock --> INV
    SALES -- stock check --> INV
    ETIMS --> KRA
    NOTIF -- low-stock alerts --> INV

    AUTH --> EXT
    SALES --> EXT
    PROC --> EXT
    ACC --> EXT
    INV --> EXT
    HR --> EXT
    CRMCONT --> EXT
    BRANCH --> EXT
    ETIMS --> EXT
    ANALYTICS --> EXT
    NOTIF --> EXT
    SET --> EXT

    EXT --> PRISMA
    PRISMA --> DB
    ETIMS --> REDIS
    ACC --> REDIS
```

---

## Operational Guide

### Sales to Accounting flow

1. Create sales invoice (DRAFT).
2. Approve invoice — AR debit, Revenue credit, VAT credit posted automatically, plus a **COGS debit / Inventory credit** using each line's product `costPrice` (skipped per-line, never blocks the sale, if a product has no buying price set yet).
3. Collect payment and mark invoice PAID with accurate payment method.
4. Payment entry posted — available for bank reconciliation.
5. A refund reverses symmetrically via a Credit Note: stock restored, COGS reversed, AR/VAT reversed into the correct accounts.

### Cash register (POS session) flow

1. Cashier verifies/unlocks the terminal — a `PosSession` opens automatically, defaulting to the cashier's own assigned branch.
2. Sales during the session are stamped with the cashier and session, driving the Orders list's Cashier / Session / Point of Sale columns.
3. **Close Register** at end of shift — closing note and per-payment-method cash counts are now actually persisted (previously discarded).

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

### Offline mobile sale flow

1. Cashier rings up a Cash/Card/Bank Transfer/Credit sale on mobile with no connectivity — it completes locally and queues (M-Pesa stays online-only; its tile greys out while offline).
2. On reconnect, app foreground, or next launch, the queue syncs automatically against `POST /sales/invoices` using its idempotent `clientRef` — a dropped response and retry can't double-create the sale.
3. A sale that genuinely can't sync (e.g. stock ran out while offline) lands in a Failed state for manual retry without blocking the rest of the queue.
4. The on-screen/printed receipt is clearly marked "not yet a tax receipt" until the sale has synced and received its eTIMS QR.

---

## Role-Based User Manual

### Admin

- Manage users, roles, branch assignment, and the POS-only access flag.
- Configure company profile, logo, tax PIN, eTIMS environment, invoice/receipt templates, and localization (language/timezone/currency).
- Manage branches, plugins, and feature flags.
- Review cross-module dashboards (Analytics, AI Insights, Branch Comparison), the Audit Log, and approve sensitive actions (Workflow approvals).

### Accountant

- Review and approve invoices, credit notes, and vendor bills.
- Import bank statements and run auto-match reconciliation.
- Generate all financial reports (trial balance, P&L with COGS, balance sheet, cash flow, general ledger, aged receivables/payables, VAT return, WHT, payment mode report).
- Manage budgets and review budget-vs-actual.
- Investigate variance between payment channels and bank records.

### Cashier / Sales User

- Open/close a cash-register (POS) session each shift; sales during it are automatically attributed to the cashier and session.
- Create, approve, and pay invoices from POS (web or mobile) — on mobile, sales queue and sync automatically if offline (M-Pesa excepted).
- Select or create customers directly in the POS dropdown.
- Initiate M-Pesa STK push and monitor the pending queue panel.
- Retry or manually reconcile failed M-Pesa transactions without leaving POS.
- Draft a refund via Credit Note from any order's detail screen; print/reprint receipts.
- Review daily summary by payment method.
- Set a quick-unlock PIN and use it to re-enter a locked register without a full re-login.

### Procurement Officer

- Create and send RFQs to suppliers.
- Confirm purchase orders, choosing VAT-inclusive or VAT-exclusive pricing per line where it differs from the product's default.
- Record goods receipt (updates stock).
- Create vendor bills for accountant validation and payment.

### Inventory Manager

- Manage products (including buying/cost price), categories, and warehouses.
- Record stock movements and manual adjustments.
- Create and validate physical stock counts.
- Manage serial numbers and lot tracking.
- Apply landed costs to received stock.
- Manage bills of materials and work orders for manufactured products.

### HR Manager

- Maintain employee records and departments.
- Generate, approve, and pay payroll runs; print payslips.
- Manage attendance (clock-in/out, bulk import), leave, allowances, and loans.
- Run appraisals and the full recruitment pipeline (posting → application → interview → offer → hire).

### Sales / Marketing (CRM)

- Track leads through pipeline stages and log activities.
- Follow up using the Workflow approvals queue for anything requiring sign-off.

---

## Daily Checklists

### Sales and Cash Controls

- [ ] All completed sales are approved.
- [ ] All paid invoices have the correct `paymentMethod`.
- [ ] M-Pesa pending queue is clear — no stuck transactions.
- [ ] Daily summary totals reviewed per payment method.
- [ ] Cash register closed at end of shift with an accurate closing count.
- [ ] Mobile offline queue is empty — no sales stuck in Failed state.
- [ ] Products sold today have a buying price set (otherwise today's COGS/P&L understates true cost).

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
| `"property X should not exist"` on a create/update call | DTO class has zero class-validator decorators — the global `whitelist + forbidNonWhitelisted` pipe strips/rejects every undecorated field | Add class-validator decorators to every field on the DTO; put new DTOs under that module's `dto/` folder, not inline in the service |
| Branch dropdown is empty | No `Branch` rows exist yet for this tenant | Create at least one branch in Settings → Branches |
| Orders list shows "—" for Session / Point of Sale / Cashier | Sale predates POS session tracking, or the cashier has no `branchId` assigned | Assign the cashier a branch in Settings → Users; expected for historical sales made before this feature shipped |
| P&L shows 100% of revenue as profit | Sold products have no `costPrice` set yet | Enter a buying price on each product in Inventory → Products |

---

## Developer Notes

- Always run `npx prisma migrate deploy` after pulling schema changes.
- Use explicit DTOs (under that module's `dto/` folder, with real class-validator decorators) for any finance-critical field additions — the global pipe silently strips/rejects undecorated fields, and this is invisible to unit tests since they call services directly, bypassing HTTP validation.
- Run `npx tsc --noEmit` and `npm run lint` before committing (backend). For the web app: `cd frontend && npx tsc -b && npm run build && npx eslint <paths>`. For mobile: `cd mobile && npx tsc --noEmit && npx eslint --fix <paths> && npx expo-doctor` (aim for 20/20).
- `MPESA_CALLBACK_URL` must be a publicly reachable HTTPS URL — use `npm run ngrok:update` during local development.
- Leave `MPESA_CALLBACK_IP_ALLOWLIST` and `MPESA_CALLBACK_SIGNATURE_SECRET` empty for sandbox; set them for production hardening.
- BullMQ jobs (eTIMS) require Redis — ensure the Docker container is running.
- POS idle timeout (web) is 5 minutes; the screen locks and requires password or PIN re-entry. Mobile locks as soon as the app leaves the foreground instead, matching standard mobile POS/banking-app behavior.
- The `scripts/update-ngrok-url.js` helper uses only Node.js built-in modules — no additional npm install required.
- Every model scoped by `tenantId` is enforced automatically via the Prisma Client Extension (`src/tenant-scoping.extension.ts`) — don't hand-filter by tenant in a service; populate the ambient context instead (`src/tenant-context.ts`) if writing a one-off script (see `scripts/backfill-cogs.ts` for the pattern: `NestFactory.createApplicationContext` + `tenantContextStorage.run({tenantId}, ...)`, looped defensively per tenant).
- Any new money-calculation code (invoice/bill/quote/PO/RFQ line items) must go through the shared tax helpers — `extractTax()`/`addTax()`/`computeLineTax()` in `src/common/utils/tax.util.ts` (mirrored in `frontend/src/utils/tax.ts` and `mobile/src/utils/tax.ts`) — rather than a new inline formula. Prices are VAT-**inclusive** by default; `isTaxInclusive`/`costPriceIncludesVat` flags let a purchase line override that per item.
- Any new translatable web/mobile screen should read the existing `common`/`nav`/`auth`/`dashboard`/`pos` namespace JSON files under `<app>/src/i18n/locales/{en,sw,fr}/` for reusable keys before adding new ones, and add the matching `sw`/`fr` translations in the same pass — i18next's `fallbackLng: 'en'` will silently mask a missing translation rather than erroring. Web and mobile locale files are separate and not auto-synced.
