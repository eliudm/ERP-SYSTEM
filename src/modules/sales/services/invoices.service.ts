import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateInvoiceDto } from '../dto';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import {
  ApprovalEntityType,
  InvoiceStatus,
  MovementType,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { EtimsQueueService } from '../../etims/etims-queue/etims-queue.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditService } from '../../audit/audit.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { extractTax, computeLineTax } from '../../../common/utils/tax.util';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private postingEngine: PostingEngineService,
    private etimsQueue: EtimsQueueService,
    private notificationsService: NotificationsService,
    private auditService: AuditService,
    private workflowService: WorkflowService,
  ) {}

  // ─── GENERATE INVOICE NUMBER ─────────────────────────────
  private async generateInvoiceNo(): Promise<string> {
    const count = await this.prisma.salesInvoice.count();
    const padded = String(count + 1).padStart(5, '0');
    return `INV-${padded}`;
  }

  // ─── COST OF GOODS SOLD ──────────────────────────────────
  // Uses the product's CURRENT costPrice at time of sale — this system has
  // no inventory costing layers (FIFO/lots), so a line with no costPrice set
  // simply contributes 0 (sale is never blocked for missing cost data).
  private calculateCogs(
    items: {
      quantity: number | Prisma.Decimal;
      product: {
        costPrice: Prisma.Decimal | null;
        taxRate: Prisma.Decimal;
        costPriceIncludesVat: boolean;
      };
    }[],
  ): number {
    return items.reduce((sum, item) => {
      if (item.product.costPrice == null) return sum;
      const { net } = computeLineTax(
        Number(item.quantity) * Number(item.product.costPrice),
        Number(item.product.taxRate),
        item.product.costPriceIncludesVat,
      );
      return sum + net;
    }, 0);
  }

  // ─── CREATE INVOICE (DRAFT) ──────────────────────────────
  async create(dto: CreateInvoiceDto, userId?: string) {
    // Idempotency: if this exact client attempt already succeeded (e.g. the
    // mobile offline-sales queue retrying after a dropped response), return
    // the invoice it already created instead of making a duplicate DRAFT.
    if (dto.clientRef) {
      const existing = await this.prisma.salesInvoice.findFirst({
        where: { clientRef: dto.clientRef },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });
      if (existing) return existing;
    }

    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Validate all products exist & calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    const itemsData: any[] = [];

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    for (const item of dto.items) {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new NotFoundException(
          `Product with ID ${item.productId} not found`,
        );
      }

      const gross = item.quantity * item.unitPrice;
      const { tax, net } = extractTax(gross, item.taxRate);

      subtotal += net;
      taxAmount += tax;

      itemsData.push({
        productId: item.productId,
        description: item.description || product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: tax,
        lineTotal: gross,
      });
    }

    const total = subtotal + taxAmount;
    const invoiceNo = await this.generateInvoiceNo();

    // Create invoice in database
    let invoice;
    try {
      invoice = await this.prisma.salesInvoice.create({
        data: {
          tenantId: customer.tenantId,
          invoiceNo,
          customerId: dto.customerId,
          branchId: dto.branchId ?? null,
          invoiceDate: new Date(dto.invoiceDate),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: InvoiceStatus.DRAFT,
          subtotal,
          taxAmount,
          total,
          notes: dto.notes,
          paymentMethod: dto.paymentMethod ?? null,
          clientRef: dto.clientRef ?? null,
          items: { create: itemsData },
        },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });
    } catch (err) {
      // Lost a race against another create() carrying the same clientRef
      // (e.g. two near-simultaneous sync retries) — the unique constraint
      // caught the duplicate the findFirst above couldn't see in time.
      // Self-heal by returning the row that won, instead of erroring.
      if (
        dto.clientRef &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        (err.meta?.target as string[] | undefined)?.includes('clientRef')
      ) {
        const existing = await this.prisma.salesInvoice.findFirst({
          where: { clientRef: dto.clientRef },
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        });
        if (existing) return existing;
      }
      throw err;
    }

    await this.auditService.log({
      userId,
      action: 'CREATE',
      tableName: 'sales_invoices',
      recordId: invoice.id,
      newValues: {
        invoiceNo: invoice.invoiceNo,
        customerId: invoice.customerId,
        total: invoice.total,
        status: invoice.status,
      },
    });

    return invoice;
  }

  // ─── APPROVE & POST INVOICE ──────────────────────────────
  async approve(
    id: string,
    warehouseId?: string,
    paymentMethod?: PaymentMethod,
    userId?: string,
  ) {
    await this.workflowService.assertApprovalIfExists(
      ApprovalEntityType.SALES_INVOICE,
      id,
    );

    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Invoice is already ${invoice.status}. Only DRAFT invoices can be approved.`,
      );
    }

    const warehouse = warehouseId
      ? await this.prisma.warehouse.findFirst({
          where: { id: warehouseId, isActive: true },
        })
      : await this.prisma.warehouse.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        });

    if (!warehouse) {
      throw new BadRequestException(
        'No active warehouse found. Please create or activate a warehouse before selling.',
      );
    }

    for (const item of invoice.items) {
      if (Number(item.product.stockQuantity) < Number(item.quantity)) {
        throw new BadRequestException(
          `Insufficient stock for ${item.product.name}. Available: ${item.product.stockQuantity}, Requested: ${item.quantity}`,
        );
      }
    }

    // Get required accounts
    const [
      arAccount,
      revenueAccount,
      vatAccount,
      cogsAccount,
      inventoryAccount,
    ] = await Promise.all([
      this.prisma.account.findFirst({ where: { code: '1100' } }), // Accounts Receivable
      this.prisma.account.findFirst({ where: { code: '4000' } }), // Sales Revenue
      this.prisma.account.findFirst({ where: { code: '2100' } }), // VAT Payable
      this.prisma.account.findFirst({ where: { code: '5000' } }), // Cost of Goods Sold
      this.prisma.account.findFirst({ where: { code: '1200' } }), // Inventory
    ]);

    if (
      !arAccount ||
      !revenueAccount ||
      !vatAccount ||
      !cogsAccount ||
      !inventoryAccount
    ) {
      throw new BadRequestException(
        'Required accounts not found. Please seed chart of accounts first.',
      );
    }

    const totalCogs = this.calculateCogs(invoice.items);

    // Post accounting journal entry automatically
    await this.postingEngine.postTransaction({
      reference: `SALE-${invoice.invoiceNo}`,
      description: `Sales Invoice ${invoice.invoiceNo} - ${invoice.customer.name}`,
      entryDate: invoice.invoiceDate.toISOString(),
      sourceType: 'SALES_INVOICE',
      sourceId: invoice.id,
      lines: [
        // Debit Accounts Receivable (full amount)
        {
          accountId: arAccount.id,
          debit: Number(invoice.total),
          credit: 0,
          description: `AR - ${invoice.invoiceNo}`,
        },
        // Credit Sales Revenue (subtotal)
        {
          accountId: revenueAccount.id,
          debit: 0,
          credit: Number(invoice.subtotal),
          description: `Revenue - ${invoice.invoiceNo}`,
        },
        // Credit VAT Payable (tax amount)
        {
          accountId: vatAccount.id,
          debit: 0,
          credit: Number(invoice.taxAmount),
          description: `VAT - ${invoice.invoiceNo}`,
        },
        // Cost of Goods Sold — only when at least one sold product has a
        // known costPrice; skipped entirely otherwise (no zero-amount lines)
        ...(totalCogs > 0
          ? [
              {
                accountId: cogsAccount.id,
                debit: totalCogs,
                credit: 0,
                description: `COGS - ${invoice.invoiceNo}`,
              },
              {
                accountId: inventoryAccount.id,
                debit: 0,
                credit: totalCogs,
                description: `Inventory reduction - ${invoice.invoiceNo}`,
              },
            ]
          : []),
      ],
    });

    const approvedInvoice = await this.prisma.$transaction(async (tx) => {
      for (const item of invoice.items) {
        await tx.stockMovement.create({
          data: {
            tenantId: invoice.tenantId,
            productId: item.productId,
            warehouseId: warehouse.id,
            movementType: MovementType.OUT,
            quantity: item.quantity,
            reference: invoice.invoiceNo,
            notes: `Sold via POS Invoice ${invoice.invoiceNo}`,
          },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      return tx.salesInvoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.APPROVED,
          branchId: warehouse.branchId ?? null,
        },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });
    });

    await this.auditService.log({
      userId,
      action: 'APPROVE',
      tableName: 'sales_invoices',
      recordId: id,
      oldValues: { status: invoice.status },
      newValues: {
        status: InvoiceStatus.APPROVED,
        warehouseId: warehouse.id,
        branchId: warehouse.branchId ?? null,
      },
    });

    await this.workflowService.consumeApprovedRequest(
      ApprovalEntityType.SALES_INVOICE,
      id,
    );

    // Automatically queue eTIMS submission
    await this.etimsQueue.addSubmitJob(id);

    // Check for low-stock / out-of-stock on each sold item (fire-and-forget)
    for (const item of invoice.items) {
      this.notificationsService
        .checkAndNotifyLowStock(item.productId)
        .catch(() => {});
    }

    // For instant-settlement methods, mark as paid immediately.
    // MOBILE_MONEY is settled asynchronously via M-Pesa callback.
    if (paymentMethod && paymentMethod !== PaymentMethod.MOBILE_MONEY) {
      return this.markAsPaid(id, paymentMethod, userId);
    }

    return approvedInvoice;
  }

  // ─── BACKFILL COGS (one-off, see scripts/backfill-cogs.ts) ──
  // Posts a catch-up COGS/Inventory journal entry for already-approved/paid
  // invoices that predate COGS posting being added to approve() above.
  // Idempotent: safe to re-run, skips invoices already backfilled.
  async backfillCogs(): Promise<{
    totalInvoices: number;
    posted: number;
    skippedAlreadyBackfilled: number;
    skippedNoCostData: number;
    totalCogsPosted: number;
  }> {
    const [cogsAccount, inventoryAccount] = await Promise.all([
      this.prisma.account.findFirst({ where: { code: '5000' } }),
      this.prisma.account.findFirst({ where: { code: '1200' } }),
    ]);
    if (!cogsAccount || !inventoryAccount) {
      throw new BadRequestException(
        'Required accounts not found. Please seed chart of accounts first.',
      );
    }

    const invoices = await this.prisma.salesInvoice.findMany({
      where: { status: { in: [InvoiceStatus.APPROVED, InvoiceStatus.PAID] } },
      include: { items: { include: { product: true } } },
    });

    const summary = {
      totalInvoices: invoices.length,
      posted: 0,
      skippedAlreadyBackfilled: 0,
      skippedNoCostData: 0,
      totalCogsPosted: 0,
    };

    for (const invoice of invoices) {
      const reference = `COGS-${invoice.invoiceNo}`;
      const already = await this.prisma.journalEntry.findFirst({
        where: { reference },
      });
      if (already) {
        summary.skippedAlreadyBackfilled += 1;
        continue;
      }

      const totalCogs = this.calculateCogs(invoice.items);
      if (totalCogs <= 0) {
        summary.skippedNoCostData += 1;
        continue;
      }

      await this.postingEngine.postTransaction({
        reference,
        description: `COGS backfill - Sales Invoice ${invoice.invoiceNo}`,
        entryDate: invoice.invoiceDate.toISOString(),
        sourceType: 'SALES_INVOICE',
        sourceId: invoice.id,
        lines: [
          {
            accountId: cogsAccount.id,
            debit: totalCogs,
            credit: 0,
            description: `COGS (backfill) - ${invoice.invoiceNo}`,
          },
          {
            accountId: inventoryAccount.id,
            debit: 0,
            credit: totalCogs,
            description: `Inventory reduction (backfill) - ${invoice.invoiceNo}`,
          },
        ],
      });

      summary.posted += 1;
      summary.totalCogsPosted += totalCogs;
    }

    return summary;
  }

  // ─── MARK AS PAID ────────────────────────────────────────
  async markAsPaid(
    id: string,
    paymentMethod: PaymentMethod = PaymentMethod.CASH,
    userId?: string,
  ) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status !== InvoiceStatus.APPROVED) {
      throw new BadRequestException(
        'Only APPROVED invoices can be marked as paid',
      );
    }

    // Map payment method to debit account code
    const paymentAccountCode = this.getPaymentAccountCode(paymentMethod);

    // Get accounts
    const [paymentAccount, arAccount] = await Promise.all([
      this.prisma.account.findFirst({ where: { code: paymentAccountCode } }),
      this.prisma.account.findFirst({ where: { code: '1100' } }), // AR
    ]);

    if (!paymentAccount || !arAccount) {
      throw new BadRequestException('Required accounts not found');
    }

    // Post payment journal entry
    await this.postingEngine.postTransaction({
      reference: `PMT-${invoice.invoiceNo}`,
      description: `Payment received - ${invoice.invoiceNo} - ${invoice.customer.name}`,
      entryDate: new Date().toISOString(),
      sourceType: 'PAYMENT',
      sourceId: invoice.id,
      lines: [
        // Debit payment account (Cash / Bank / Mobile Money etc.)
        {
          accountId: paymentAccount.id,
          debit: Number(invoice.total),
          credit: 0,
          description: `Payment (${paymentMethod}) - ${invoice.invoiceNo}`,
        },
        // Credit Accounts Receivable
        {
          accountId: arAccount.id,
          debit: 0,
          credit: Number(invoice.total),
          description: `Clear AR - ${invoice.invoiceNo}`,
        },
      ],
    });

    // Update status to PAID
    const paid = await this.prisma.salesInvoice.update({
      where: { id },
      data: { status: InvoiceStatus.PAID, paymentMethod, paidAt: new Date() },
      include: { customer: true },
    });

    await this.auditService.log({
      userId,
      action: 'MARK_PAID',
      tableName: 'sales_invoices',
      recordId: id,
      oldValues: { status: invoice.status },
      newValues: {
        status: InvoiceStatus.PAID,
        paymentMethod,
      },
    });

    return paid;
  }

  // ─── MAP PAYMENT METHOD TO ACCOUNT CODE ──────────────────
  private getPaymentAccountCode(method: PaymentMethod): string {
    switch (method) {
      case PaymentMethod.CASH:
        return '1000'; // Cash
      case PaymentMethod.CARD:
        return '1000'; // Cash (use same until card account added)
      case PaymentMethod.MOBILE_MONEY:
        return '1000'; // Cash
      case PaymentMethod.BANK_TRANSFER:
        return '1000'; // Cash
      case PaymentMethod.CREDIT:
        return '1100'; // Leave on AR
      default:
        return '1000';
    }
  }

  // ─── VOID INVOICE ────────────────────────────────────────
  async void(id: string, reason: string, userId?: string) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Invoice is already voided');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot void a paid invoice');
    }

    // Find and void the related journal entry
    const journalEntry = await this.prisma.journalEntry.findFirst({
      where: { sourceType: 'SALES_INVOICE', sourceId: id },
    });

    if (journalEntry) {
      await this.postingEngine.voidTransaction(journalEntry.id, reason, userId);
    }

    const voided = await this.prisma.salesInvoice.update({
      where: { id },
      data: { status: InvoiceStatus.VOID },
    });

    await this.auditService.log({
      userId,
      action: 'VOID',
      tableName: 'sales_invoices',
      recordId: id,
      oldValues: { status: invoice.status },
      newValues: { status: InvoiceStatus.VOID, reason },
    });

    return voided;
  }

  // ─── GET ALL INVOICES ────────────────────────────────────
  async findAll(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        skip,
        take: limit,
        where: status ? { status: status as any } : {},
        include: {
          customer: true,
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.salesInvoice.count({
        where: status ? { status: status as any } : {},
      }),
    ]);

    return {
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── GET ONE INVOICE ─────────────────────────────────────
  async findOne(id: string) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        etimsInvoice: true,
        creditNotes: true,
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // ─── GET SALES SUMMARY ───────────────────────────────────
  async getSalesSummary(startDate: string, endDate: string) {
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        status: { not: InvoiceStatus.VOID },
        invoiceDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    const totalRevenue = invoices.reduce(
      (sum, inv) => sum + Number(inv.subtotal),
      0,
    );
    const totalTax = invoices.reduce(
      (sum, inv) => sum + Number(inv.taxAmount),
      0,
    );
    const totalBilled = invoices.reduce(
      (sum, inv) => sum + Number(inv.total),
      0,
    );
    const totalPaid = invoices
      .filter((inv) => inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    return {
      period: { startDate, endDate },
      totalInvoices: invoices.length,
      totalRevenue,
      totalTax,
      totalBilled,
      totalPaid,
      outstanding: totalBilled - totalPaid,
    };
  }

  // ─── MONTHLY SALES BREAKDOWN ─────────────────────────────
  async getMonthlySales(year: number) {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31T23:59:59`);

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        status: { not: InvoiceStatus.VOID },
        invoiceDate: { gte: startDate, lte: endDate },
      },
      select: { invoiceDate: true, total: true, status: true },
    });

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const result = months.map((month, idx) => {
      const monthInvoices = invoices.filter((inv) => {
        const d = new Date(inv.invoiceDate);
        return d.getMonth() === idx;
      });
      const revenue = monthInvoices.reduce(
        (sum, inv) => sum + Number(inv.total),
        0,
      );
      const paid = monthInvoices
        .filter((inv) => inv.status === InvoiceStatus.PAID)
        .reduce((sum, inv) => sum + Number(inv.total), 0);
      return { month, revenue, paid, invoices: monthInvoices.length };
    });

    return { year, months: result };
  }

  // ─── DAILY SUMMARY BY PAYMENT METHOD ─────────────────────
  async getDailySummary(date: string) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        status: { not: InvoiceStatus.VOID },
        invoiceDate: { gte: start, lte: end },
      },
      select: {
        total: true,
        paymentMethod: true,
        status: true,
        invoiceNo: true,
      },
    });

    const totalOrders = invoices.length;
    const totalRevenue = invoices.reduce(
      (sum, inv) => sum + Number(inv.total),
      0,
    );

    // Group by payment method
    const methods = Object.values(PaymentMethod);
    const byPaymentMethod = methods
      .map((method) => {
        const rows = invoices.filter((inv) => inv.paymentMethod === method);
        const amount = rows.reduce((sum, inv) => sum + Number(inv.total), 0);
        return { method, amount, orders: rows.length };
      })
      .filter((entry) => entry.orders > 0);

    return { date, totalOrders, totalRevenue, byPaymentMethod };
  }
}
