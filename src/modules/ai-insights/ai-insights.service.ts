import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AiInsightsService {
  constructor(private prisma: PrismaService) {}

  // ─── GENERATE ALL INSIGHTS ───────────────────────────────
  async getInsights() {
    const [stockInsights, salesInsights, paymentInsights, customerInsights] =
      await Promise.all([
        this.getStockInsights(),
        this.getSalesInsights(),
        this.getPaymentInsights(),
        this.getCustomerInsights(),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      insights: [
        ...stockInsights,
        ...salesInsights,
        ...paymentInsights,
        ...customerInsights,
      ],
    };
  }

  // ─── STOCK PREDICTIONS ───────────────────────────────────
  // "You will run out of stock in X days"
  private async getStockInsights() {
    const insights: Insight[] = [];

    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        stockMovements: {
          where: { movementType: 'OUT' },
          orderBy: { createdAt: 'desc' },
          take: 90, // last ~90 movements
        },
      },
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const product of products) {
      const recentOuts = product.stockMovements.filter(
        (m) => m.createdAt >= thirtyDaysAgo,
      );

      if (recentOuts.length === 0) continue;

      const totalOutQty = recentOuts.reduce(
        (sum, m) => sum + Number(m.quantity),
        0,
      );
      const daysCovered = Math.max(
        1,
        Math.ceil(
          (now.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );
      const dailyUsage = totalOutQty / daysCovered;
      const currentStock = Number(product.stockQuantity);

      if (dailyUsage > 0 && currentStock > 0) {
        const daysUntilEmpty = Math.floor(currentStock / dailyUsage);

        if (daysUntilEmpty <= 7) {
          insights.push({
            type: 'STOCK_ALERT',
            severity: daysUntilEmpty <= 2 ? 'critical' : 'warning',
            title: `${product.name} will run out in ${daysUntilEmpty} day${daysUntilEmpty === 1 ? '' : 's'}`,
            message: `Based on the last 30 days, ${product.name} (${product.code}) sells ~${dailyUsage.toFixed(1)} units/day. Current stock: ${currentStock}. Consider reordering now.`,
            entity: { type: 'PRODUCT', id: product.id, code: product.code },
            metric: { dailyUsage, currentStock, daysUntilEmpty },
          });
        }
      }

      // Zero stock warning
      if (currentStock <= 0) {
        insights.push({
          type: 'STOCK_ALERT',
          severity: 'critical',
          title: `${product.name} is out of stock`,
          message: `${product.name} (${product.code}) has zero stock. Previous daily usage: ~${dailyUsage.toFixed(1)} units/day.`,
          entity: { type: 'PRODUCT', id: product.id, code: product.code },
          metric: { dailyUsage, currentStock: 0, daysUntilEmpty: 0 },
        });
      }
    }

    return insights;
  }

  // ─── SALES INSIGHTS ──────────────────────────────────────
  // Trend detection: compare this month vs last month
  private async getSalesInsights() {
    const insights: Insight[] = [];
    const now = new Date();

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    const [thisMonthSales, lastMonthSales] = await Promise.all([
      this.prisma.salesInvoice.aggregate({
        where: {
          status: { in: ['APPROVED', 'PAID'] },
          invoiceDate: { gte: thisMonthStart, lte: now },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.salesInvoice.aggregate({
        where: {
          status: { in: ['APPROVED', 'PAID'] },
          invoiceDate: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    const thisTotal = Number(thisMonthSales._sum.total ?? 0);
    const lastTotal = Number(lastMonthSales._sum.total ?? 0);

    if (lastTotal > 0) {
      const changePercent = ((thisTotal - lastTotal) / lastTotal) * 100;

      if (Math.abs(changePercent) >= 10) {
        const direction = changePercent > 0 ? 'up' : 'down';
        insights.push({
          type: 'SALES_TREND',
          severity: changePercent > 0 ? 'info' : 'warning',
          title: `Sales are ${direction} ${Math.abs(changePercent).toFixed(0)}% this month`,
          message: `This month: KES ${thisTotal.toLocaleString()} (${thisMonthSales._count} invoices) vs last month: KES ${lastTotal.toLocaleString()} (${lastMonthSales._count} invoices).`,
          metric: { thisMonth: thisTotal, lastMonth: lastTotal, changePercent },
        });
      }
    }

    // Top 5 products this month
    const items = await this.prisma.salesInvoiceItem.findMany({
      where: {
        invoice: {
          status: { in: ['APPROVED', 'PAID'] },
          invoiceDate: { gte: thisMonthStart, lte: now },
        },
      },
      include: { product: { select: { id: true, code: true, name: true } } },
    });

    const productRevenue = new Map<string, { name: string; revenue: number }>();
    for (const item of items) {
      const existing = productRevenue.get(item.productId) || {
        name: item.product.name,
        revenue: 0,
      };
      existing.revenue += Number(item.lineTotal);
      productRevenue.set(item.productId, existing);
    }

    const topProducts = Array.from(productRevenue.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);

    if (topProducts.length > 0) {
      insights.push({
        type: 'TOP_PRODUCTS',
        severity: 'info',
        title: `Top selling product: ${topProducts[0][1].name}`,
        message: `Top 5 this month: ${topProducts.map(([, v]) => `${v.name} (KES ${v.revenue.toLocaleString()})`).join(', ')}.`,
        metric: { topProducts: topProducts.map(([id, v]) => ({ id, ...v })) },
      });
    }

    return insights;
  }

  // ─── PAYMENT INSIGHTS ────────────────────────────────────
  private async getPaymentInsights() {
    const insights: Insight[] = [];
    const now = new Date();

    // Overdue invoices summary
    const overdueInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        status: { in: ['APPROVED', 'SENT'] },
        dueDate: { not: null, lt: now },
      },
      select: { total: true, dueDate: true },
    });

    if (overdueInvoices.length > 0) {
      const totalOverdue = overdueInvoices.reduce(
        (sum, inv) => sum + Number(inv.total),
        0,
      );
      const avgDaysOverdue =
        overdueInvoices.reduce((sum, inv) => {
          const days = Math.floor(
            (now.getTime() - (inv.dueDate as Date).getTime()) / 86400000,
          );
          return sum + days;
        }, 0) / overdueInvoices.length;

      insights.push({
        type: 'PAYMENT_RISK',
        severity: totalOverdue > 100000 ? 'critical' : 'warning',
        title: `${overdueInvoices.length} overdue invoices (KES ${totalOverdue.toLocaleString()})`,
        message: `There are ${overdueInvoices.length} unpaid invoices past their due date. Average ${avgDaysOverdue.toFixed(0)} days overdue. Total outstanding: KES ${totalOverdue.toLocaleString()}.`,
        metric: {
          count: overdueInvoices.length,
          totalAmount: totalOverdue,
          avgDaysOverdue,
        },
      });
    }

    return insights;
  }

  // ─── CUSTOMER INSIGHTS ───────────────────────────────────
  // "Top customers this month"
  private async getCustomerInsights() {
    const insights: Insight[] = [];
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        status: { in: ['APPROVED', 'PAID'] },
        invoiceDate: { gte: thisMonthStart, lte: now },
      },
      include: { customer: { select: { id: true, name: true } } },
    });

    const customerRevenue = new Map<
      string,
      { name: string; revenue: number; count: number }
    >();
    for (const inv of invoices) {
      const existing = customerRevenue.get(inv.customerId) || {
        name: inv.customer.name,
        revenue: 0,
        count: 0,
      };
      existing.revenue += Number(inv.total);
      existing.count += 1;
      customerRevenue.set(inv.customerId, existing);
    }

    const topCustomers = Array.from(customerRevenue.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);

    if (topCustomers.length > 0) {
      insights.push({
        type: 'TOP_CUSTOMERS',
        severity: 'info',
        title: `Top customer: ${topCustomers[0][1].name}`,
        message: `Top 5 customers this month: ${topCustomers.map(([, v]) => `${v.name} (KES ${v.revenue.toLocaleString()}, ${v.count} orders)`).join(', ')}.`,
        metric: { topCustomers: topCustomers.map(([id, v]) => ({ id, ...v })) },
      });
    }

    // Inactive high-value customers (bought last month, not this month)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    const lastMonthInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        status: { in: ['APPROVED', 'PAID'] },
        invoiceDate: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      select: { customerId: true, total: true },
    });

    const lastMonthCustomers = new Map<string, number>();
    for (const inv of lastMonthInvoices) {
      lastMonthCustomers.set(
        inv.customerId,
        (lastMonthCustomers.get(inv.customerId) || 0) + Number(inv.total),
      );
    }

    const thisMonthCustomerIds = new Set(customerRevenue.keys());
    const dormant = Array.from(lastMonthCustomers.entries())
      .filter(([id, amount]) => !thisMonthCustomerIds.has(id) && amount > 50000)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (dormant.length > 0) {
      insights.push({
        type: 'DORMANT_CUSTOMERS',
        severity: 'warning',
        title: `${dormant.length} high-value customers haven't ordered this month`,
        message: `These customers spent KES 50K+ last month but have no orders this month. Consider reaching out.`,
        metric: {
          dormantCustomers: dormant.map(([id, lastMonthRevenue]) => ({
            id,
            lastMonthRevenue,
          })),
        },
      });
    }

    return insights;
  }
}

export interface Insight {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  entity?: { type: string; id: string; code?: string };
  metric?: Record<string, any>;
}
