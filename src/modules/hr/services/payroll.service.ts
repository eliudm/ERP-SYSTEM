import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { CreatePayrollDto } from '../dto';
import { ApprovalEntityType, PayrollStatus } from '@prisma/client';
import { WorkflowService } from '../../workflow/workflow.service';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private postingEngine: PostingEngineService,
    private workflowService: WorkflowService,
  ) {}

  // ─── KENYA PAYE CALCULATION (KRA Tax Bands 2024) ─────────
  private calculatePAYE(grossSalary: number): number {
    let paye = 0;

    // KRA PAYE Tax Bands (monthly)
    // 0 - 24,000 @ 10%
    // 24,001 - 32,333 @ 25%
    // 32,334 and above @ 30%

    if (grossSalary <= 24000) {
      paye = grossSalary * 0.1;
    } else if (grossSalary <= 32333) {
      paye = 24000 * 0.1 + (grossSalary - 24000) * 0.25;
    } else {
      paye = 24000 * 0.1 + (32333 - 24000) * 0.25 + (grossSalary - 32333) * 0.3;
    }

    // Personal Relief (KES 2,400/month)
    paye = Math.max(0, paye - 2400);

    return Math.round(paye * 100) / 100;
  }

  // ─── KENYA NHIF CALCULATION ──────────────────────────────
  private calculateNHIF(grossSalary: number): number {
    // NHIF Bands 2024
    if (grossSalary <= 5999) return 150;
    if (grossSalary <= 7999) return 300;
    if (grossSalary <= 11999) return 400;
    if (grossSalary <= 14999) return 500;
    if (grossSalary <= 19999) return 600;
    if (grossSalary <= 24999) return 750;
    if (grossSalary <= 29999) return 850;
    if (grossSalary <= 34999) return 900;
    if (grossSalary <= 39999) return 950;
    if (grossSalary <= 44999) return 1000;
    if (grossSalary <= 49999) return 1100;
    if (grossSalary <= 59999) return 1200;
    if (grossSalary <= 69999) return 1300;
    if (grossSalary <= 79999) return 1400;
    if (grossSalary <= 89999) return 1500;
    if (grossSalary <= 99999) return 1600;
    return 1700;
  }

  // ─── KENYA NSSF CALCULATION ──────────────────────────────
  private calculateNSSF(grossSalary: number): number {
    // NSSF Act 2013 - Tier I & Tier II
    // Tier I: 6% of gross up to KES 6,000 (Lower Earnings Limit)
    // Tier II: 6% of gross between KES 6,000 and KES 18,000 (Upper Earnings Limit)
    const tierILimit = 6000;
    const tierIILimit = 18000;
    const rate = 0.06;

    let nssf = 0;

    if (grossSalary <= tierILimit) {
      nssf = grossSalary * rate;
    } else if (grossSalary <= tierIILimit) {
      nssf = tierILimit * rate + (grossSalary - tierILimit) * rate;
    } else {
      nssf = tierILimit * rate + (tierIILimit - tierILimit) * rate;
    }

    return Math.round(nssf * 100) / 100;
  }

  // ─── CALCULATE EMPLOYEE PAYSLIP ──────────────────────────
  calculatePayslip(grossSalary: number) {
    const paye = this.calculatePAYE(grossSalary);
    const nhif = this.calculateNHIF(grossSalary);
    const nssf = this.calculateNSSF(grossSalary);
    const totalDeductions = paye + nhif + nssf;
    const netSalary = grossSalary - totalDeductions;

    return {
      grossSalary,
      deductions: { paye, nhif, nssf, total: totalDeductions },
      netSalary,
    };
  }

  // ─── GENERATE PAYROLL ────────────────────────────────────
  async generate(dto: CreatePayrollDto) {
    // Check if payroll already exists for this month
    const existing = await this.prisma.payroll.findUnique({
      where: { month_year: { month: dto.month, year: dto.year } },
    });

    if (existing) {
      throw new ConflictException(
        `Payroll for ${dto.month}/${dto.year} already exists`,
      );
    }

    // Get all active employees
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
    });

    if (employees.length === 0) {
      throw new BadRequestException('No active employees found');
    }

    // Fetch active allowances and loans for all employees in one query
    const now = new Date();
    const [activeAllowances, activeLoans] = await Promise.all([
      this.prisma.allowance.findMany({
        where: {
          employeeId: { in: employees.map((e) => e.id) },
          isActive: true,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      }),
      this.prisma.loanDeduction.findMany({
        where: {
          employeeId: { in: employees.map((e) => e.id) },
          isActive: true,
          balance: { gt: 0 },
        },
      }),
    ]);

    const allowancesByEmployee = new Map<string, typeof activeAllowances>();
    for (const a of activeAllowances) {
      if (!allowancesByEmployee.has(a.employeeId))
        allowancesByEmployee.set(a.employeeId, []);
      allowancesByEmployee.get(a.employeeId)!.push(a);
    }

    const loansByEmployee = new Map<string, typeof activeLoans>();
    for (const l of activeLoans) {
      if (!loansByEmployee.has(l.employeeId))
        loansByEmployee.set(l.employeeId, []);
      loansByEmployee.get(l.employeeId)!.push(l);
    }

    // Calculate payroll for each employee
    let totalGross = 0;
    let totalPaye = 0;
    let totalNhif = 0;
    let totalNssf = 0;
    let totalNet = 0;

    const payrollLines: any[] = employees.map((emp) => {
      const basic = Number(emp.salary);
      const empAllowances = allowancesByEmployee.get(emp.id) || [];
      const empLoans = loansByEmployee.get(emp.id) || [];

      const totalAllowances = empAllowances.reduce(
        (s, a) => s + Number(a.amount),
        0,
      );
      const gross = basic + totalAllowances;
      const payslip = this.calculatePayslip(gross);

      const totalLoanDeductions = empLoans.reduce(
        (s, l) => s + Math.min(Number(l.monthlyDeduction), Number(l.balance)),
        0,
      );
      const netAfterLoans = payslip.netSalary - totalLoanDeductions;

      totalGross += gross;
      totalPaye += payslip.deductions.paye;
      totalNhif += payslip.deductions.nhif;
      totalNssf += payslip.deductions.nssf;
      totalNet += netAfterLoans;

      return {
        employeeId: emp.id,
        grossSalary: gross,
        payeAmount: payslip.deductions.paye,
        nhifAmount: payslip.deductions.nhif,
        nssfAmount: payslip.deductions.nssf,
        netSalary: netAfterLoans,
        totalAllowances,
        totalLoanDeductions,
        allowancesSnapshot: empAllowances.map((a) => ({
          type: a.type,
          amount: Number(a.amount),
        })),
        loanDeductionsSnapshot: empLoans.map((l) => ({
          id: l.id,
          monthly: Number(l.monthlyDeduction),
          balance: Number(l.balance),
        })),
      };
    });

    // Process loan deductions — reduce remaining balances
    const loanUpdates = activeLoans.map((loan) => {
      const installment = Math.min(
        Number(loan.monthlyDeduction),
        Number(loan.balance),
      );
      const newBalance = Number(loan.balance) - installment;
      return this.prisma.loanDeduction.update({
        where: { id: loan.id },
        data: { balance: newBalance, isActive: newBalance > 0 },
      });
    });

    // Create payroll + update loan balances in a transaction
    const [payroll] = await this.prisma.$transaction([
      this.prisma.payroll.create({
        data: {
          month: dto.month,
          year: dto.year,
          status: PayrollStatus.DRAFT,
          totalGross,
          totalPaye,
          totalNhif,
          totalNssf,
          totalNet,
          lines: { create: payrollLines },
        },
        include: { lines: { include: { employee: true } } },
      }),
      ...loanUpdates,
    ]);
    return payroll;
  }

  // ─── APPROVE & POST PAYROLL ──────────────────────────────
  async approve(id: string) {
    await this.workflowService.assertApprovalIfExists(
      ApprovalEntityType.PAYROLL,
      id,
    );

    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: { lines: { include: { employee: true } } },
    });

    if (!payroll) throw new NotFoundException('Payroll not found');

    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException(`Payroll is already ${payroll.status}`);
    }

    // Get required accounts
    const [
      salaryExpense,
      payePayable,
      nhifPayable,
      nssfPayable,
      salaryPayable,
    ] = await Promise.all([
      this.prisma.account.findFirst({ where: { code: '5100' } }), // Salaries
      this.prisma.account.findFirst({ where: { code: '2200' } }), // Tax Payable
      this.prisma.account.findFirst({ where: { code: '2300' } }), // Accrued (NHIF)
      this.prisma.account.findFirst({ where: { code: '2300' } }), // Accrued (NSSF)
      this.prisma.account.findFirst({ where: { code: '2300' } }), // Accrued (Net Salaries)
    ]);

    if (
      !salaryExpense ||
      !payePayable ||
      !nhifPayable ||
      !nssfPayable ||
      !salaryPayable
    ) {
      throw new BadRequestException(
        'Required accounts not found. Please seed chart of accounts first.',
      );
    }

    const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString(
      'default',
      { month: 'long' },
    );

    // Post payroll journal entry
    await this.postingEngine.postTransaction({
      reference: `PAY-${payroll.year}-${String(payroll.month).padStart(2, '0')}`,
      description: `Payroll - ${monthName} ${payroll.year}`,
      entryDate: new Date().toISOString(),
      sourceType: 'PAYROLL',
      sourceId: payroll.id,
      lines: [
        // Debit Salary Expense (gross)
        {
          accountId: salaryExpense.id,
          debit: Number(payroll.totalGross),
          credit: 0,
          description: `Gross Salaries - ${monthName} ${payroll.year}`,
        },
        // Credit PAYE Payable
        {
          accountId: payePayable.id,
          debit: 0,
          credit: Number(payroll.totalPaye),
          description: `PAYE - ${monthName} ${payroll.year}`,
        },
        // Credit NHIF Payable
        {
          accountId: nhifPayable.id,
          debit: 0,
          credit: Number(payroll.totalNhif),
          description: `NHIF - ${monthName} ${payroll.year}`,
        },
        // Credit NSSF Payable
        {
          accountId: nssfPayable.id,
          debit: 0,
          credit: Number(payroll.totalNssf),
          description: `NSSF - ${monthName} ${payroll.year}`,
        },
        // Credit Net Salaries Payable
        {
          accountId: salaryPayable.id,
          debit: 0,
          credit: Number(payroll.totalNet),
          description: `Net Salaries Payable - ${monthName} ${payroll.year}`,
        },
      ],
    });

    const updated = await this.prisma.payroll.update({
      where: { id },
      data: { status: PayrollStatus.APPROVED },
      include: { lines: { include: { employee: true } } },
    });

    await this.workflowService.consumeApprovedRequest(
      ApprovalEntityType.PAYROLL,
      id,
    );

    return updated;
  }

  // ─── MARK PAYROLL AS PAID ────────────────────────────────
  async markAsPaid(id: string) {
    const payroll = await this.prisma.payroll.findUnique({ where: { id } });
    if (!payroll) throw new NotFoundException('Payroll not found');

    if (payroll.status !== PayrollStatus.APPROVED) {
      throw new BadRequestException(
        'Only APPROVED payrolls can be marked as paid',
      );
    }

    // Get accounts
    const [cashAccount, salaryPayable] = await Promise.all([
      this.prisma.account.findFirst({ where: { code: '1000' } }),
      this.prisma.account.findFirst({ where: { code: '2300' } }),
    ]);

    if (!cashAccount || !salaryPayable) {
      throw new BadRequestException('Required accounts not found');
    }

    const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString(
      'default',
      { month: 'long' },
    );

    // Post payment journal entry
    await this.postingEngine.postTransaction({
      reference: `PAY-PMT-${payroll.year}-${String(payroll.month).padStart(2, '0')}`,
      description: `Salary Payment - ${monthName} ${payroll.year}`,
      entryDate: new Date().toISOString(),
      sourceType: 'PAYROLL_PAYMENT',
      sourceId: payroll.id,
      lines: [
        // Debit Net Salaries Payable
        {
          accountId: salaryPayable.id,
          debit: Number(payroll.totalNet),
          credit: 0,
          description: `Clear Net Salaries - ${monthName} ${payroll.year}`,
        },
        // Credit Cash
        {
          accountId: cashAccount.id,
          debit: 0,
          credit: Number(payroll.totalNet),
          description: `Cash Payment - ${monthName} ${payroll.year}`,
        },
      ],
    });

    return this.prisma.payroll.update({
      where: { id },
      data: { status: PayrollStatus.PAID },
    });
  }

  // ─── GET ALL PAYROLLS ────────────────────────────────────
  async findAll() {
    return this.prisma.payroll.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        _count: { select: { lines: true } },
      },
    });
  }

  // ─── GET ONE PAYROLL ─────────────────────────────────────
  async findOne(id: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        lines: {
          include: { employee: true },
          orderBy: { employee: { firstName: 'asc' } },
        },
      },
    });

    if (!payroll) throw new NotFoundException('Payroll not found');
    return payroll;
  }

  // ─── GET EMPLOYEE PAYSLIP ────────────────────────────────
  async getEmployeePayslip(payrollId: string, employeeId: string) {
    const line = await this.prisma.payrollLine.findFirst({
      where: { payrollId, employeeId },
      include: {
        employee: true,
        payroll: true,
      },
    });

    if (!line) throw new NotFoundException('Payslip not found');

    return {
      employee: line.employee,
      period: {
        month: line.payroll.month,
        year: line.payroll.year,
      },
      earnings: {
        basicSalary: Number(line.grossSalary),
        grossSalary: Number(line.grossSalary),
      },
      deductions: {
        paye: Number(line.payeAmount),
        nhif: Number(line.nhifAmount),
        nssf: Number(line.nssfAmount),
        total:
          Number(line.payeAmount) +
          Number(line.nhifAmount) +
          Number(line.nssfAmount),
      },
      netSalary: Number(line.netSalary),
    };
  }

  // ─── PAYROLL SUMMARY ─────────────────────────────────────
  async getSummary(year: number) {
    const payrolls = await this.prisma.payroll.findMany({
      where: { year },
      orderBy: { month: 'asc' },
    });

    const annualGross = payrolls.reduce(
      (sum, p) => sum + Number(p.totalGross),
      0,
    );
    const annualPaye = payrolls.reduce(
      (sum, p) => sum + Number(p.totalPaye),
      0,
    );
    const annualNet = payrolls.reduce((sum, p) => sum + Number(p.totalNet), 0);

    return {
      year,
      monthlyBreakdown: payrolls,
      annualTotals: {
        grossSalaries: annualGross,
        totalPaye: annualPaye,
        netSalaries: annualNet,
      },
    };
  }
}
