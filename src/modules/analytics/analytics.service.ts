import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ─── SALES TREND (daily/monthly aggregation) ─────────────
  async getSalesTrend(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'month' = 'month',
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

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
    const start = new Date(startDate);
    const end = new Date(endDate);

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
    const start = new Date(startDate);
    const end = new Date(endDate);

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
    const start = new Date(startDate);
    const end = new Date(endDate);

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
    const start = new Date(startDate);
    const end = new Date(endDate);

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
}
