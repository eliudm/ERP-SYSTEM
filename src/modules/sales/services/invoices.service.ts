import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateInvoiceDto } from '../dto';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { InvoiceStatus, MovementType, PaymentMethod } from '@prisma/client';
import { EtimsQueueService } from '../../etims/etims-queue/etims-queue.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private postingEngine: PostingEngineService,
    private etimsQueue: EtimsQueueService,
    private notificationsService: NotificationsService,
  ) {}

  // ─── GENERATE INVOICE NUMBER ─────────────────────────────
  private async generateInvoiceNo(): Promise<string> {
    const count = await this.prisma.salesInvoice.count();
    const padded = String(count + 1).padStart(5, '0');
    return `INV-${padded}`;
  }

  // ─── CREATE INVOICE (DRAFT) ──────────────────────────────
  async create(dto: CreateInvoiceDto) {
    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Validate all products exist & calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    const itemsData: any[] = [];

    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        throw new NotFoundException(
          `Product with ID ${item.productId} not found`,
        );
      }

      const lineTotal = item.quantity * item.unitPrice;
      const lineTax = lineTotal * item.taxRate;

      subtotal += lineTotal;
      taxAmount += lineTax;

      itemsData.push({
        productId: item.productId,
        description: item.description || product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: lineTax,
        lineTotal: lineTotal + lineTax,
      });
    }

    const total = subtotal + taxAmount;
    const invoiceNo = await this.generateInvoiceNo();

    // Create invoice in database
    const invoice = await this.prisma.salesInvoice.create({
      data: {
        invoiceNo,
        customerId: dto.customerId,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: InvoiceStatus.DRAFT,
        subtotal,
        taxAmount,
        total,
        notes: dto.notes,
        paymentMethod: dto.paymentMethod ?? null,
        items: { create: itemsData },
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    return invoice;
  }

  // ─── APPROVE & POST INVOICE ──────────────────────────────
  async approve(
    id: string,
    warehouseId?: string,
    paymentMethod?: PaymentMethod,
  ) {
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
    const [arAccount, revenueAccount, vatAccount] = await Promise.all([
      this.prisma.account.findFirst({ where: { code: '1100' } }), // Accounts Receivable
      this.prisma.account.findFirst({ where: { code: '4000' } }), // Sales Revenue
      this.prisma.account.findFirst({ where: { code: '2100' } }), // VAT Payable
    ]);

    if (!arAccount || !revenueAccount || !vatAccount) {
      throw new BadRequestException(
        'Required accounts not found. Please seed chart of accounts first.',
      );
    }

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
      ],
    });

    const approvedInvoice = await this.prisma.$transaction(async (tx) => {
      for (const item of invoice.items) {
        await tx.stockMovement.create({
          data: {
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
        data: { status: InvoiceStatus.APPROVED },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });
    });

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
      return this.markAsPaid(id, paymentMethod);
    }

    return approvedInvoice;
  }

  // ─── MARK AS PAID ────────────────────────────────────────
  async markAsPaid(
    id: string,
    paymentMethod: PaymentMethod = PaymentMethod.CASH,
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
    return this.prisma.salesInvoice.update({
      where: { id },
      data: { status: InvoiceStatus.PAID, paymentMethod, paidAt: new Date() },
      include: { customer: true },
    });
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
  async void(id: string, reason: string) {
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
      await this.postingEngine.voidTransaction(journalEntry.id, reason);
    }

    return this.prisma.salesInvoice.update({
      where: { id },
      data: { status: InvoiceStatus.VOID },
    });
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
