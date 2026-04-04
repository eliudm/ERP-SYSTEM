import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

export class CreateBankAccountDto {
  name: string;
  accountNumber: string;
  bankName: string;
  currency?: string;
  glAccountId?: string;
}

export class CreateBankStatementDto {
  statementDate: string;
  openingBalance: number;
  closingBalance: number;
}

export class CreateBankStatementLineDto {
  transactionDate: string;
  description: string;
  debit?: number;
  credit?: number;
}

@Injectable()
export class BankReconciliationService {
  constructor(private prisma: PrismaService) {}

  // ─── BANK ACCOUNTS ───────────────────────────────────────
  async createBankAccount(dto: CreateBankAccountDto) {
    return this.prisma.bankAccount.create({
      data: { ...dto, currency: dto.currency || 'KES' },
    });
  }

  async findAllBankAccounts() {
    return this.prisma.bankAccount.findMany({
      where: { isActive: true },
      include: { glAccount: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOneBankAccount(id: string) {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id },
      include: {
        glAccount: true,
        statements: { orderBy: { statementDate: 'desc' }, take: 10 },
      },
    });
    if (!account) throw new NotFoundException('Bank account not found');
    return account;
  }

  async deactivateBankAccount(id: string) {
    return this.prisma.bankAccount.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── STATEMENTS ──────────────────────────────────────────
  async createStatement(bankAccountId: string, dto: CreateBankStatementDto) {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    });
    if (!account) throw new NotFoundException('Bank account not found');

    return this.prisma.bankStatement.create({
      data: {
        bankAccountId,
        statementDate: new Date(dto.statementDate),
        openingBalance: dto.openingBalance,
        closingBalance: dto.closingBalance,
      },
    });
  }

  async findStatements(bankAccountId: string) {
    return this.prisma.bankStatement.findMany({
      where: { bankAccountId },
      include: { _count: { select: { lines: true } } },
      orderBy: { statementDate: 'desc' },
    });
  }

  async findOneStatement(statementId: string) {
    const stmt = await this.prisma.bankStatement.findUnique({
      where: { id: statementId },
      include: {
        lines: { orderBy: { transactionDate: 'asc' } },
        bankAccount: true,
      },
    });
    if (!stmt) throw new NotFoundException('Statement not found');
    return stmt;
  }

  // ─── STATEMENT LINES ─────────────────────────────────────
  async addStatementLine(statementId: string, dto: CreateBankStatementLineDto) {
    const stmt = await this.prisma.bankStatement.findUnique({
      where: { id: statementId },
    });
    if (!stmt) throw new NotFoundException('Statement not found');
    if (stmt.status === 'RECONCILED')
      throw new BadRequestException('Statement is already reconciled');

    return this.prisma.bankStatementLine.create({
      data: {
        statementId,
        transactionDate: new Date(dto.transactionDate),
        description: dto.description,
        debit: dto.debit || 0,
        credit: dto.credit || 0,
      },
    });
  }

  async importStatementLines(
    statementId: string,
    lines: CreateBankStatementLineDto[],
  ) {
    const stmt = await this.prisma.bankStatement.findUnique({
      where: { id: statementId },
    });
    if (!stmt) throw new NotFoundException('Statement not found');

    const created = await this.prisma.$transaction(
      lines.map((l) =>
        this.prisma.bankStatementLine.create({
          data: {
            statementId,
            transactionDate: new Date(l.transactionDate),
            description: l.description,
            debit: l.debit || 0,
            credit: l.credit || 0,
          },
        }),
      ),
    );
    return { imported: created.length };
  }

  // ─── AUTO-MATCH ───────────────────────────────────────────
  async autoMatch(statementId: string) {
    const stmt = await this.prisma.bankStatement.findUnique({
      where: { id: statementId },
      include: { lines: { where: { isMatched: false } } },
    });
    if (!stmt) throw new NotFoundException('Statement not found');

    let matchedCount = 0;

    for (const line of stmt.lines) {
      const amount = Number(line.debit) - Number(line.credit);
      // Find journal lines with matching net amount within 1-day window
      const dateFrom = new Date(line.transactionDate);
      dateFrom.setDate(dateFrom.getDate() - 1);
      const dateTo = new Date(line.transactionDate);
      dateTo.setDate(dateTo.getDate() + 1);

      const journalLine = await this.prisma.journalLine.findFirst({
        where: {
          bankStatementLines: { none: {} },
          journalEntry: {
            status: 'POSTED',
            entryDate: { gte: dateFrom, lte: dateTo },
          },
          ...(amount > 0
            ? { debit: { gte: amount - 0.01, lte: amount + 0.01 } }
            : {
                credit: {
                  gte: Math.abs(amount) - 0.01,
                  lte: Math.abs(amount) + 0.01,
                },
              }),
        },
      });

      if (journalLine) {
        await this.prisma.bankStatementLine.update({
          where: { id: line.id },
          data: { matchedJournalLineId: journalLine.id, isMatched: true },
        });
        matchedCount++;
      }
    }

    return { matched: matchedCount, total: stmt.lines.length };
  }

  // ─── MANUAL MATCH ─────────────────────────────────────────
  async manualMatch(lineId: string, journalLineId: string) {
    const line = await this.prisma.bankStatementLine.findUnique({
      where: { id: lineId },
    });
    if (!line) throw new NotFoundException('Statement line not found');

    const jLine = await this.prisma.journalLine.findUnique({
      where: { id: journalLineId },
    });
    if (!jLine) throw new NotFoundException('Journal line not found');

    return this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { matchedJournalLineId: journalLineId, isMatched: true },
    });
  }

  // ─── FINALIZE STATEMENT ──────────────────────────────────
  async finalizeStatement(statementId: string) {
    const stmt = await this.prisma.bankStatement.findUnique({
      where: { id: statementId },
      include: { lines: true },
    });
    if (!stmt) throw new NotFoundException('Statement not found');

    const unmatched = stmt.lines.filter((l) => !l.isMatched).length;
    if (unmatched > 0) {
      throw new BadRequestException(
        `${unmatched} lines are still unmatched. Reconcile all lines first.`,
      );
    }

    return this.prisma.bankStatement.update({
      where: { id: statementId },
      data: { status: 'RECONCILED' },
    });
  }
}
