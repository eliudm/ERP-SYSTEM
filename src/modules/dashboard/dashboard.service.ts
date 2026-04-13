import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(from?: string, to?: string) {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const rangeStart = from ? new Date(from) : startOfMonth;
    const rangeEnd = to ? new Date(to) : now;

    const [
      salesToday,
      salesThisMonth,
      paidInvoices,
      expenseLines,
      pendingInvoices,
      lowStockProducts,
    ] = await Promise.all([
      this.prisma.salesInvoice.aggregate({
        where: {
          invoiceDate: { gte: startOfToday, lte: now },
          status: { in: ['APPROVED', 'PAID'] },
        },
        _sum: { total: true },
      }),
      this.prisma.salesInvoice.aggregate({
        where: {
          invoiceDate: { gte: startOfMonth, lte: now },
          status: { in: ['APPROVED', 'PAID'] },
        },
        _sum: { total: true },
      }),
      this.prisma.salesInvoice.findMany({
        where: {
          paidAt: { gte: rangeStart, lte: rangeEnd },
          status: 'PAID',
          paymentMethod: { not: null },
        },
        select: { paymentMethod: true, total: true },
      }),
      this.prisma.journalLine.findMany({
        where: {
          journalEntry: {
            status: 'POSTED',
            entryDate: { gte: rangeStart, lte: rangeEnd },
          },
          account: {
            type: 'EXPENSE',
          },
        },
        select: { debit: true, credit: true },
      }),
      this.prisma.salesInvoice.count({
        where: { status: { in: ['DRAFT', 'APPROVED', 'SENT'] } },
      }),
      this.prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          stockQuantity: true,
          reorderLevel: true,
        },
      }),
    ]);

    const paymentsByMethod = paidInvoices.reduce(
      (acc, invoice) => {
        const key = invoice.paymentMethod ?? 'UNKNOWN';
        acc[key] = (acc[key] ?? 0) + Number(invoice.total);
        return acc;
      },
      {} as Record<string, number>,
    );

    const expenseTotal = expenseLines.reduce(
      (sum, line) => sum + Number(line.debit) - Number(line.credit),
      0,
    );

    const lowStockAlerts = lowStockProducts
      .filter((p) => Number(p.stockQuantity) <= Number(p.reorderLevel))
      .map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        stockQuantity: Number(p.stockQuantity),
        reorderLevel: Number(p.reorderLevel),
      }));

    return {
      kpis: {
        salesToday: Number(salesToday._sum.total ?? 0),
        salesThisMonth: Number(salesThisMonth._sum.total ?? 0),
        expenses: expenseTotal,
        pendingInvoices,
      },
      paymentsByMethod,
      alerts: {
        lowStockCount: lowStockAlerts.length,
        lowStock: lowStockAlerts,
      },
      period: {
        from: rangeStart,
        to: rangeEnd,
      },
    };
  }
}
