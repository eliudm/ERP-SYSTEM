# Nexora ERP System

A full-featured, multi-module ERP system built for Kenyan SMEs. Covers sales, accounting, inventory, procurement, HR, POS, CRM, MRP, messaging, analytics, and KRA eTIMS compliance — all in a single self-hosted stack.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Ant Design v6, Recharts, TanStack Query, Zustand |
| Backend | NestJS 11, TypeScript, Prisma ORM |
| Database | PostgreSQL 15 |
| Queue / Cache | Redis 7, BullMQ |
| Auth | JWT (access + refresh tokens), role-based guards |
| Payments | M-Pesa (Daraja), Stripe, PayPal |
| Tax compliance | KRA eTIMS (VSCU/OSCU) |
| Messaging | Africa's Talking (SMS + WhatsApp) |
| Infra | Docker, Nginx |

---

## Modules

| Module | Features |
|---|---|
| **Dashboard** | KPI tiles, revenue area chart, period preset selector |
| **Sales** | Quotations, invoices, customers, credit notes, price lists |
| **Point of Sale** | POS terminal, orders, products, reporting, credit |
| **Accounting** | Chart of accounts, journal entries, bank accounts, expenses |
| **Financial Reports** | Trial balance, P&L, balance sheet, cash flow, general ledger, aged receivables/payables |
| **Tax** | Tax rates, VAT reports |
| **Budget** | Budget lines, budget vs actual |
| **Inventory** | Products, warehouses, stock movements, transfers, counts, lots, serial numbers, valuation |
| **Procurement** | Suppliers, RFQs, purchase orders, vendor bills, purchase returns |
| **HR** | Employees, payroll, leave, attendance, recruitment, appraisals, allowances & loans |
| **CRM** | Lead pipeline, stages, conversion tracking |
| **MRP** | Bills of materials, work orders |
| **Analytics** | Sales, Product, POS, Leads, Pipeline, Accounting, Invoicing, Benchmark, Expenses, Warehouse |
| **eTIMS** | KRA electronic tax invoicing, BullMQ submission queue, QR codes, retry logic |
| **Messaging** | SMS & WhatsApp campaigns, templates, customer segments, analytics (Africa's Talking) |
| **Workflow** | Approval requests for invoices, purchase orders, payroll |
| **AI Insights** | Stock alerts, sales trends, payment risks, top customers |
| **Settings** | Company, users, tax rates, localization, messaging config, billing |
| **Support & Help** | Ticket system, FAQ knowledge base |

---

## Prerequisites

- Node.js 20+
- Docker Desktop
- Git

---

## Local Development

### 1. Start the database and Redis

```bash
docker-compose up -d
```

### 2. Install dependencies

```bash
# Backend
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 3. Set up environment

```bash
cp .env.production.example .env
# Edit .env — for local dev the defaults work without payment/eTIMS credentials
```

Minimum `.env` for local dev:

```env
DATABASE_URL=postgresql://erpuser:erppassword@localhost:5434/erpdb
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=any_long_random_string_for_dev
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:5173
```

### 4. Run database migrations

```bash
npx prisma migrate dev
npx prisma db seed   # optional — adds demo data
```

### 5. Start the servers

```bash
# Backend (watch mode) — runs on http://localhost:3000
npm run start:dev

# Frontend (separate terminal) — runs on http://localhost:5173
cd frontend && npm run dev
```

API docs available at `http://localhost:3000/api/docs` (dev only).

---

## Production Deployment

### 1. Prepare environment

```bash
cp .env.production.example .env
# Fill in all required values — see comments in the file
```

Generate secrets:

```bash
# JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# M-Pesa callback token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Build the frontend

```bash
cd frontend && npm run build && cd ..
# Output: frontend/dist/
```

### 3. Add SSL certificate

Place your certificate files in `nginx/ssl/`:

```
nginx/ssl/fullchain.pem
nginx/ssl/privkey.pem
```

Free certificates via [Certbot](https://certbot.eff.org/) / Let's Encrypt.

### 4. Update nginx domain

Edit [nginx/nginx.conf](nginx/nginx.conf) — replace `erp.yourdomain.com` with your actual domain.

### 5. Create the named Docker volume (first time only)

```bash
docker volume create erp-backend_postgres_data
```

### 6. Launch the production stack

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 7. Run migrations

```bash
docker exec erp_backend npx prisma migrate deploy
```

---

## Environment Variables

See [.env.production.example](.env.production.example) for the full reference with comments.

Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_PASSWORD` | Redis auth password (leave empty for no auth in dev) |
| `JWT_SECRET` | 64+ char random hex string — **change before deploying** |
| `CORS_ORIGIN` | Comma-separated allowed origins, e.g. `https://erp.yourdomain.com` |
| `MPESA_*` | Safaricom Daraja credentials and callback URL |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_` in production) |
| `ETIMS_SELLER_PIN` | KRA PIN registered via iTax VSCU |
| `ETIMS_DEVICE_SERIAL` | VSCU device serial from iTax registration |
| `ETIMS_ENV` | `sandbox` or `production` |

---

## eTIMS (KRA) Setup

eTIMS enables legally compliant electronic tax invoices submitted directly to Kenya Revenue Authority.

1. Log in to [iTax](https://itax.kra.go.ke)
2. Register a VSCU device under your PIN
3. Set `ETIMS_SELLER_PIN`, `ETIMS_DEVICE_SERIAL`, `ETIMS_ENV=production`
4. Test connection from **Settings → eTIMS → Test Connection**

Invoices are submitted automatically on approval via a BullMQ queue with exponential-backoff retries (max 10 attempts).

---

## Messaging Setup

1. Create an account at [africastalking.com](https://africastalking.com)
2. Go to **Settings → Messaging** in the app
3. Enter your Africa's Talking username, API key, sender ID, and WhatsApp number
4. Enable SMS and/or WhatsApp and save

---

## Project Structure

```
erp/
├── src/                    # NestJS backend
│   ├── modules/            # Feature modules (sales, hr, etims, …)
│   ├── prisma.service.ts
│   ├── cache.service.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma       # Database schema
├── frontend/
│   ├── src/
│   │   ├── pages/          # React pages (one folder per module)
│   │   ├── api/            # API client functions
│   │   ├── store/          # Zustand stores
│   │   └── App.tsx
│   └── vite.config.ts
├── nginx/
│   └── nginx.conf          # Reverse proxy + SSL config
├── Dockerfile              # Multi-stage backend build
├── docker-compose.yml      # Local dev (Postgres + Redis)
├── docker-compose.prod.yml # Production stack
└── .env.production.example # Environment variable reference
```
