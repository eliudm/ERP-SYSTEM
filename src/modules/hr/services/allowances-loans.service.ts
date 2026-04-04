import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

@Injectable()
export class AllowancesLoansService {
  constructor(private prisma: PrismaService) {}

  // ─── Allowances ─────────────────────────────────────────────────────────────

  async createAllowance(data: {
    employeeId: string;
    type: string;
    amount: number;
    notes?: string;
    isRecurring?: boolean;
    startDate?: string;
    endDate?: string;
  }) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: data.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.allowance.create({
      data: {
        employeeId: data.employeeId,
        type: data.type as any,
        amount: data.amount,
        notes: data.notes,
        isRecurring: data.isRecurring ?? true,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: { employee: true },
    });
  }

  async findAllowances(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.allowance.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
    });
  }

  async updateAllowance(
    id: string,
    data: Partial<{
      amount: number;
      notes: string;
      isRecurring: boolean;
      endDate: string;
      isActive: boolean;
    }>,
  ) {
    return this.prisma.allowance.update({
      where: { id },
      data: {
        ...data,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
  }

  async deactivateAllowance(id: string) {
    return this.prisma.allowance.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findAllAllowances(employeeId?: string) {
    return this.prisma.allowance.findMany({
      where: employeeId ? { employeeId } : undefined,
      include: { employee: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async findAllLoans(employeeId?: string) {
    return this.prisma.loanDeduction.findMany({
      where: employeeId ? { employeeId } : undefined,
      include: { employee: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async getActiveAllowances(employeeId: string) {
    const now = new Date();
    return this.prisma.allowance.findMany({
      where: {
        employeeId,
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    });
  }

  // ─── Loan Deductions ────────────────────────────────────────────────────────
  // Schema: LoanDeduction { totalAmount, monthlyDeduction, balance, startDate, isActive }

  async createLoan(data: {
    employeeId: string;
    totalAmount: number;
    monthlyDeduction: number;
    description?: string;
    startDate?: string;
  }) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: data.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.loanDeduction.create({
      data: {
        employeeId: data.employeeId,
        totalAmount: data.totalAmount,
        balance: data.totalAmount,
        monthlyDeduction: data.monthlyDeduction,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
      },
      include: { employee: true },
    });
  }

  async findLoans(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.loanDeduction.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
    });
  }

  async getActiveLoans(employeeId: string) {
    return this.prisma.loanDeduction.findMany({
      where: { employeeId, isActive: true, balance: { gt: 0 } },
    });
  }

  async recordInstallmentPayment(loanId: string, amount?: number) {
    const loan = await this.prisma.loanDeduction.findUnique({
      where: { id: loanId },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (!loan.isActive)
      throw new BadRequestException('Loan is already settled');

    const installment = amount || Number(loan.monthlyDeduction);
    const actualDeduction = Math.min(installment, Number(loan.balance));
    const newBalance = Number(loan.balance) - actualDeduction;

    return this.prisma.loanDeduction.update({
      where: { id: loanId },
      data: {
        balance: newBalance,
        isActive: newBalance > 0,
      },
    });
  }

  async getLoanSummary(employeeId: string) {
    const loans = await this.findLoans(employeeId);
    return {
      totalLoans: loans.length,
      activeLoans: loans.filter((l) => l.isActive).length,
      totalPrincipal: loans.reduce((s, l) => s + Number(l.totalAmount), 0),
      totalRemaining: loans.reduce((s, l) => s + Number(l.balance), 0),
      monthlyCommitment: loans
        .filter((l) => l.isActive)
        .reduce((s, l) => s + Number(l.monthlyDeduction), 0),
    };
  }
}
