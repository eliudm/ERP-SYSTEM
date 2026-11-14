import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CacheService } from '../../cache.service';

const REPORT_CACHE_TTL_SECONDS = 120;

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  private async cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit) return hit;
    const result = await compute();
    await this.cache.set(key, result, REPORT_CACHE_TTL_SECONDS);
    return result;
  }

  // ─── SALES TREND (daily/monthly aggregation) ─────────────
  async getSalesTrend(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'month' = 'month',
  ) {
    return this.cached(
      `analytics:sales-trend:${startDate}:${endDate}:${granularity}`,
      () => this.computeSalesTrend(startDate, endDate, granularity),
    );
  }

  private async computeSalesTrend(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'month' = 'month',
  ) {
    const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
    const start = new Date(
      new Date(`${startDate}T00:00:00.000Z`).getTime() - NAIROBI_OFFSET_MS,
    );
    const end = new Date(
      new Date(`${endDate}T23:59:59.999Z`).getTime() - NAIROBI_OFFSET_MS,
    );

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        status: { in: ['APPROVED', 'PAID'] },
        invoiceDate: { gte: start, lte: end },
      },
      select: { invoiceDate: true, total: true, taxAmount: true },
      orderBy: { invoiceDate: 'asc' },
    });

    const buckets = new Map<
      string,
      { revenue: number; tax: number; count: number }
    >();

    for (const inv of invoices) {
      const key =
        granularity === 'day'
          ? inv.invoiceDate.toISOString().slice(0, 10)
          : inv.invoiceDate.toISOString().slice(0, 7); // YYYY-MM

      const existing = buckets.get(key) || { revenue: 0, tax: 0, count: 0 };
      existing.revenue += Number(inv.total);
      existing.tax += Number(inv.taxAmount);
      existing.count += 1;
      buckets.set(key, existing);
    }

    const data = Array.from(buckets.entries()).map(([period, values]) => ({
      period,
      ...values,
    }));

    return {
      granularity,
      range: { start, end },
      data,
      totals: {
        revenue: data.reduce((s, d) => s + d.revenue, 0),
        tax: data.reduce((s, d) => s + d.tax, 0),
        count: data.reduce((s, d) => s + d.count, 0),
      },
    };
  }

  // ─── EXPENSE TREND ───────────────────────────────────────
  async getExpenseTrend(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'month' = 'month',
  ) {
    return this.cached(
      `analytics:expense-trend:${startDate}:${endDate}:${granularity}`,
      () => this.computeExpenseTrend(startDate, endDate, granularity),
    );
  }

  private async computeExpenseTrend(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'month' = 'month',
  ) {
    const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
    const start = new Date(
      new Date(`${startDate}T00:00:00.000Z`).getTime() - NAIROBI_OFFSET_MS,
    );
    const end = new Date(
      new Date(`${endDate}T23:59:59.999Z`).getTime() - NAIROBI_OFFSET_MS,
    );

    const lines = await this.prisma.journalLine.findMany({
      where: {
        account: { type: 'EXPENSE' },
        journalEntry: {
          status: 'POSTED',
          entryDate: { gte: start, lte: end },
        },
      },
      include: { journalEntry: { select: { entryDate: true } } },
    });

    const buckets = new Map<string, number>();

    for (const line of lines) {
      const key =
        granularity === 'day'
          ? line.journalEntry.entryDate.toISOString().slice(0, 10)
          : line.journalEntry.entryDate.toISOString().slice(0, 7);

      const amount = Number(line.debit) - Number(line.credit);
      buckets.set(key, (buckets.get(key) || 0) + amount);
    }

    const data = Array.from(buckets.entries())
      .map(([period, amount]) => ({ period, amount }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      granularity,
      range: { start, end },
      data,
      total: data.reduce((s, d) => s + d.amount, 0),
    };
  }

  // ─── PROFIT TREND ────────────────────────────────────────
  async getProfitTrend(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'month' = 'month',
  ) {
    return this.cached(
      `analytics:profit-trend:${startDate}:${endDate}:${granularity}`,
      () => this.computeProfitTrend(startDate, endDate, granularity),
    );
  }

  private async computeProfitTrend(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'month' = 'month',
  ) {
    const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
    const start = new Date(
      new Date(`${startDate}T00:00:00.000Z`).getTime() - NAIROBI_OFFSET_MS,
    );
    const end = new Date(
      new Date(`${endDate}T23:59:59.999Z`).getTime() - NAIROBI_OFFSET_MS,
    );

    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        account: { type: { in: ['REVENUE', 'EXPENSE'] } },
        journalEntry: {
          status: 'POSTED',
          entryDate: { gte: start, lte: end },
        },
      },
      include: {
        account: { select: { type: true } },
        journalEntry: { select: { entryDate: true } },
      },
    });

    const buckets = new Map<string, { revenue: number; expense: number }>();

    for (const line of journalLines) {
      const key =
        granularity === 'day'
          ? line.journalEntry.entryDate.toISOString().slice(0, 10)
          : line.journalEntry.entryDate.toISOString().slice(0, 7);

      const existing = buckets.get(key) || { revenue: 0, expense: 0 };

      if (line.account.type === 'REVENUE') {
        existing.revenue += Number(line.credit) - Number(line.debit);
      } else {
        existing.expense += Number(line.debit) - Number(line.credit);
      }
      buckets.set(key, existing);
    }

    const data = Array.from(buckets.entries())
      .map(([period, values]) => ({
        period,
        revenue: values.revenue,
        expense: values.expense,
        profit: values.revenue - values.expense,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
    const totalExpense = data.reduce((s, d) => s + d.expense, 0);

    return {
      granularity,
      range: { start, end },
      data,
      totals: {
        revenue: totalRevenue,
        expense: totalExpense,
        profit: totalRevenue - totalExpense,
        margin:
          totalRevenue !== 0
            ? ((totalRevenue - totalExpense) / totalRevenue) * 100
            : 0,
      },
    };
  }

  // ─── TOP PRODUCTS (by revenue) ───────────────────────────
  async getTopProducts(startDate: string, endDate: string, limit = 10) {
    return this.cached(
      `analytics:top-products:${startDate}:${endDate}:${limit}`,
      () => this.computeTopProducts(startDate, endDate, limit),
    );
  }

  private async computeTopProducts(
    startDate: string,
    endDate: string,
    limit = 10,
  ) {
    const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
    const start = new Date(
      new Date(`${startDate}T00:00:00.000Z`).getTime() - NAIROBI_OFFSET_MS,
    );
    const end = new Date(
      new Date(`${endDate}T23:59:59.999Z`).getTime() - NAIROBI_OFFSET_MS,
    );

    const items = await this.prisma.salesInvoiceItem.findMany({
      where: {
        invoice: {
          status: { in: ['APPROVED', 'PAID'] },
          invoiceDate: { gte: start, lte: end },
        },
      },
      include: {
        product: { select: { id: true, code: true, name: true } },
      },
    });

    const productMap = new Map<
      string,
      {
        productId: string;
        code: string;
        name: string;
        revenue: number;
        quantitySold: number;
      }
    >();

    for (const item of items) {
      const key = item.productId;
      const existing = productMap.get(key) || {
        productId: item.product.id,
        code: item.product.code,
        name: item.product.name,
        revenue: 0,
        quantitySold: 0,
      };
      existing.revenue += Number(item.lineTotal);
      existing.quantitySold += Number(item.quantity);
      productMap.set(key, existing);
    }

    const ranked = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return {
      period: { start, end },
      limit,
      data: ranked,
    };
  }

  // ─── TOP CUSTOMERS (by revenue) ──────────────────────────
  async getTopCustomers(startDate: string, endDate: string, limit = 10) {
    return this.cached(
      `analytics:top-customers:${startDate}:${endDate}:${limit}`,
      () => this.computeTopCustomers(startDate, endDate, limit),
    );
  }

  private async computeTopCustomers(
    startDate: string,
    endDate: string,
    limit = 10,
  ) {
    const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
    const start = new Date(
      new Date(`${startDate}T00:00:00.000Z`).getTime() - NAIROBI_OFFSET_MS,
    );
    const end = new Date(
      new Date(`${endDate}T23:59:59.999Z`).getTime() - NAIROBI_OFFSET_MS,
    );

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        status: { in: ['APPROVED', 'PAID'] },
        invoiceDate: { gte: start, lte: end },
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    const customerMap = new Map<
      string,
      {
        customerId: string;
        name: string;
        email: string | null;
        revenue: number;
        invoiceCount: number;
      }
    >();

    for (const inv of invoices) {
      const key = inv.customerId;
      const existing = customerMap.get(key) || {
        customerId: inv.customer.id,
        name: inv.customer.name,
        email: inv.customer.email,
        revenue: 0,
        invoiceCount: 0,
      };
      existing.revenue += Number(inv.total);
      existing.invoiceCount += 1;
      customerMap.set(key, existing);
    }

    const ranked = Array.from(customerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return {
      period: { start, end },
      limit,
      data: ranked,
    };
  }

  // ─── SALES BY PAYMENT METHOD ─────────────────────────────
  async getSalesByPaymentMethod(startDate: string, endDate: string) {
    return this.cached(
      `analytics:sales-by-payment-method:${startDate}:${endDate}`,
      () => this.computeSalesByPaymentMethod(startDate, endDate),
    );
  }

  private async computeSalesByPaymentMethod(
    startDate: string,
    endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        status: 'PAID',
        paidAt: { gte: start, lte: end },
        paymentMethod: { not: null },
      },
      select: { paymentMethod: true, total: true },
    });

    const methodMap = new Map<string, { count: number; amount: number }>();
    for (const inv of invoices) {
      const key = inv.paymentMethod as string;
      const existing = methodMap.get(key) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += Number(inv.total);
      methodMap.set(key, existing);
    }

    const data = Array.from(methodMap.entries()).map(([method, values]) => ({
      paymentMethod: method,
      ...values,
    }));

    return {
      period: { start, end },
      data,
      total: data.reduce((s, d) => s + d.amount, 0),
    };
  }

  // ─── INVENTORY VALUATION SUMMARY ─────────────────────────
  async getInventorySummary() {
    return this.cached('analytics:inventory-summary', () =>
      this.computeInventorySummary(),
    );
  }

  private async computeInventorySummary() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { category: { select: { name: true } } },
    });

    const byCategory = new Map<
      string,
      { count: number; totalValue: number; lowStockCount: number }
    >();

    let totalValue = 0;
    let totalLowStock = 0;

    for (const p of products) {
      const value = Number(p.stockQuantity) * Number(p.unitPrice);
      totalValue += value;

      const isLow = Number(p.stockQuantity) <= Number(p.reorderLevel);
      if (isLow) totalLowStock++;

      const cat = p.category?.name || 'Uncategorized';
      const existing = byCategory.get(cat) || {
        count: 0,
        totalValue: 0,
        lowStockCount: 0,
      };
      existing.count += 1;
      existing.totalValue += value;
      if (isLow) existing.lowStockCount += 1;
      byCategory.set(cat, existing);
    }

    const categories = Array.from(byCategory.entries())
      .map(([category, values]) => ({ category, ...values }))
      .sort((a, b) => b.totalValue - a.totalValue);

    return {
      totalProducts: products.length,
      totalValue,
      totalLowStock,
      byCategory: categories,
    };
  }

  // ─── KPI SUMMARY with period-over-period comparison ──────
  async getKpiSummary(startDate: string, endDate: string) {
    const key = `analytics:kpi-summary:${startDate}:${endDate}`;
    return this.cached(key, () => this.computeKpiSummary(startDate, endDate));
  }

  private async computeKpiSummary(startDate: string, endDate: string) {
    const tenantId = (await this.prisma.$queryRaw<[{ id: string }]>`SELECT current_setting('app.tenant_id', true) AS id`)[0]?.id;

    const start = new Date(startDate);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);
    const periodMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodMs);

    const invoiceWhere = (s: Date, e: Date) => ({
      tenantId,
      status: { in: ['APPROVED', 'PAID'] as any },
      invoiceDate: { gte: s, lte: e },
    });

    const [current, previous, newCustomers, prevNewCustomers, paidCount, approvedCount] = await Promise.all([
      this.prisma.salesInvoice.aggregate({
        where: invoiceWhere(start, end),
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.salesInvoice.aggregate({
        where: invoiceWhere(prevStart, prevEnd),
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.customer.count({ where: { tenantId, createdAt: { gte: start, lte: end } } }),
      this.prisma.customer.count({ where: { tenantId, createdAt: { gte: prevStart, lte: prevEnd } } }),
      this.prisma.salesInvoice.count({ where: { tenantId, status: 'PAID', invoiceDate: { gte: start, lte: end } } }),
      this.prisma.salesInvoice.count({ where: { tenantId, status: { in: ['APPROVED', 'PAID'] as any }, invoiceDate: { gte: start, lte: end } } }),
    ]);

    const revenue = Number(current._sum.total ?? 0);
    const prevRevenue = Number(previous._sum.total ?? 0);
    const count = current._count;
    const prevCount = previous._count;
    const avgOrder = count > 0 ? revenue / count : 0;
    const prevAvgOrder = prevCount > 0 ? prevRevenue / prevCount : 0;
    const collectionRate = approvedCount > 0 ? Math.round((paidCount / approvedCount) * 100) : 0;

    const pct = (curr: number, prev: number) =>
      prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);

    return {
      revenue: { value: revenue, change: pct(revenue, prevRevenue) },
      invoiceCount: { value: count, change: pct(count, prevCount) },
      avgOrderValue: { value: avgOrder, change: pct(avgOrder, prevAvgOrder) },
      collectionRate: { value: collectionRate, change: null },
      newCustomers: { value: newCustomers, change: pct(newCustomers, prevNewCustomers) },
    };
  }

  // ─── SALES REP LEADERBOARD ────────────────────────────────
  async getSalesRepLeaderboard(startDate: string, endDate: string) {
    const key = `analytics:sales-rep:${startDate}:${endDate}`;
    return this.cached(key, () => this.computeSalesRepLeaderboard(startDate, endDate));
  }

  private async computeSalesRepLeaderboard(startDate: string, endDate: string) {
    const tenantId = (await this.prisma.$queryRaw<[{ id: string }]>`SELECT current_setting('app.tenant_id', true) AS id`)[0]?.id;

    const start = new Date(startDate);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        tenantId,
        status: { in: ['APPROVED', 'PAID'] as any },
        invoiceDate: { gte: start, lte: end },
        cashierId: { not: null },
      },
      select: { cashierId: true, total: true, cashier: { select: { firstName: true, lastName: true, email: true } } },
    });

    const repMap = new Map<string, { name: string; email: string; revenue: number; count: number }>();
    for (const inv of invoices) {
      if (!inv.cashierId || !inv.cashier) continue;
      const existing = repMap.get(inv.cashierId) ?? {
        name: `${inv.cashier.firstName} ${inv.cashier.lastName}`.trim(),
        email: inv.cashier.email,
        revenue: 0,
        count: 0,
      };
      existing.revenue += Number(inv.total);
      existing.count++;
      repMap.set(inv.cashierId, existing);
    }

    const leaderboard = Array.from(repMap.entries())
      .map(([id, r]) => ({ userId: id, ...r, avgOrder: r.count > 0 ? r.revenue / r.count : 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    return { data: leaderboard };
  }

  // ─── TOP CATEGORIES (by revenue from invoice items) ─────
  async getTopCategories(startDate: string, endDate: string, limit = 10) {
    return this.cached(
      `analytics:top-categories:${startDate}:${endDate}:${limit}`,
      () => this.computeTopCategories(startDate, endDate, limit),
    );
  }

  private async computeTopCategories(startDate: string, endDate: string, limit = 10) {
    const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
    const start = new Date(new Date(`${startDate}T00:00:00.000Z`).getTime() - NAIROBI_OFFSET_MS);
    const end = new Date(new Date(`${endDate}T23:59:59.999Z`).getTime() - NAIROBI_OFFSET_MS);

    const items = await this.prisma.salesInvoiceItem.findMany({
      where: {
        invoice: {
          status: { in: ['APPROVED', 'PAID'] },
          invoiceDate: { gte: start, lte: end },
        },
      },
      select: {
        invoiceId: true,
        lineTotal: true,
        quantity: true,
        product: { select: { category: { select: { id: true, name: true } } } },
      },
    });

    const catMap = new Map<string, { name: string; revenue: number; unitsSold: number; invoiceIds: Set<string> }>();

    for (const item of items) {
      const catId = item.product?.category?.id ?? 'uncategorized';
      const catName = item.product?.category?.name ?? 'Uncategorized';
      const existing = catMap.get(catId) ?? { name: catName, revenue: 0, unitsSold: 0, invoiceIds: new Set<string>() };
      existing.revenue += Number(item.lineTotal);
      existing.unitsSold += Number(item.quantity);
      existing.invoiceIds.add(item.invoiceId);
      catMap.set(catId, existing);
    }

    const data = Array.from(catMap.entries())
      .map(([id, v]) => ({ categoryId: id, name: v.name, revenue: v.revenue, unitsSold: v.unitsSold, orders: v.invoiceIds.size }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return { period: { start, end }, data };
  }

  // ─── QUOTE → INVOICE CONVERSION ──────────────────────────
  async getQuoteConversion(startDate: string, endDate: string) {
    const key = `analytics:quote-conversion:${startDate}:${endDate}`;
    return this.cached(key, () => this.computeQuoteConversion(startDate, endDate));
  }

  private async computeQuoteConversion(startDate: string, endDate: string) {
    const tenantId = (await this.prisma.$queryRaw<[{ id: string }]>`SELECT current_setting('app.tenant_id', true) AS id`)[0]?.id;

    const start = new Date(startDate);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);

    const [total, accepted, expired, declined] = await Promise.all([
      this.prisma.salesQuote.count({ where: { tenantId, createdAt: { gte: start, lte: end } } }),
      this.prisma.salesQuote.count({ where: { tenantId, createdAt: { gte: start, lte: end }, status: 'ACCEPTED' } }),
      this.prisma.salesQuote.count({ where: { tenantId, createdAt: { gte: start, lte: end }, status: 'EXPIRED' } }),
      this.prisma.salesQuote.count({ where: { tenantId, createdAt: { gte: start, lte: end }, status: 'DECLINED' } }),
    ]);

    return {
      total,
      converted: accepted,
      expired,
      rejected: declined,
      pending: total - accepted - expired - declined,
      conversionRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
    };
  }
}
