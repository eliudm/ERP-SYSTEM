import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { AccountType, PaymentMethod } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ─── BALANCE SHEET ────────────────────────────────────────
  async getBalanceSheet(asOf?: string) {
    const asOfDate = asOf ? new Date(asOf) : new Date();

    const accounts = await this.prisma.account.findMany({
      where: { isActive: true },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: 'POSTED',
              entryDate: { lte: asOfDate },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const grouped: Record<
      AccountType,
      { code: string; name: string; balance: number }[]
    > = {
      ASSET: [],
      LIABILITY: [],
      EQUITY: [],
      REVENUE: [],
      EXPENSE: [],
    };

    for (const account of accounts) {
      const debit = account.journalLines.reduce(
        (s, l) => s + Number(l.debit),
        0,
      );
      const credit = account.journalLines.reduce(
        (s, l) => s + Number(l.credit),
        0,
      );
      const balance = debit - credit;
      if (balance === 0) continue;
      grouped[account.type].push({
        code: account.code,
        name: account.name,
        balance,
      });
    }

    const totalAssets = grouped.ASSET.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = grouped.LIABILITY.reduce(
      (s, a) => s + Math.abs(a.balance),
      0,
    );
    const totalEquity = grouped.EQUITY.reduce(
      (s, a) => s + Math.abs(a.balance),
      0,
    );

    // Net income from Revenue - Expense flows into Retained Earnings
    const totalRevenue = grouped.REVENUE.reduce(
      (s, a) => s + Math.abs(a.balance),
      0,
    );
    const totalExpense = grouped.EXPENSE.reduce((s, a) => s + a.balance, 0);
    const retainedEarnings = totalRevenue - totalExpense;

    return {
      asOf: asOfDate,
      assets: {
        accounts: grouped.ASSET,
        total: totalAssets,
      },
      liabilities: {
        accounts: grouped.LIABILITY.map((a) => ({
          ...a,
          balance: Math.abs(a.balance),
        })),
        total: totalLiabilities,
      },
      equity: {
        accounts: grouped.EQUITY.map((a) => ({
          ...a,
          balance: Math.abs(a.balance),
        })),
        retainedEarnings,
        total: totalEquity + retainedEarnings,
      },
      isBalanced:
        Math.abs(
          totalAssets - (totalLiabilities + totalEquity + retainedEarnings),
        ) < 0.01,
    };
  }

  // ─── CASH FLOW STATEMENT ─────────────────────────────────
  async getCashFlow(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Identify cash/bank accounts (type ASSET, code starting with 1)
    const cashAccounts = await this.prisma.account.findMany({
      where: { type: 'ASSET', isActive: true, code: { startsWith: '1' } },
    });
    const cashAccountIds = cashAccounts.map((a) => a.id);

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: { in: cashAccountIds },
        journalEntry: { status: 'POSTED', entryDate: { gte: start, lte: end } },
      },
      include: { journalEntry: true, account: true },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    // Group by source type for activity classification
    const operatingTypes = [
      'SALES_INVOICE',
      'CUSTOMER_PAYMENT',
      'VENDOR_BILL',
      'PAYROLL',
      'EXPENSE',
    ];
    const investingTypes = ['ASSET_PURCHASE', 'ASSET_DISPOSAL'];
    const financingTypes = ['LOAN', 'EQUITY'];

    const classify = (sourceType?: string | null) => {
      if (!sourceType) return 'other';
      if (operatingTypes.some((t) => sourceType.includes(t)))
        return 'operating';
      if (investingTypes.some((t) => sourceType.includes(t)))
        return 'investing';
      if (financingTypes.some((t) => sourceType.includes(t)))
        return 'financing';
      return 'operating';
    };

    const activities = { operating: 0, investing: 0, financing: 0, other: 0 };
    const detail: Record<
      string,
      { description: string; amount: number; date: Date }[]
    > = {
      operating: [],
      investing: [],
      financing: [],
      other: [],
    };

    for (const line of lines) {
      const netCash = Number(line.debit) - Number(line.credit);
      const category = classify(line.journalEntry.sourceType);
      activities[category] += netCash;
      detail[category].push({
        description:
          line.journalEntry.description ||
          line.journalEntry.sourceType ||
          'Transaction',
        amount: netCash,
        date: line.journalEntry.entryDate,
      });
    }

    return {
      period: { startDate: start, endDate: end },
      operating: {
        total: activities.operating,
        transactions: detail.operating,
      },
      investing: {
        total: activities.investing,
        transactions: detail.investing,
      },
      financing: {
        total: activities.financing,
        transactions: detail.financing,
      },
      netChange:
        activities.operating +
        activities.investing +
        activities.financing +
        activities.other,
    };
  }

  // ─── PAYMENT MODE REPORT (SALES VS BANK RECON) ──────────
  async getPaymentModeReport(
    startDate: string,
    endDate: string,
    paymentMethod?: PaymentMethod,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const paidInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        status: 'PAID',
        paymentMethod: paymentMethod ?? { not: null },
        paidAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        invoiceNo: true,
        paidAt: true,
        total: true,
        paymentMethod: true,
      },
      orderBy: { paidAt: 'asc' },
    });

    const bankLines = await this.prisma.bankStatementLine.findMany({
      where: {
        transactionDate: { gte: start, lte: end },
        paymentMethod: paymentMethod ?? { not: null },
      },
      select: {
        id: true,
        paymentMethod: true,
        debit: true,
        credit: true,
        isMatched: true,
      },
    });

    const methods = paymentMethod
      ? [paymentMethod]
      : Object.values(PaymentMethod);
    const rows = methods.map((method) => {
      const salesRows = paidInvoices.filter((i) => i.paymentMethod === method);
      const salesAmount = salesRows.reduce(
        (sum, i) => sum + Number(i.total),
        0,
      );

      const bankRows = bankLines.filter((l) => l.paymentMethod === method);
      const bankAmount = bankRows.reduce(
        (sum, l) => sum + Math.abs(Number(l.credit) - Number(l.debit)),
        0,
      );
      const matchedRows = bankRows.filter((l) => l.isMatched);
      const matchedAmount = matchedRows.reduce(
        (sum, l) => sum + Math.abs(Number(l.credit) - Number(l.debit)),
        0,
      );

      return {
        paymentMethod: method,
        salesCount: salesRows.length,
        salesAmount,
        bankLines: bankRows.length,
        bankAmount,
        matchedBankLines: matchedRows.length,
        matchedBankAmount: matchedAmount,
        unmatchedBankLines: bankRows.length - matchedRows.length,
        unmatchedBankAmount: bankAmount - matchedAmount,
        variance: salesAmount - bankAmount,
      };
    });

    return {
      period: { startDate: start, endDate: end },
      rows,
      totals: {
        salesAmount: rows.reduce((s, r) => s + r.salesAmount, 0),
        bankAmount: rows.reduce((s, r) => s + r.bankAmount, 0),
        matchedBankAmount: rows.reduce((s, r) => s + r.matchedBankAmount, 0),
      },
    };
  }

  // ─── AGED RECEIVABLES ────────────────────────────────────
  async getAgedReceivables() {
    const today = new Date();
    const invoices = await this.prisma.salesInvoice.findMany({
      where: { status: { in: ['APPROVED', 'SENT'] } },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
    });

    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    const rows = invoices.map((inv) => {
      const due = inv.dueDate ? inv.dueDate : inv.invoiceDate;
      const daysOverdue = Math.floor(
        (today.getTime() - due.getTime()) / 86400000,
      );
      const outstanding = Number(inv.total);

      if (daysOverdue <= 0) buckets.current += outstanding;
      else if (daysOverdue <= 30) buckets.days30 += outstanding;
      else if (daysOverdue <= 60) buckets.days60 += outstanding;
      else if (daysOverdue <= 90) buckets.days90 += outstanding;
      else buckets.over90 += outstanding;

      return {
        invoiceNo: inv.invoiceNo,
        customer: inv.customer.name,
        invoiceDate: inv.invoiceDate,
        dueDate: due,
        daysOverdue: Math.max(0, daysOverdue),
        outstanding,
      };
    });

    return {
      rows,
      summary: buckets,
      totalOutstanding: Object.values(buckets).reduce((s, v) => s + v, 0),
    };
  }

  // ─── AGED PAYABLES ───────────────────────────────────────
  async getAgedPayables() {
    const today = new Date();
    const bills = await this.prisma.vendorBill.findMany({
      where: { status: { in: ['APPROVED'] } },
      include: { supplier: true },
      orderBy: { dueDate: 'asc' },
    });

    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    const rows = bills.map((bill) => {
      const due = bill.dueDate ? bill.dueDate : bill.billDate;
      const daysOverdue = Math.floor(
        (today.getTime() - due.getTime()) / 86400000,
      );
      const outstanding = Number(bill.total);

      if (daysOverdue <= 0) buckets.current += outstanding;
      else if (daysOverdue <= 30) buckets.days30 += outstanding;
      else if (daysOverdue <= 60) buckets.days60 += outstanding;
      else if (daysOverdue <= 90) buckets.days90 += outstanding;
      else buckets.over90 += outstanding;

      return {
        billNumber: bill.billNumber,
        supplier: bill.supplier.name,
        billDate: bill.billDate,
        dueDate: due,
        daysOverdue: Math.max(0, daysOverdue),
        outstanding,
      };
    });

    return {
      rows,
      summary: buckets,
      totalOutstanding: Object.values(buckets).reduce((s, v) => s + v, 0),
    };
  }

  // ─── GENERAL LEDGER ──────────────────────────────────────
  async getGeneralLedger(
    accountId: string,
    startDate: string,
    endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    // Opening balance: all posted lines before start
    const openingLines = await this.prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: { status: 'POSTED', entryDate: { lt: start } },
      },
    });
    const openingBalance = openingLines.reduce(
      (s, l) => s + Number(l.debit) - Number(l.credit),
      0,
    );

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: { status: 'POSTED', entryDate: { gte: start, lte: end } },
      },
      include: { journalEntry: true },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    let runningBalance = openingBalance;
    const ledgerLines = lines.map((l) => {
      runningBalance += Number(l.debit) - Number(l.credit);
      return {
        date: l.journalEntry.entryDate,
        reference: l.journalEntry.reference,
        description: l.description || l.journalEntry.description,
        debit: Number(l.debit),
        credit: Number(l.credit),
        balance: runningBalance,
      };
    });

    return {
      account,
      openingBalance,
      lines: ledgerLines,
      closingBalance: runningBalance,
    };
  }

  // ─── VAT RETURN ──────────────────────────────────────────
  async getVatReturn(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Sales: approved invoices in range
    const salesInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        status: { in: ['APPROVED', 'SENT', 'PAID'] },
        invoiceDate: { gte: start, lte: end },
      },
      include: { items: true },
    });

    // Purchases: approved vendor bills in range
    const vendorBills = await this.prisma.vendorBill.findMany({
      where: {
        status: { in: ['APPROVED', 'PAID'] },
        billDate: { gte: start, lte: end },
      },
      include: { items: true },
    });

    const outputVat = salesInvoices.reduce(
      (s, inv) => s + Number(inv.taxAmount),
      0,
    );
    const inputVat = vendorBills.reduce((s, b) => s + Number(b.taxAmount), 0);

    return {
      period: { startDate: start, endDate: end },
      outputVat: {
        taxableSupplies: salesInvoices.reduce(
          (s, inv) => s + Number(inv.subtotal),
          0,
        ),
        vatAmount: outputVat,
        invoiceCount: salesInvoices.length,
      },
      inputVat: {
        taxablePurchases: vendorBills.reduce(
          (s, b) => s + Number(b.subtotal),
          0,
        ),
        vatAmount: inputVat,
        billCount: vendorBills.length,
      },
      vatPayable: outputVat - inputVat,
    };
  }

  // ─── PROFIT & LOSS (INCOME STATEMENT) ────────────────────
  async getProfitAndLoss(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const accounts = await this.prisma.account.findMany({
      where: { type: { in: ['REVENUE', 'EXPENSE'] }, isActive: true },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: 'POSTED',
              entryDate: { gte: start, lte: end },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const revenue: { code: string; name: string; amount: number }[] = [];
    const expenses: { code: string; name: string; amount: number }[] = [];

    for (const acc of accounts) {
      const debit = acc.journalLines.reduce((s, l) => s + Number(l.debit), 0);
      const credit = acc.journalLines.reduce((s, l) => s + Number(l.credit), 0);
      const net = credit - debit; // Revenue: credit > debit = positive

      if (acc.type === 'REVENUE') {
        if (net !== 0)
          revenue.push({ code: acc.code, name: acc.name, amount: net });
      } else {
        const expense = debit - credit; // Expense: debit > credit = positive
        if (expense !== 0)
          expenses.push({ code: acc.code, name: acc.name, amount: expense });
      }
    }

    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const grossProfit = totalRevenue;
    const netProfit = totalRevenue - totalExpenses;

    return {
      period: { startDate: start, endDate: end },
      revenue: { lines: revenue, total: totalRevenue },
      expenses: { lines: expenses, total: totalExpenses },
      grossProfit,
      netProfit,
      netProfitMargin:
        totalRevenue !== 0 ? (netProfit / totalRevenue) * 100 : 0,
    };
  }

  // ─── TRIAL BALANCE ────────────────────────────────────────
  async getTrialBalance(asOf?: string) {
    const asOfDate = asOf ? new Date(asOf) : new Date();

    const accounts = await this.prisma.account.findMany({
      where: { isActive: true },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: 'POSTED',
              entryDate: { lte: asOfDate },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const lines: {
      code: string;
      name: string;
      type: string;
      debit: number;
      credit: number;
    }[] = [];

    for (const acc of accounts) {
      const totalDebit = acc.journalLines.reduce(
        (s, l) => s + Number(l.debit),
        0,
      );
      const totalCredit = acc.journalLines.reduce(
        (s, l) => s + Number(l.credit),
        0,
      );
      if (totalDebit === 0 && totalCredit === 0) continue;

      lines.push({
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit: totalDebit,
        credit: totalCredit,
      });
    }

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

    return {
      asOf: asOfDate,
      lines,
      totals: { debit: totalDebit, credit: totalCredit },
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }
}
