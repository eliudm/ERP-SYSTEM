import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

@Injectable()
export class TaxReportService {
  constructor(private prisma: PrismaService) {}

  // ─── VAT Return (Output Tax - Input Tax) ────────────────────────────────────
  async getVatReturn(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all posted sales invoices in the period
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        invoiceDate: { gte: start, lte: end },
        status: { in: ['APPROVED', 'PAID'] },
      },
      include: { items: true },
    });

    // Get all posted vendor bills in the period
    const vendorBills = await this.prisma.vendorBill.findMany({
      where: {
        billDate: { gte: start, lte: end },
        status: { in: ['APPROVED', 'PAID'] },
      },
      include: { items: true },
    });

    // Output VAT (collected on sales)
    let totalSales = 0;
    let outputVat = 0;
    for (const inv of invoices) {
      totalSales += Number(inv.subtotal);
      outputVat += Number(inv.taxAmount);
    }

    // Input VAT (paid on purchases)
    let totalPurchases = 0;
    let inputVat = 0;
    for (const bill of vendorBills) {
      totalPurchases += Number(bill.subtotal);
      inputVat += Number(bill.taxAmount);
    }

    const vatPayable = outputVat - inputVat;

    return {
      period: { startDate, endDate },
      outputTax: {
        numberOfSupplies: invoices.length,
        taxableSales: totalSales,
        vatCollected: outputVat,
      },
      inputTax: {
        numberOfPurchases: vendorBills.length,
        taxablePurchases: totalPurchases,
        vatPaid: inputVat,
      },
      vatPayable: Math.max(0, vatPayable),
      vatRefundable: Math.max(0, -vatPayable),
      netVat: vatPayable,
    };
  }

  // ─── Withholding Tax Report ──────────────────────────────────────────────────
  async getWhtReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // WHT is typically deducted from payments to suppliers
    // Fetch payroll PAYE totals as a proxy for WHT deductions
    const payrolls = await this.prisma.payroll.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['APPROVED', 'PAID'] },
      },
      include: { lines: true },
    });

    const totalPaye = payrolls.reduce((s, p) => s + Number(p.totalPaye), 0);
    const totalNhif = payrolls.reduce((s, p) => s + Number(p.totalNhif), 0);
    const totalNssf = payrolls.reduce((s, p) => s + Number(p.totalNssf), 0);

    return {
      period: { startDate, endDate },
      paye: {
        payrolls: payrolls.length,
        totalGross: payrolls.reduce((s, p) => s + Number(p.totalGross), 0),
        totalPaye,
      },
      statutory: { nhif: totalNhif, nssf: totalNssf },
      totalWithholding: totalPaye + totalNhif + totalNssf,
    };
  }

  // ─── Tax Summary Dashboard ───────────────────────────────────────────────────
  async getTaxSummary(year: number) {
    const months: {
      month: number;
      name: string;
      outputVat: number;
      inputVat: number;
      vatPayable: number;
    }[] = [];
    for (let m = 1; m <= 12; m++) {
      const start = new Date(year, m - 1, 1).toISOString();
      const end = new Date(year, m, 0, 23, 59, 59).toISOString();
      const vat = await this.getVatReturn(start, end);
      months.push({
        month: m,
        name: new Date(year, m - 1).toLocaleString('default', {
          month: 'long',
        }),
        outputVat: vat.outputTax.vatCollected,
        inputVat: vat.inputTax.vatPaid,
        vatPayable: vat.vatPayable,
      });
    }

    return {
      year,
      months,
      annualTotals: {
        outputVat: months.reduce((s, m) => s + m.outputVat, 0),
        inputVat: months.reduce((s, m) => s + m.inputVat, 0),
        vatPayable: months.reduce((s, m) => s + m.vatPayable, 0),
      },
    };
  }
}
