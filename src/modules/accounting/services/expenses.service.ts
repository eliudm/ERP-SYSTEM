import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from './posting-engine.service';
import { CreateExpenseDto, ApproveExpenseDto, PayExpenseDto } from '../dto';
import { ExpenseStatus } from '@prisma/client';

// Real Accounts Payable, not vendor-bills.service.ts's mistaken use of
// code '2100' (which is actually seeded as VAT Payable).
const AP_ACCOUNT_CODE = '2000';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private postingEngine: PostingEngineService,
  ) {}

  private async generateNumber(): Promise<string> {
    const count = await this.prisma.expense.count();
    return `EXP-${String(count + 1).padStart(5, '0')}`;
  }

  async create(dto: CreateExpenseDto) {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (account.type !== 'EXPENSE') {
      throw new BadRequestException(
        `Account ${account.code} - ${account.name} is not an expense account`,
      );
    }

    const expenseNo = await this.generateNumber();

    return this.prisma.expense.create({
      data: {
        tenantId: account.tenantId,
        expenseNo,
        date: new Date(dto.date),
        accountId: dto.accountId,
        payee: dto.payee,
        amount: dto.amount,
        description: dto.description,
        notes: dto.notes,
      },
      include: { account: true },
    });
  }

  async findAll(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        include: { account: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { account: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  // ─── APPROVE ──────────────────────────────────────────────
  // Already paid: posts straight to PAID (Debit expense / Credit cash).
  // Payable: posts to APPROVED, owed on Accounts Payable until pay().
  async approve(id: string, dto: ApproveExpenseDto) {
    const expense = await this.findOne(id);
    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT expenses can be approved');
    }

    if (dto.alreadyPaid) {
      if (!dto.cashAccountId) {
        throw new BadRequestException(
          'cashAccountId is required when approving an already-paid expense',
        );
      }
      const cashAccount = await this.prisma.account.findUnique({
        where: { id: dto.cashAccountId },
      });
      if (!cashAccount)
        throw new NotFoundException('Cash/bank account not found');

      await this.postingEngine.postTransaction({
        reference: `EXP-JE-${expense.expenseNo}`,
        description: `Expense ${expense.expenseNo} - ${expense.payee}`,
        entryDate: expense.date.toISOString(),
        sourceType: 'EXPENSE',
        sourceId: expense.id,
        lines: [
          {
            accountId: expense.accountId,
            debit: Number(expense.amount),
            credit: 0,
            description: `${expense.account.name} - ${expense.payee}`,
          },
          {
            accountId: cashAccount.id,
            debit: 0,
            credit: Number(expense.amount),
            description: `Paid - ${expense.payee}`,
          },
        ],
      });

      return this.prisma.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.PAID,
          paidAt: new Date(),
          paymentMethod: dto.paymentMethod,
        },
        include: { account: true },
      });
    }

    const apAccount = await this.prisma.account.findFirst({
      where: { code: AP_ACCOUNT_CODE },
    });
    if (!apAccount) {
      throw new BadRequestException(
        `Required GL account not configured (Accounts Payable: ${AP_ACCOUNT_CODE})`,
      );
    }

    await this.postingEngine.postTransaction({
      reference: `EXP-JE-${expense.expenseNo}`,
      description: `Expense ${expense.expenseNo} - ${expense.payee}`,
      entryDate: expense.date.toISOString(),
      sourceType: 'EXPENSE',
      sourceId: expense.id,
      lines: [
        {
          accountId: expense.accountId,
          debit: Number(expense.amount),
          credit: 0,
          description: `${expense.account.name} - ${expense.payee}`,
        },
        {
          accountId: apAccount.id,
          debit: 0,
          credit: Number(expense.amount),
          description: `Payable - ${expense.payee}`,
        },
      ],
    });

    return this.prisma.expense.update({
      where: { id },
      data: { status: ExpenseStatus.APPROVED },
      include: { account: true },
    });
  }

  // ─── PAY (settles a payable expense) ─────────────────────
  async pay(id: string, dto: PayExpenseDto) {
    const expense = await this.findOne(id);
    if (expense.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException('Only APPROVED expenses can be paid');
    }

    const [apAccount, cashAccount] = await Promise.all([
      this.prisma.account.findFirst({ where: { code: AP_ACCOUNT_CODE } }),
      this.prisma.account.findUnique({ where: { id: dto.cashAccountId } }),
    ]);
    if (!apAccount) {
      throw new BadRequestException(
        `Required GL account not configured (Accounts Payable: ${AP_ACCOUNT_CODE})`,
      );
    }
    if (!cashAccount)
      throw new NotFoundException('Cash/bank account not found');

    await this.postingEngine.postTransaction({
      reference: `EXP-PAY-${expense.expenseNo}`,
      description: `Payment for ${expense.expenseNo} - ${expense.payee}`,
      entryDate: new Date().toISOString(),
      sourceType: 'EXPENSE_PAYMENT',
      sourceId: expense.id,
      lines: [
        {
          accountId: apAccount.id,
          debit: Number(expense.amount),
          credit: 0,
          description: `Clear payable - ${expense.payee}`,
        },
        {
          accountId: cashAccount.id,
          debit: 0,
          credit: Number(expense.amount),
          description: `Paid - ${expense.payee}`,
        },
      ],
    });

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.PAID,
        paidAt: new Date(),
        paymentMethod: dto.paymentMethod,
      },
      include: { account: true },
    });
  }

  async void(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.status === ExpenseStatus.PAID) {
      throw new BadRequestException('Paid expenses cannot be voided');
    }
    return this.prisma.expense.update({
      where: { id },
      data: { status: ExpenseStatus.VOID },
    });
  }
}
