import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

const SEED_DATA = [
  {
    category: { name: 'Getting Started', slug: 'getting-started', icon: 'rocket', sortOrder: 1 },
    articles: [
      {
        title: 'How to set up your company',
        slug: 'setup-company',
        tags: ['setup', 'company', 'onboarding'],
        content: `## Setting up your company\n\n1. Go to **Settings → Company**\n2. Fill in your company name, address, logo, and KRA PIN\n3. Set your default currency (KES)\n4. Add your VAT registration number if you are VAT-registered\n5. Save changes\n\n> Your company name and logo appear on all invoices, receipts, and reports.\n\n**Recommended next steps after setup:**\n- Add your users (Settings → Users)\n- Add your products (Inventory → Products)\n- Add your customers (Contacts → Customers)\n- Create your first invoice (Sales → Invoices)`,
      },
      {
        title: 'First-time setup checklist',
        slug: 'setup-checklist',
        tags: ['setup', 'onboarding', 'checklist'],
        content: `## First-time setup checklist\n\nComplete these steps to get your ERP fully operational:\n\n**Step 1 — Company profile**\n- [ ] Company name, address, phone, email\n- [ ] KRA PIN / VAT number\n- [ ] Company logo\n- [ ] Default currency (KES)\n\n**Step 2 — Users & Access**\n- [ ] Add team members (Settings → Users)\n- [ ] Assign correct roles to each user\n- [ ] Each user sets their own password on first login\n\n**Step 3 — Products & Inventory**\n- [ ] Add product categories\n- [ ] Import or add products with cost and selling prices\n- [ ] Set opening stock quantities\n\n**Step 4 — Customers & Suppliers**\n- [ ] Import your existing customer list\n- [ ] Add key suppliers\n\n**Step 5 — Finance setup**\n- [ ] Set the financial year start month (Settings → Finance)\n- [ ] Configure tax rates (Settings → Tax)\n- [ ] Set payment terms defaults\n\n**Step 6 — Go live**\n- [ ] Create and approve your first invoice\n- [ ] Run a test payroll\n- [ ] Submit a test support ticket`,
      },
      {
        title: 'Adding your first product',
        slug: 'add-product',
        tags: ['products', 'inventory', 'setup'],
        content: `## Adding products\n\n1. Go to **Inventory → Products**\n2. Click **New Product**\n3. Fill in:\n   - **Name** — what appears on invoices\n   - **SKU** — your internal product code\n   - **Unit Price** — the selling price (excl. VAT)\n   - **Cost Price** — what you paid (used for profit reports)\n   - **VAT Rate** — 16% standard, 0% exempt\n   - **Reorder Level** — minimum stock before an alert fires\n   - **Category** — for filtering and reporting\n4. Click Save\n\n**Tip:** Import multiple products at once using the **Import CSV** button. Download the template first to see the required column format.`,
      },
      {
        title: 'Creating your first invoice',
        slug: 'create-invoice',
        tags: ['invoice', 'sales', 'setup'],
        content: `## Creating an invoice\n\n1. Go to **Sales → Invoices**\n2. Click **New Invoice**\n3. Select or search for a customer (type the name)\n4. Set the invoice date and due date\n5. Add line items — type a product name to search, set quantity and unit price\n6. Add any notes or payment instructions in the Notes field\n7. Click **Save** (saves as DRAFT)\n8. Review the totals, then click **Approve** to finalise\n\n> **Only APPROVED invoices affect your financial reports, stock levels, and accounting.**\n\n**Sending the invoice:** After approving, click **Send** to email it to the customer, or **Download PDF** to send manually.`,
      },
      {
        title: 'Understanding user roles and permissions',
        slug: 'user-roles',
        tags: ['users', 'roles', 'permissions', 'access'],
        content: `## User roles\n\nEach user is assigned one role that controls what they can see and do:\n\n| Role | Access |\n|------|--------|\n| **ADMIN** | Full access to everything including settings, users, and all financial data |\n| **ACCOUNTANT** | Finance module, general ledger, reports, journal entries |\n| **SALES_USER** | Sales, invoices, credit notes, customers, POS |\n| **INVENTORY_MANAGER** | Products, stock movements, purchase orders, warehouses |\n| **HR_MANAGER** | Employees, payroll, leave, attendance |\n| **PROCUREMENT_OFFICER** | Purchase orders, suppliers, goods receipt |\n\n**To add a user:** Settings → Users → New User. Enter their name, email, and role. They receive an email with a link to set their password.\n\n**To change a role:** Settings → Users → click the user → Edit → change Role → Save.`,
      },
      {
        title: 'How to import data from Excel or CSV',
        slug: 'import-data',
        tags: ['import', 'csv', 'excel', 'bulk', 'data'],
        content: `## Importing data\n\nYou can bulk-import the following:\n- **Products** — Inventory → Products → Import CSV\n- **Customers** — Contacts → Customers → Import CSV\n- **Suppliers** — Contacts → Suppliers → Import CSV\n- **Opening stock** — Inventory → Stock Movements → Import\n\n**How to import:**\n1. Click the **Import** button on the list page\n2. Download the **CSV template** — this shows the exact column names required\n3. Fill in your data in the template (do not change column headers)\n4. Upload the completed file\n5. Review the preview — the system shows any rows with errors\n6. Click **Confirm Import**\n\n**Common errors:**\n- Missing required columns (Name, Price)\n- Duplicate SKU codes\n- Invalid date formats (use YYYY-MM-DD)\n- Numbers with currency symbols (use plain numbers: 1500, not KES 1,500)`,
      },
    ],
  },
  {
    category: { name: 'Sales & Invoicing', slug: 'sales', icon: 'dollar', sortOrder: 2 },
    articles: [
      {
        title: 'Invoice status explained',
        slug: 'invoice-statuses',
        tags: ['invoice', 'status', 'paid', 'draft'],
        content: `## Invoice statuses\n\n| Status | Meaning |\n|--------|--------|\n| **DRAFT** | Not yet finalised. Can be edited freely. Does not affect stock or accounting. |\n| **APPROVED** | Finalised. Stock deducted. Journal entry posted. Cannot be edited. |\n| **PAID** | Fully paid. CreditPayment recorded. |\n| **PARTIAL** | Partially paid — a payment has been made but balance remains. |\n| **OVERDUE** | Past due date with an outstanding balance. |\n| **VOID** | Cancelled. Reversed in accounting. Stock restored. |\n\n**Common issue: Invoice stuck in DRAFT?**\nMake sure all required fields are filled (customer, at least one line item, invoice date) and click **Approve**, not just Save.`,
      },
      {
        title: 'How to record a payment on a credit invoice',
        slug: 'credit-payment',
        tags: ['credit', 'payment', 'outstanding', 'balance'],
        content: `## Recording credit payments\n\n1. Open the approved invoice (Sales → Invoices → click the invoice)\n2. Click **Record Payment**\n3. Enter:\n   - **Amount** — the amount received\n   - **Payment Method** — Cash, M-Pesa, Bank Transfer, Cheque\n   - **Reference** — M-Pesa code, cheque number, or bank ref\n   - **Date** — the actual payment date\n4. Click **Save**\n\nThe invoice status changes to **PAID** when the full balance is settled. Partial payments show **PARTIAL** until fully paid.\n\n**Multiple payments:** You can record multiple partial payments on one invoice. Each payment is logged in the invoice's payment history.`,
      },
      {
        title: 'How to void or cancel an invoice',
        slug: 'void-invoice',
        tags: ['void', 'cancel', 'invoice', 'reverse'],
        content: `## Voiding an invoice\n\nOnly APPROVED invoices (not yet paid) can be voided.\n\n1. Open the invoice\n2. Click the **⋮ menu** (top right) → **Void Invoice**\n3. Enter a reason (required for audit trail)\n4. Confirm\n\n**What voiding does:**\n- Sets the invoice status to VOID\n- Restores stock for all line items\n- Posts a reversing journal entry in accounting\n- The invoice remains visible for audit purposes — it cannot be deleted\n\n> **Cannot void a PAID invoice.** To reverse a paid invoice, create a **Credit Note** instead.`,
      },
      {
        title: 'How to create a credit note (refund)',
        slug: 'credit-note',
        tags: ['credit note', 'refund', 'return', 'reverse'],
        content: `## Creating a credit note\n\nA credit note reverses a sale — used for returns, overcharging, or goodwill adjustments.\n\n1. Go to **Sales → Credit Notes → New Credit Note**\n2. Link it to the original invoice by selecting the invoice number\n3. Add the returned items or enter the adjustment amount\n4. Save and Approve\n\n**What a credit note does:**\n- Reduces the customer's outstanding balance\n- Restores stock for returned items\n- Posts a reversing journal entry\n\n**Applying a credit note:** The customer's credit balance can be applied to future invoices when recording a payment.`,
      },
      {
        title: 'How to send an invoice by email',
        slug: 'send-invoice-email',
        tags: ['email', 'invoice', 'send', 'pdf'],
        content: `## Sending invoices by email\n\n1. Open an **APPROVED** invoice\n2. Click **Send Invoice**\n3. The To field pre-fills with the customer's email\n4. Add a CC email if needed\n5. Edit the email message if required\n6. Click **Send**\n\nThe customer receives a PDF invoice attached to the email.\n\n**To set a default email message:** Go to Settings → Email Templates → Invoice.\n\n**Invoice not sending?** Check:\n- Customer has an email address saved\n- Settings → Email shows a valid SMTP/SendGrid configuration\n- Check spam — the email may have been filtered`,
      },
      {
        title: 'How to set up recurring invoices',
        slug: 'recurring-invoices',
        tags: ['recurring', 'repeat', 'subscription', 'invoice'],
        content: `## Recurring invoices\n\nUse recurring invoices for customers you bill on a regular schedule (monthly rent, retainers, subscriptions).\n\n1. Create and approve a standard invoice\n2. Click **⋮ menu → Make Recurring**\n3. Set the frequency: Weekly / Monthly / Quarterly / Annually\n4. Set the start date and end date (or leave end date blank for indefinite)\n5. Save\n\nThe system auto-generates and approves the next invoice on the schedule date.\n\n**To stop a recurring invoice:** Open any invoice in the series → ⋮ → Cancel Recurrence.`,
      },
      {
        title: 'Error: Cannot approve invoice — insufficient stock',
        slug: 'insufficient-stock',
        tags: ['error', 'stock', 'approve', 'inventory'],
        content: `## Error: Insufficient stock\n\nThis error appears when you try to approve an invoice but one or more products don't have enough stock.\n\n**How to fix:**\n1. Go to **Inventory → Stock Movements → Stock In**\n2. Add the missing stock quantity for the affected product\n3. Return to the invoice and approve it\n\n**Or:** If the sale is correct and stock will be received later, ask an ADMIN to override the stock check temporarily in **Settings → Inventory → Allow Negative Stock**.\n\n> **Best practice:** Set reorder levels on products to get alerts before stock runs out.`,
      },
      {
        title: 'How to view a customer\'s outstanding balance',
        slug: 'customer-outstanding',
        tags: ['customer', 'outstanding', 'balance', 'statement', 'credit'],
        content: `## Viewing customer balances\n\n**Single customer:**\n1. Go to **Contacts → Customers**\n2. Click the customer name\n3. The **Balance** figure shows their total outstanding\n4. Scroll down to see all invoices and payments\n5. Click **Statement** to generate a PDF customer statement\n\n**All customers with balances:**\nGo to **Reports → Accounts Receivable (Debtors)**. This shows every customer with an outstanding balance, aged by 0–30 / 31–60 / 61–90 / 90+ days.`,
      },
    ],
  },
  {
    category: { name: 'Inventory', slug: 'inventory', icon: 'box', sortOrder: 3 },
    articles: [
      {
        title: 'Understanding stock movements',
        slug: 'stock-movements',
        tags: ['stock', 'inventory', 'movements'],
        content: `## Stock movements\n\nEvery change to stock is recorded as a movement:\n\n| Type | Trigger |\n|------|---------|\n| **IN** | Purchase order received, manual stock-in |\n| **OUT** | Approved invoice, manual write-off |\n| **TRANSFER** | Moving stock between warehouses/branches |\n| **ADJUSTMENT** | Stocktake correction |\n| **WASTAGE** | Damaged, expired, or lost goods |\n\nTo view the full history of a product: **Inventory → Products → click product → Stock History tab**.\n\nTo see all movements across all products: **Inventory → Stock Movements**.`,
      },
      {
        title: 'How to do a stock count (stocktake)',
        slug: 'stocktake',
        tags: ['stocktake', 'stock count', 'inventory', 'adjustment'],
        content: `## Running a stocktake\n\n1. Go to **Inventory → Stocktake → New Stocktake**\n2. Select the warehouse to count\n3. The system generates a list of all products with their expected quantities\n4. Count the physical stock and enter the actual quantities\n5. The **Variance** column shows over/under discrepancies\n6. Click **Complete** to apply the corrections as ADJUSTMENT movements\n\n**Tips:**\n- Run stocktakes at the end of business hours when stock is not moving\n- Print the stocktake sheet and count on paper first, then enter the figures\n- Investigate large variances before confirming — they could indicate theft or data entry errors`,
      },
      {
        title: 'How to transfer stock between warehouses',
        slug: 'stock-transfer',
        tags: ['transfer', 'warehouse', 'branch', 'stock', 'move'],
        content: `## Transferring stock between locations\n\n1. Go to **Inventory → Stock Transfers → New Transfer**\n2. Select **From warehouse** and **To warehouse**\n3. Add the products and quantities to transfer\n4. Click **Dispatch** — stock is deducted from the source warehouse\n5. At the destination, go to the transfer and click **Receive** — stock is added\n\n**In-transit stock:** Between Dispatch and Receive, the stock is in a "In Transit" state and is not counted in either location.`,
      },
      {
        title: 'How to record wasted or expired stock',
        slug: 'wastage',
        tags: ['wastage', 'expired', 'damaged', 'write-off', 'loss'],
        content: `## Recording wastage\n\n1. Go to **Inventory → Stock Movements → New Wastage**\n2. Select the product and quantity\n3. Choose a reason: Damaged / Expired / Theft / Spillage / Other\n4. Add a note if needed\n5. Save\n\nStock is immediately deducted. The loss is recorded in your Profit & Loss as a cost of goods adjustment.\n\n**Tip:** Use the wastage report (Reports → Inventory → Wastage Report) to track patterns and reduce losses.`,
      },
      {
        title: 'Setting up low-stock alerts',
        slug: 'low-stock-alerts',
        tags: ['low stock', 'alert', 'reorder', 'notification'],
        content: `## Low stock alerts\n\n1. Go to **Inventory → Products → click a product → Edit**\n2. Set the **Reorder Level** (the quantity at which to alert you)\n3. Save\n\nWhen stock falls to or below the reorder level:\n- A warning badge appears on the product card\n- The product appears in the **Low Stock** dashboard widget\n- An email notification is sent to the user responsible for inventory\n\n**To set email notifications:** Settings → Notifications → Inventory → Low Stock Alert → enter email addresses.`,
      },
      {
        title: 'How to receive a purchase order',
        slug: 'receive-po',
        tags: ['purchase order', 'receive', 'grn', 'goods receipt', 'stock in'],
        content: `## Receiving a purchase order\n\n1. Go to **Procurement → Purchase Orders**\n2. Find the PO with status **SENT** or **PARTIAL**\n3. Click **Receive Goods**\n4. Enter the quantities actually received (may differ from ordered)\n5. Set the warehouse to receive into\n6. Click **Confirm Receipt**\n\nStock is immediately added to the warehouse. A Goods Receipt Note (GRN) is generated for your records.\n\n**Partial deliveries:** You can receive less than ordered. The PO status changes to PARTIAL. Receive again when the balance arrives.`,
      },
      {
        title: 'Error: Product not showing in POS',
        slug: 'product-not-in-pos',
        tags: ['error', 'pos', 'product', 'missing'],
        content: `## Product not showing in POS\n\n**Check these things in order:**\n1. Product is marked **Active** — Inventory → Products → open product → Active toggle must be ON\n2. Product has a **price greater than 0**\n3. Product has **stock available** (if negative stock is disabled)\n4. Product is in a warehouse linked to your branch\n5. The product category is not hidden from POS\n\n**Still missing after checking all of the above?** Try a hard refresh of the POS page (Ctrl + Shift + R).`,
      },
    ],
  },
  {
    category: { name: 'HR & Payroll', slug: 'hr', icon: 'team', sortOrder: 4 },
    articles: [
      {
        title: 'How to add a new employee',
        slug: 'add-employee',
        tags: ['employee', 'hr', 'add', 'new staff', 'onboarding'],
        content: `## Adding a new employee\n\n1. Go to **HR → Employees → New Employee**\n2. Fill in:\n   - Full name, ID number, KRA PIN\n   - Employment date and job title\n   - Department and reporting manager\n   - Basic salary and payment method\n   - Bank account details (for bank transfer payroll)\n   - NHIF and NSSF numbers\n3. Click Save\n\n**After adding:**\n- Assign an ERP user account if the employee needs system access (Settings → Users)\n- Set up their leave balances (HR → Leave → Allocate)\n- Add any allowances or deductions in the employee record`,
      },
      {
        title: 'Running payroll',
        slug: 'run-payroll',
        tags: ['payroll', 'hr', 'salary'],
        content: `## Running payroll\n\n1. Go to **HR → Payroll → New Payroll Run**\n2. Select the **month** and **year**\n3. Select **All Departments** or a specific department\n4. The system computes:\n   - Gross pay (basic + allowances)\n   - PAYE tax (using KRA tax bands)\n   - NHIF deduction\n   - NSSF deduction\n   - Net pay\n5. Review each employee's calculation\n6. Click **Process Payroll** to finalise\n\n> Payroll posts a journal entry to accounting automatically.\n\n**After processing:**\n- Download payslips (PDF) to distribute to employees\n- Download the bank payment schedule for your bank\n- Download the KRA PAYE return file for iTax`,
      },
      {
        title: 'How to manage leave requests',
        slug: 'leave-management',
        tags: ['leave', 'annual', 'sick', 'approval', 'hr'],
        content: `## Managing leave\n\n**Employee applies:**\n1. HR → Leave → New Leave Request\n2. Select leave type (Annual, Sick, Maternity, Paternity, Compassionate)\n3. Set start and end dates\n4. Submit for approval\n\n**Manager/HR approves:**\n1. HR → Leave → Pending Approvals\n2. Review the request and remaining leave balance\n3. Click Approve or Reject (with a reason)\n\n**Leave balance setup:**\nAllocate annual leave at the start of each year: HR → Leave → Allocate Leave → select employee → set days.\n\n**Sick leave:** Does not need a balance — employees apply and HR approves based on the sick note.`,
      },
      {
        title: 'How PAYE is calculated',
        slug: 'paye-calculation',
        tags: ['paye', 'tax', 'kra', 'payroll', 'income tax'],
        content: `## PAYE (Pay As You Earn) calculation\n\nThe system uses the current KRA tax bands:\n\n| Monthly Income (KES) | Tax Rate |\n|----------------------|----------|\n| 0 – 24,000 | 10% |\n| 24,001 – 32,333 | 25% |\n| 32,334 – 500,000 | 30% |\n| 500,001 – 800,000 | 32.5% |\n| Over 800,000 | 35% |\n\n**Deductions applied before tax:**\n- Personal Relief: KES 2,400/month\n- Insurance Relief: 15% of premiums paid (if set up)\n- NHIF: deducted before tax calculation\n\n**To view the PAYE computation for an employee:** HR → Payroll → open the payroll run → click the employee name.`,
      },
      {
        title: 'Error: Employee missing from payroll run',
        slug: 'employee-missing-payroll',
        tags: ['error', 'payroll', 'employee', 'missing'],
        content: `## Employee not appearing in payroll\n\n**Common causes and fixes:**\n\n1. **Employee status is Inactive** — HR → Employees → open the employee → set Status to Active\n2. **No basic salary set** — HR → Employees → open the employee → Compensation tab → set Basic Salary\n3. **Wrong employment date** — Employee was added after the payroll period start date; they appear from the next month\n4. **On unpaid leave** for the full period — Their gross pay will be zero; they will appear but show KES 0\n5. **Different department selected** — If you selected a specific department, check the employee's department setting`,
      },
      {
        title: 'How to generate statutory reports (NHIF, NSSF, PAYE)',
        slug: 'statutory-reports',
        tags: ['nhif', 'nssf', 'paye', 'kra', 'statutory', 'return'],
        content: `## Generating statutory reports\n\nAfter processing payroll for a month:\n\n**PAYE return (KRA iTax):**\nHR → Payroll → open the month's run → Download → PAYE Return (CSV format for iTax upload)\n\n**NHIF return:**\nHR → Payroll → Download → NHIF Schedule\n\n**NSSF return:**\nHR → Payroll → Download → NSSF Schedule\n\n**Submission deadlines:**\n- PAYE: 9th of the following month\n- NHIF: 9th of the following month\n- NSSF: 15th of the following month\n\nUpload the downloaded files directly to the KRA iTax / NHIF / NSSF portals.`,
      },
    ],
  },
  {
    category: { name: 'Messaging & Marketing', slug: 'messaging', icon: 'message', sortOrder: 5 },
    articles: [
      {
        title: 'Setting up SMS / WhatsApp',
        slug: 'setup-messaging',
        tags: ['sms', 'whatsapp', 'africa', 'setup'],
        content: `## Setting up messaging\n\n1. Create an account at Africa's Talking (africastalking.com)\n2. Get your **API Key** and **Username** from the AT dashboard\n3. Register a **Sender ID** (your business name, 11 chars max) — takes 1–3 business days\n4. In the ERP: **Settings → Messaging**\n5. Enter your API Key, Username, and Sender ID\n6. Enable SMS and/or WhatsApp\n7. Click Save\n8. Use the **Send Test SMS** button to verify the setup\n\n**Sandbox mode (for testing):** Use username \`sandbox\` and any API key to test without sending real messages or spending credits.`,
      },
      {
        title: 'How to create and send an SMS campaign',
        slug: 'sms-campaign',
        tags: ['sms', 'campaign', 'bulk', 'marketing'],
        content: `## Creating an SMS campaign\n\n1. Go to **Messaging → Campaigns → New Campaign**\n2. Enter a campaign name (internal reference)\n3. Write your SMS message (160 chars = 1 SMS credit)\n4. Select the **recipient group**:\n   - All customers\n   - Customers by segment (e.g. overdue balance, top spenders)\n   - Custom phone number list (paste or upload CSV)\n5. Set a **send time** (send now or schedule for later)\n6. Click **Review** to see the recipient count and estimated cost\n7. Click **Send**\n\n**Character count:** The editor shows how many SMS credits the message will use. Messages over 160 characters become multi-part SMS.`,
      },
      {
        title: 'How to set up automated invoice reminders',
        slug: 'invoice-reminders',
        tags: ['reminder', 'invoice', 'automated', 'overdue', 'payment'],
        content: `## Automated invoice reminders\n\nSet up automatic SMS/email reminders for overdue invoices:\n\n1. Go to **Settings → Messaging → Reminder Rules**\n2. Click **New Reminder Rule**\n3. Set the trigger: "X days after due date" (e.g. 1, 7, 14, 30 days overdue)\n4. Write the reminder message template (use {{customer_name}}, {{invoice_no}}, {{amount_due}}, {{due_date}} as variables)\n5. Choose SMS, Email, or both\n6. Save and enable the rule\n\n> Reminders only send for invoices with APPROVED or PARTIAL status (outstanding balance > 0).`,
      },
      {
        title: 'Error: Campaign failed to send',
        slug: 'campaign-send-error',
        tags: ['error', 'campaign', 'sms', 'send'],
        content: `## Campaign failed to send\n\n**Check these in order:**\n\n1. **API credentials** — Settings → Messaging → verify API key and username are correct (copy-paste from AT dashboard, no extra spaces)\n2. **Sender ID** — Must be registered and approved by Africa's Talking. Check status on the AT portal\n3. **Account balance** — Log into Africa's Talking → check SMS credit balance. Top up if depleted\n4. **Phone number format** — Numbers must start with 254 (no +, no leading 0): 254712345678\n5. **Individual message errors** — Open the campaign → click on a failed recipient to see the specific AT error code\n\n**Still failing?** Submit a support ticket with the campaign ID and the error message.`,
      },
    ],
  },
  {
    category: { name: 'Accounting & Finance', slug: 'accounting', icon: 'fund', sortOrder: 6 },
    articles: [
      {
        title: 'How the chart of accounts works',
        slug: 'chart-of-accounts',
        tags: ['accounting', 'chart of accounts', 'ledger', 'coa'],
        content: `## Chart of accounts\n\nThe chart of accounts is the master list of all accounts in your accounting system.\n\n**Account types:**\n| Type | Examples |\n|------|----------|\n| **Assets** | Cash, Bank, Accounts Receivable, Inventory |\n| **Liabilities** | Accounts Payable, VAT Payable, Loans |\n| **Equity** | Share Capital, Retained Earnings |\n| **Revenue** | Sales, Other Income |\n| **Expenses** | COGS, Salaries, Rent, Utilities |\n\n**To view:** Accounting → Chart of Accounts\n\n**To add an account:** Click New Account → enter name, type, and account code. Keep codes consistent (e.g. 1xxx = Assets, 2xxx = Liabilities, 4xxx = Revenue, 5xxx = Expenses).`,
      },
      {
        title: 'Understanding journal entries',
        slug: 'journal-entries',
        tags: ['journal', 'entries', 'debit', 'credit', 'accounting'],
        content: `## Journal entries\n\nJournal entries are the foundation of double-entry bookkeeping. Every financial event creates at least one debit and one credit of equal value.\n\n**Automatically posted journals (you don't need to do these):**\n- Invoice approved → Debit Accounts Receivable, Credit Sales\n- Invoice paid → Debit Bank/Cash, Credit Accounts Receivable\n- Purchase order received → Debit Inventory, Credit Accounts Payable\n- Payroll processed → Debit Salaries Expense, Credit Bank + Payable accounts\n\n**Manual journals:** Accounting → Journal Entries → New Entry. Use for:\n- Opening balances when first setting up\n- Depreciation\n- Accruals and prepayments\n- Corrections\n\n> Every journal entry must balance: total debits = total credits.`,
      },
      {
        title: 'How to generate financial statements',
        slug: 'financial-statements',
        tags: ['p&l', 'balance sheet', 'financial statements', 'reports', 'accounting'],
        content: `## Financial statements\n\n**Profit & Loss (Income Statement):**\nAccounting → Reports → Profit & Loss\n- Shows revenue, cost of goods sold, gross profit, operating expenses, and net profit\n- Filter by date range, department, or branch\n\n**Balance Sheet:**\nAccounting → Reports → Balance Sheet\n- Shows assets, liabilities, and equity at a point in time\n- As at the end of any date\n\n**Trial Balance:**\nAccounting → Reports → Trial Balance\n- Lists all account balances — useful for verification before closing a period\n\n**To export:** Click Download on any report to get a PDF or Excel file.\n\n> Financial statements only reflect APPROVED and POSTED transactions.`,
      },
      {
        title: 'How to record a bank payment or expense',
        slug: 'record-expense',
        tags: ['expense', 'payment', 'bank', 'journal', 'spend'],
        content: `## Recording expenses and bank payments\n\n**For expenses with a supplier invoice:**\n1. Procurement → Purchase Orders → create PO for the expense\n2. Approve and receive it\n3. Record the payment against the resulting payable\n\n**For direct expenses (no PO):**\n1. Accounting → Journal Entries → New Entry\n2. Debit the relevant expense account (e.g. Rent, Utilities, Transport)\n3. Credit the bank or cash account the payment came from\n4. Enter the date, description, and reference number\n5. Save and Post\n\n**For petty cash:**\nUse the Petty Cash account in your chart of accounts. Reimburse by transferring from Bank to Petty Cash.`,
      },
      {
        title: 'How to handle VAT returns',
        slug: 'vat-returns',
        tags: ['vat', 'kra', 'tax', 'return', 'itax'],
        content: `## VAT returns\n\n**Generating the VAT report:**\n1. Accounting → Reports → VAT Report\n2. Select the tax period (month)\n3. The report shows:\n   - Output VAT (collected from customers on sales)\n   - Input VAT (paid to suppliers on purchases)\n   - Net VAT payable = Output - Input\n\n**Downloading for iTax:**\nClick **Export → KRA Format** to get a CSV file formatted for direct upload to iTax.\n\n**When to file:** Monthly VAT returns are due by the **20th of the following month**.\n\n> Ensure all invoices for the period are APPROVED before generating the VAT report to get accurate figures.`,
      },
      {
        title: 'How to close a financial period',
        slug: 'period-close',
        tags: ['period close', 'month end', 'year end', 'accounting', 'close'],
        content: `## Closing a financial period\n\n**Month-end checklist:**\n- [ ] All invoices for the month are approved\n- [ ] All purchase orders for the month are received and posted\n- [ ] Bank reconciliation completed\n- [ ] Payroll for the month is processed\n- [ ] All expense journals are posted\n- [ ] VAT return downloaded and filed with KRA\n\n**To close the period:**\nAccounting → Periods → find the month → click **Close Period**\n\nClosing a period prevents any new transactions from being backdated into it. You can still run reports for closed periods.\n\n**Year-end:** At financial year end, run the year-end close process (Accounting → Year End) to roll forward retained earnings.`,
      },
    ],
  },
  {
    category: { name: 'Reports & Analytics', slug: 'reports', icon: 'bar-chart', sortOrder: 7 },
    articles: [
      {
        title: 'Overview of all available reports',
        slug: 'reports-overview',
        tags: ['reports', 'analytics', 'overview'],
        content: `## Reports available in the ERP\n\n**Sales Reports**\n- Sales Summary — daily/weekly/monthly revenue totals\n- Sales by Product — which products are selling most\n- Sales by Customer — top customers by revenue\n- Sales by Salesperson — performance per rep\n\n**Inventory Reports**\n- Stock Valuation — current inventory value at cost\n- Low Stock Report — products below reorder level\n- Wastage Report — losses by reason and product\n- Stock Movement History — full audit trail\n\n**Financial Reports**\n- Profit & Loss\n- Balance Sheet\n- Trial Balance\n- VAT Report\n- Accounts Receivable (Debtors) Ageing\n- Accounts Payable (Creditors) Ageing\n\n**HR Reports**\n- Payroll Summary\n- PAYE / NHIF / NSSF statutory returns\n- Leave Balance Report\n\nAll reports have **date range filters** and can be **exported to PDF or Excel**.`,
      },
      {
        title: 'How to use the accounts receivable ageing report',
        slug: 'ar-ageing',
        tags: ['accounts receivable', 'debtors', 'ageing', 'outstanding', 'credit'],
        content: `## Accounts Receivable Ageing Report\n\nThis report shows all customers with outstanding balances, grouped by how overdue they are.\n\n1. Go to **Reports → Accounts Receivable (Debtors)**\n2. Set the **As At** date (usually today)\n3. The report shows each customer's balance in columns:\n   - **Current** — not yet due\n   - **1–30 days** — slightly overdue\n   - **31–60 days** — moderately overdue\n   - **61–90 days** — seriously overdue\n   - **90+ days** — very overdue\n\n**Using the report:**\n- Call customers in the 61–90 and 90+ columns first\n- Use the **Send Reminder** button next to a customer to send an SMS or email reminder\n- Export to Excel for your credit control team`,
      },
      {
        title: 'How to export reports to Excel or PDF',
        slug: 'export-reports',
        tags: ['export', 'excel', 'pdf', 'download', 'report'],
        content: `## Exporting reports\n\nAll reports in the ERP support export.\n\n**To export:**\n1. Open any report (e.g. Reports → Sales Summary)\n2. Set your date range and filters\n3. Click the **Download** button (top right of the report)\n4. Choose **PDF** (for printing or sharing) or **Excel/CSV** (for further analysis)\n\n**Scheduled reports:** You can set a report to email automatically on a schedule:\nReports → Schedule → New Schedule → choose the report, frequency (daily/weekly/monthly), and recipients.`,
      },
      {
        title: 'How to use the dashboard',
        slug: 'dashboard',
        tags: ['dashboard', 'overview', 'kpi', 'summary'],
        content: `## Using the dashboard\n\nThe dashboard shows your key business metrics at a glance:\n\n**Top KPI tiles:**\n- Today's Revenue\n- Outstanding Invoices (total amount)\n- Low Stock Products (count)\n- Open Support Tickets\n\n**Charts:**\n- Revenue trend (last 30 days)\n- Sales by payment method (this month)\n- Top 5 products by revenue\n- Expenses breakdown\n\n**Customising the dashboard:**\nClick the **⚙ Customise** button to show/hide widgets and reorder them.\n\n**Data is live** — the dashboard updates as transactions are posted. Pull down to refresh.`,
      },
    ],
  },
  {
    category: { name: 'Errors & Troubleshooting', slug: 'errors', icon: 'warning', sortOrder: 8 },
    articles: [
      {
        title: 'White screen / page not loading',
        slug: 'white-screen',
        tags: ['error', 'white screen', 'loading', 'crash'],
        content: `## White screen fix\n\n**Try these steps in order:**\n\n1. **Hard refresh**: Ctrl + Shift + R (Windows) or Cmd + Shift + R (Mac)\n2. **Clear browser cache**: Browser Settings → Clear browsing data → Cached images and files → Clear\n3. **Try a different browser**: Chrome or Edge are recommended\n4. **Check internet connection**: Try opening another website\n5. **Disable browser extensions**: Some ad blockers interfere with the app — try in Incognito mode\n\n**If the problem persists:**\nPress **F12** to open DevTools → Console tab → copy any red error messages → submit a support ticket with those messages.`,
      },
      {
        title: 'Error: Session expired / logged out automatically',
        slug: 'session-expired',
        tags: ['error', 'session', 'login', 'logout'],
        content: `## Session expired\n\nSessions expire after **8 hours** of inactivity for security.\n\n**To fix:** Log in again. All your saved data is intact — sessions expiring never causes data loss.\n\n**To reduce frequency of session expiry:**\n- Keep the browser tab open and active\n- Avoid putting your computer to sleep mid-session\n- Check that your browser is not configured to clear cookies on close\n\n**If you are being logged out even while actively working:** This may indicate a network issue (VPN dropping, ISP timeout). Contact your IT team or submit a support ticket.`,
      },
      {
        title: 'Error: Access denied / permission error',
        slug: 'permission-error',
        tags: ['error', 'permission', 'access', 'denied', 'unauthorized'],
        content: `## Access denied\n\nYou are seeing this because your user role does not have permission for this action.\n\n**User roles and what they can access:**\n| Role | Access |\n|------|--------|\n| ADMIN | Full access to everything |\n| ACCOUNTANT | Finance, accounting, reports |\n| SALES_USER | Sales, POS, customers, quotes |\n| INVENTORY_MANAGER | Products, stock, warehouses, POs |\n| HR_MANAGER | Employees, payroll, leave |\n| PROCUREMENT_OFFICER | Purchase orders, suppliers |\n\n**To fix:** Ask an ADMIN to update your role in **Settings → Users → click your name → Edit → change Role → Save**.`,
      },
      {
        title: 'Error: Cannot delete record — it is referenced elsewhere',
        slug: 'delete-reference-error',
        tags: ['error', 'delete', 'referenced', 'foreign key'],
        content: `## Cannot delete — record in use\n\nThis error means the record you're trying to delete is linked to other records in the system.\n\n**Common examples:**\n- Cannot delete a **Customer** who has invoices\n- Cannot delete a **Product** that appears on approved invoices\n- Cannot delete a **Warehouse** that has stock\n- Cannot delete a **User** who created transactions\n\n**Solution:** Instead of deleting, **deactivate** the record (toggle the Active switch to OFF). This hides it from new transactions while preserving all historical data for audit purposes.\n\nIf you genuinely need a record deleted (e.g. a test record), contact support — ADMIN users can force-delete records with no linked transactions.`,
      },
      {
        title: 'Report shows wrong totals — data seems missing',
        slug: 'report-wrong-totals',
        tags: ['report', 'wrong', 'missing data', 'totals', 'discrepancy'],
        content: `## Report totals are incorrect\n\n**Most common reasons:**\n\n1. **Date range is off** — The From and To dates may not include all the transactions you expect. Check the date range filter.\n2. **Invoice status** — Only APPROVED and PAID invoices appear in revenue reports. DRAFT invoices are excluded.\n3. **Wrong filter selected** — Check if a branch, department, or product category filter is narrowing the results.\n4. **Transactions not yet approved** — Ask the team if any invoices from the period are still in DRAFT.\n5. **VAT included/excluded** — Some report views show net (excl. VAT) and some show gross (incl. VAT). Check the report header.\n\nIf the data still doesn't match after checking all of the above, submit a support ticket with the report name, date range, and the expected vs actual figures.`,
      },
      {
        title: 'Error: Cannot send email — email not configured',
        slug: 'email-not-configured',
        tags: ['email', 'error', 'smtp', 'configure', 'send'],
        content: `## Email not configured\n\nThis error appears when you try to send an invoice, reminder, or report by email but no email server is set up.\n\n**To set up email:**\n1. Go to **Settings → Email (SMTP)**\n2. Enter your SMTP server settings:\n   - **Gmail:** smtp.gmail.com, port 587, TLS\n   - **Outlook:** smtp.office365.com, port 587, TLS\n   - **SendGrid:** smtp.sendgrid.net, port 587\n3. Enter the email address and password (for Gmail, use an App Password — not your regular Gmail password)\n4. Click **Test Email** to verify\n5. Save\n\n**Using SendGrid (recommended for bulk sending):** Get a free SendGrid account, create an API key, and use that as the SMTP password.`,
      },
      {
        title: 'The system is running slowly',
        slug: 'system-slow',
        tags: ['slow', 'performance', 'lag', 'loading'],
        content: `## System running slowly\n\n**Browser-side fixes:**\n1. Close unused browser tabs — each tab uses RAM\n2. Clear cache: Ctrl + Shift + R\n3. Try Chrome or Edge (better performance than Firefox for this app)\n4. Disable heavy browser extensions\n\n**Network fixes:**\n1. Test your internet speed at speedtest.net — the system needs at least 5 Mbps\n2. Try connecting via cable instead of Wi-Fi\n3. If on a corporate network, check if a proxy or firewall is throttling the connection\n\n**If slowness is specific to one module** (e.g. reports take 30+ seconds), it may be a data-volume issue. Submit a support ticket and we will investigate query optimisation.`,
      },
    ],
  },
];

@Injectable()
export class HelpService {
  constructor(private prisma: PrismaService) {}

  async seedContent() {
    for (const { category, articles } of SEED_DATA) {
      const cat = await this.prisma.faqCategory.upsert({
        where: { slug: category.slug },
        create: category,
        update: { name: category.name, icon: category.icon, sortOrder: category.sortOrder },
      });
      for (const a of articles) {
        await this.prisma.faqArticle.upsert({
          where: { slug: a.slug },
          create: { ...a, categoryId: cat.id },
          update: { title: a.title, content: a.content, tags: a.tags },
        });
      }
    }
  }

  async listCategories() {
    return this.prisma.faqCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { articles: { where: { isPublished: true } } } } },
    });
  }

  async listArticles(categorySlug?: string, search?: string) {
    const where: any = { isPublished: true };
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.faqArticle.findMany({
      where,
      include: { category: { select: { name: true, slug: true, icon: true } } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  }

  async getArticle(slug: string) {
    const article = await this.prisma.faqArticle.findUnique({
      where: { slug },
      include: { category: { select: { name: true, slug: true } } },
    });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async markHelpful(slug: string, helpful: boolean) {
    return this.prisma.faqArticle.update({
      where: { slug },
      data: helpful ? { helpful: { increment: 1 } } : { notHelpful: { increment: 1 } },
    });
  }
}
