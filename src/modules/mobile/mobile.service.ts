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
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.salesInvoice.aggregate({
        where: {
          invoiceDate: { gte: startOfMonth, lte: now },
          status: { in: ['APPROVED', 'PAID'] },
        },
        _sum: { total: true },
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
        amount: Number(salesToday._sum.total ?? 0),
        count: salesToday._count,
      },
      salesThisMonth: Number(salesThisMonth._sum.total ?? 0),
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
  async getRecentInvoices(limit = 20) {
    const invoices = await this.prisma.salesInvoice.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNo: true,
        invoiceDate: true,
        status: true,
        total: true,
        paymentMethod: true,
        customer: { select: { id: true, name: true } },
      },
    });

    return invoices.map((inv) => ({
      ...inv,
      total: Number(inv.total),
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
