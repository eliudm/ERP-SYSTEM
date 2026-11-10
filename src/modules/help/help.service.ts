import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

const SEED_DATA = [
  {
    category: { name: 'Getting Started', slug: 'getting-started', icon: 'rocket', sortOrder: 1 },
    articles: [
      { title: 'How to set up your company', slug: 'setup-company', tags: ['setup', 'company', 'onboarding'], content: `## Setting up your company\n\n1. Go to **Settings → Company**\n2. Fill in your company name, address, logo, and KRA PIN\n3. Set your default currency (KES)\n4. Save changes\n\n> Your company name appears on all invoices and reports.` },
      { title: 'Adding your first product', slug: 'add-product', tags: ['products', 'inventory', 'setup'], content: `## Adding products\n\n1. Go to **Inventory → Products**\n2. Click **New Product**\n3. Enter the product name, SKU code, unit price, and cost price\n4. Set the reorder level to get low-stock alerts\n5. Assign a category for easy filtering\n\n**Tip:** Import multiple products at once using the CSV import button.` },
      { title: 'Creating your first invoice', slug: 'create-invoice', tags: ['invoice', 'sales', 'setup'], content: `## Creating an invoice\n\n1. Go to **Sales → Invoices**\n2. Click **New Invoice**\n3. Select or search for a customer\n4. Add line items — type a product name to search\n5. Review the total and click **Save**\n6. Click **Approve** to finalise and post to accounting\n\n> Only APPROVED invoices affect your financial reports.` },
    ],
  },
  {
    category: { name: 'Sales & Invoicing', slug: 'sales', icon: 'dollar', sortOrder: 2 },
    articles: [
      { title: 'Invoice status explained', slug: 'invoice-statuses', tags: ['invoice', 'status', 'paid', 'draft'], content: `## Invoice statuses\n\n| Status | Meaning |\n|--------|--------|\n| **DRAFT** | Not yet finalised. Can be edited freely. Does not affect stock or accounting. |\n| **APPROVED** | Finalised. Stock deducted. Journal entry posted. Cannot be edited. |\n| **PAID** | Fully paid. |\n| **VOID** | Cancelled. Reversed in accounting. |\n\n**Common issue:** Invoice stuck in DRAFT?\nMake sure all required fields are filled and click **Approve**, not just Save.` },
      { title: 'How to record a payment on a credit invoice', slug: 'credit-payment', tags: ['credit', 'payment', 'outstanding'], content: `## Recording credit payments\n\n1. Open the approved invoice\n2. Click **Record Payment**\n3. Enter the amount received, payment method, and date\n4. Click **Save**\n\nThe invoice status changes to PAID when the full balance is settled.\n\n**Note:** Partial payments keep the status as APPROVED until the full amount is paid.` },
      { title: 'Error: Cannot approve invoice — insufficient stock', slug: 'insufficient-stock', tags: ['error', 'stock', 'approve', 'inventory'], content: `## Error: Insufficient stock\n\nThis error appears when you try to approve an invoice but one or more products don't have enough stock.\n\n**How to fix:**\n1. Go to **Inventory → Stock Movements**\n2. Click **Stock In** to add the missing stock\n3. Return to the invoice and approve it\n\n**Or:** If the sale is correct and stock will be received later, ask an ADMIN to override the stock check in Settings → Inventory.` },
    ],
  },
  {
    category: { name: 'Inventory', slug: 'inventory', icon: 'box', sortOrder: 3 },
    articles: [
      { title: 'Understanding stock movements', slug: 'stock-movements', tags: ['stock', 'inventory', 'movements'], content: `## Stock movements\n\nEvery change to stock is recorded as a movement:\n\n- **IN** — goods received (purchase order, manual stock-in)\n- **OUT** — goods sold (approved invoice) or manual write-off\n- **TRANSFER** — moving stock between warehouses\n- **ADJUSTMENT** — correcting a counting error\n\nTo view the full history of a product, open it and click the **Stock History** tab.` },
      { title: 'Error: Product not showing in POS', slug: 'product-not-in-pos', tags: ['error', 'pos', 'product', 'missing'], content: `## Product not showing in POS\n\n**Check these things:**\n1. Product is marked **Active** (Inventory → Products → open the product → Active toggle)\n2. Product has a price greater than 0\n3. Product is in a warehouse linked to your branch\n4. Your branch has a POS session opened today\n\nIf the product is active but still missing, try refreshing the POS page (F5).` },
    ],
  },
  {
    category: { name: 'HR & Payroll', slug: 'hr', icon: 'team', sortOrder: 4 },
    articles: [
      { title: 'Running payroll', slug: 'run-payroll', tags: ['payroll', 'hr', 'salary'], content: `## Running payroll\n\n1. Go to **HR → Payroll**\n2. Click **New Payroll Run**\n3. Select the month and department (or All)\n4. Review the computed gross pay, deductions, and net pay\n5. Click **Process** to finalise\n\n> Payroll posts a journal entry to your accounting module automatically.` },
      { title: 'Error: Employee missing from payroll run', slug: 'employee-missing-payroll', tags: ['error', 'payroll', 'employee', 'missing'], content: `## Employee not appearing in payroll\n\n**Common causes:**\n1. Employee status is **Inactive** — reactivate in HR → Employees\n2. Employee has no salary set — open the employee and set Basic Salary\n3. Employee was added after the payroll period start date\n4. Employee is on **unpaid leave** for the entire period\n\nCheck the employee record for any of the above.` },
    ],
  },
  {
    category: { name: 'Messaging & Marketing', slug: 'messaging', icon: 'message', sortOrder: 5 },
    articles: [
      { title: 'Setting up SMS / WhatsApp', slug: 'setup-messaging', tags: ['sms', 'whatsapp', 'africa', 'setup'], content: `## Setting up messaging\n\n1. Create an account at [Africa's Talking](https://africastalking.com)\n2. Get your **API Key** and **Username** from the AT dashboard\n3. In the ERP, go to **Settings → Messaging**\n4. Enter your API Key, Username, and Sender ID\n5. Enable SMS and/or WhatsApp\n6. Click Save\n\n**Sandbox mode:** Use username \`sandbox\` and any API key to test without sending real messages.` },
      { title: 'Error: Campaign failed to send', slug: 'campaign-send-error', tags: ['error', 'campaign', 'sms', 'send'], content: `## Campaign failed to send\n\n**Check these:**\n1. **API credentials** — Go to Settings → Messaging and verify your API key and username are correct\n2. **Sender ID** — Must be registered and approved by Africa's Talking\n3. **Account balance** — Log into Africa's Talking and check your SMS credit balance\n4. **Phone numbers** — Numbers must be in international format: +254XXXXXXXXX\n\n**Still failing?** Open the campaign and check the individual message statuses for the specific error.` },
    ],
  },
  {
    category: { name: 'Errors & Troubleshooting', slug: 'errors', icon: 'warning', sortOrder: 6 },
    articles: [
      { title: 'White screen / page not loading', slug: 'white-screen', tags: ['error', 'white screen', 'loading', 'crash'], content: `## White screen fix\n\n1. **Hard refresh** the browser: press **Ctrl + Shift + R** (Windows) or **Cmd + Shift + R** (Mac)\n2. **Clear browser cache**: Settings → Clear browsing data → Cached images and files\n3. **Try a different browser** (Chrome recommended)\n4. **Check your internet connection**\n\nIf the white screen persists after all of the above, submit a support ticket with the error message you see in the browser console (press F12 → Console tab).` },
      { title: 'Error: Session expired / logged out automatically', slug: 'session-expired', tags: ['error', 'session', 'login', 'logout'], content: `## Session expired\n\nSessions expire after **8 hours** of inactivity for security.\n\n**To fix:** Simply log in again. Your data is saved.\n\n**To prevent frequent logouts:**\n- Keep the tab active\n- Avoid closing your laptop without logging out first\n- Admins can extend session timeout in Settings → Security (coming soon)` },
      { title: 'Error: Access denied / permission error', slug: 'permission-error', tags: ['error', 'permission', 'access', 'denied', 'unauthorized'], content: `## Access denied\n\nYou are seeing this because your user role does not have permission for this action.\n\n**User roles and permissions:**\n| Role | Access |\n|------|--------|\n| ADMIN | Full access |\n| ACCOUNTANT | Finance, reports |\n| SALES_USER | Sales, POS, customers |\n| INVENTORY_MANAGER | Products, stock, warehouses |\n| HR_MANAGER | HR, payroll, leave |\n| PROCUREMENT_OFFICER | Purchase orders, suppliers |\n\n**To fix:** Ask an ADMIN to change your role in Settings → Users.` },
      { title: 'Error: Cannot delete record — it is referenced elsewhere', slug: 'delete-reference-error', tags: ['error', 'delete', 'referenced', 'foreign key'], content: `## Cannot delete — record in use\n\nThis error means the record you're trying to delete is linked to other data.\n\n**Examples:**\n- Cannot delete a **Customer** who has invoices\n- Cannot delete a **Product** that appears on approved invoices\n- Cannot delete a **Warehouse** that has stock\n\n**Solution:** Instead of deleting, **deactivate** the record (toggle the Active switch). This hides it from new transactions while keeping historical data intact.` },
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
