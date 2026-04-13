import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BudgetStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import {
  CreateBudgetDto,
  CreateBudgetLineDto,
  SetBudgetStatusDto,
  UpdateBudgetDto,
} from './budget.dto';

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE ───────────────────────────────────────────────
  async create(dto: CreateBudgetDto, createdById?: string) {
    const existing = await this.prisma.budget.findFirst({
      where: { fiscalYear: dto.fiscalYear, name: dto.name },
    });
    if (existing)
      throw new ConflictException(
        'Budget with this name and year already exists',
      );

    return this.prisma.budget.create({
      data: {
        name: dto.name,
        fiscalYear: dto.fiscalYear,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        notes: dto.notes,
        createdById: createdById ?? null,
        lines: dto.lines?.length
          ? { create: dto.lines.map((l) => this.mapLine(l)) }
          : undefined,
      },
      include: { lines: { include: { account: true } } },
    });
  }

  // ─── LIST ─────────────────────────────────────────────────
  async findAll(fiscalYear?: number, status?: BudgetStatus) {
    return this.prisma.budget.findMany({
      where: {
        ...(fiscalYear && { fiscalYear }),
        ...(status && { status }),
      },
      orderBy: [{ fiscalYear: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { lines: true } } },
    });
  }

  // ─── GET ONE ──────────────────────────────────────────────
  async findOne(id: string) {
    const budget = await this.prisma.budget.findUnique({
      where: { id },
      include: {
        lines: { include: { account: true }, orderBy: [{ month: 'asc' }] },
      },
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  // ─── UPDATE ───────────────────────────────────────────────
  async update(id: string, dto: UpdateBudgetDto) {
    const budget = await this.findOne(id);
    if (budget.status !== BudgetStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT budgets can be edited');
    }
    return this.prisma.budget.update({
      where: { id },
      data: {
        name: dto.name,
        fiscalYear: dto.fiscalYear,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  // ─── SET STATUS ───────────────────────────────────────────
  async setStatus(id: string, dto: SetBudgetStatusDto) {
    await this.findOne(id);
    return this.prisma.budget.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  // ─── ADD LINES ────────────────────────────────────────────
  async addLines(id: string, lines: CreateBudgetLineDto[]) {
    const budget = await this.findOne(id);
    if (budget.status !== BudgetStatus.DRAFT) {
      throw new BadRequestException(
        'Budget lines can only be added to DRAFT budgets',
      );
    }
    const created = await this.prisma.$transaction(
      lines.map((l) =>
        this.prisma.budgetLine.upsert({
          where: {
            budgetId_accountId_month: {
              budgetId: id,
              accountId: l.accountId,
              month: l.month,
            },
          },
          update: { amount: l.amount, notes: l.notes },
          create: { budgetId: id, ...this.mapLine(l) },
        }),
      ),
    );
    return { upserted: created.length };
  }

  // ─── DELETE LINE ──────────────────────────────────────────
  async deleteLine(budgetId: string, lineId: string) {
    const budget = await this.findOne(budgetId);
    if (budget.status !== BudgetStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT budget lines can be deleted');
    }
    await this.prisma.budgetLine.delete({ where: { id: lineId } });
    return { deleted: true };
  }

  // ─── BUDGET VS ACTUAL ─────────────────────────────────────
  async getBudgetVsActual(id: string) {
    const budget = await this.findOne(id);

    const start = budget.startDate;
    const end = budget.endDate;

    // Fetch actual GL totals per account within the budget period (posted only)
    const glLines = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          status: 'POSTED',
          entryDate: { gte: start, lte: end },
        },
        accountId: { in: budget.lines.map((l) => l.accountId) },
      },
      _sum: { debit: true, credit: true },
    });

    const actualMap = new Map(
      glLines.map((g) => [
        g.accountId,
        Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0),
      ]),
    );

    // Aggregate budget lines per account
    type AccountSummary = {
      accountId: string;
      accountCode: string;
      accountName: string;
      accountType: string;
      budgeted: number;
      actual: number;
      variance: number;
      variancePct: number;
    };

    const accountMap = new Map<string, AccountSummary>();

    for (const line of budget.lines) {
      const existing = accountMap.get(line.accountId);
      if (existing) {
        existing.budgeted += Number(line.amount);
      } else {
        accountMap.set(line.accountId, {
          accountId: line.accountId,
          accountCode: line.account.code,
          accountName: line.account.name,
          accountType: line.account.type,
          budgeted: Number(line.amount),
          actual: Math.abs(actualMap.get(line.accountId) ?? 0),
          variance: 0,
          variancePct: 0,
        });
      }
    }

    const rows = Array.from(accountMap.values()).map((row) => {
      row.variance = row.budgeted - row.actual;
      row.variancePct =
        row.budgeted !== 0 ? (row.variance / row.budgeted) * 100 : 0;
      return row;
    });

    const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual, 0);

    return {
      budget: {
        id: budget.id,
        name: budget.name,
        fiscalYear: budget.fiscalYear,
      },
      period: { startDate: start, endDate: end },
      rows,
      summary: {
        totalBudgeted,
        totalActual,
        totalVariance: totalBudgeted - totalActual,
        utilizationPct:
          totalBudgeted !== 0 ? (totalActual / totalBudgeted) * 100 : 0,
      },
    };
  }

  private mapLine(l: CreateBudgetLineDto) {
    return {
      accountId: l.accountId,
      month: l.month,
      amount: l.amount,
      notes: l.notes,
    };
  }
}
