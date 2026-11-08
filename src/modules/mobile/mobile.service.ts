import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class MobileService {
  constructor(private prisma: PrismaService) {}

  // ─── POS DATA: products + categories for POS screen ──────
  async getPosData(_branchId?: string) {
    const [products, categories, paymentMethods] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          barcode: true,
          name: true,
          unitPrice: true,
          taxRate: true,
          stockQuantity: true,
          categoryId: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.productCategory.findMany({
        select: { id: true, name: true, color: true, icon: true },
        orderBy: { name: 'asc' },
      }),
      // Return available payment methods as a static list
      Promise.resolve([
        'CASH',
        'CARD',
        'MOBILE_MONEY',
        'BANK_TRANSFER',
        'CREDIT',
      ]),
    ]);

    return {
      products: products.map((p) => ({
        ...p,
        unitPrice: Number(p.unitPrice),
        taxRate: Number(p.taxRate),
        stockQuantity: Number(p.stockQuantity),
      })),
      categories,
      paymentMethods,
    };
  }

  // ─── COMPACT DASHBOARD for mobile ────────────────────────
  async getMobileDashboard() {
    const now = new Date();
    // Anchor to Nairobi calendar day (UTC+3) to match getSalesSummary and P&L.
    const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
    const todayStr = new Date(now.getTime() + NAIROBI_OFFSET_MS)
      .toISOString()
      .slice(0, 10);
    const startOfToday = new Date(
      new Date(`${todayStr}T00:00:00.000Z`).getTime() - NAIROBI_OFFSET_MS,
    );
    const monthStr = `${todayStr.slice(0, 7)}-01`;
    const startOfMonth = new Date(
      new Date(`${monthStr}T00:00:00.000Z`).getTime() - NAIROBI_OFFSET_MS,
    );

    const [
      salesToday,
      salesThisMonth,
      pendingInvoices,
      pendingApprovals,
      lowStockCount,
      unreadNotifications,
    ] = await Promise.all([
      this.prisma.salesInvoice.aggregate({
        where: {
          invoiceDate: { gte: startOfToday, lte: now },
          status: { in: ['APPROVED', 'PAID'] },
        },
        _sum: { subtotal: true },
        _count: true,
      }),
      this.prisma.salesInvoice.aggregate({
        where: {
          invoiceDate: { gte: startOfMonth, lte: now },
          status: { in: ['APPROVED', 'PAID'] },
        },
        _sum: { subtotal: true },
      }),
      this.prisma.salesInvoice.count({
        where: { status: { in: ['DRAFT', 'APPROVED', 'SENT'] } },
      }),
      this.prisma.approvalRequest.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.product
        .count({
          where: {
            isActive: true,
            stockQuantity: {
              lte: this.prisma.product.fields.reorderLevel as any,
            },
          },
        })
        .catch(() => 0), // fallback if raw comparison fails
      this.prisma.notification.count({
        where: { isRead: false },
      }),
    ]);

    return {
      salesToday: {
        amount: Number(salesToday._sum.subtotal ?? 0),
        count: salesToday._count,
      },
      salesThisMonth: Number(salesThisMonth._sum.subtotal ?? 0),
      pendingInvoices,
      pendingApprovals,
      lowStockCount,
      unreadNotifications,
      serverTime: now.toISOString(),
    };
  }

  // ─── QUICK PRODUCT LOOKUP (barcode / code / name) ────────
  async quickSearch(query: string) {
    if (!query || query.length < 2) return [];

    return this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { barcode: { equals: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        code: true,
        barcode: true,
        name: true,
        unitPrice: true,
        taxRate: true,
        stockQuantity: true,
        categoryId: true,
      },
      take: 20,
      orderBy: { name: 'asc' },
    });
  }

  // ─── RECENT INVOICES (for mobile sales view) ─────────────
  async getRecentInvoices(limit = 50, dateFrom?: string, dateTo?: string) {
    const where: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      where.invoiceDate = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const invoices = await this.prisma.salesInvoice.findMany({
      take: limit,
      where,
      orderBy: { invoiceDate: 'desc' },
      select: {
        id: true,
        invoiceNo: true,
        invoiceDate: true,
        status: true,
        total: true,
        paymentMethod: true,
        customer: { select: { id: true, name: true } },
        etimsInvoice: { select: { status: true } },
      },
    });

    return invoices.map(({ etimsInvoice, ...inv }) => ({
      ...inv,
      total: Number(inv.total),
      etimsStatus: etimsInvoice?.status ?? null,
    }));
  }

  // ─── SYNC CHECK: return counts for offline-capable apps ──
  async getSyncStatus() {
    const [productCount, customerCount, lastInvoice] = await Promise.all([
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.customer.count({ where: { isActive: true } }),
      this.prisma.salesInvoice.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      productCount,
      customerCount,
      lastInvoiceAt: lastInvoice?.createdAt ?? null,
      serverTime: new Date().toISOString(),
    };
  }
}
