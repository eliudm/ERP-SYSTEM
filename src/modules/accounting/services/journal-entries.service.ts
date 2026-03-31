import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from './posting-engine.service';
import { CreateJournalEntryDto, CreatePeriodDto } from '../dto';

@Injectable()
export class JournalEntriesService {
	constructor(
		private prisma: PrismaService,
		private postingEngine: PostingEngineService,
	) {}

	// ─── CREATE & POST JOURNAL ENTRY ─────────────────────────
	async create(dto: CreateJournalEntryDto) {
		return this.postingEngine.postTransaction(dto);
	}

	// ─── GET ALL JOURNAL ENTRIES ─────────────────────────────
	async findAll(page = 1, limit = 20) {
		const skip = (page - 1) * limit;

		const [entries, total] = await Promise.all([
			this.prisma.journalEntry.findMany({
				skip,
				take: limit,
				include: {
					lines: { include: { account: true } },
				},
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.journalEntry.count(),
		]);

		return {
			data: entries,
			meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
		};
	}

	// ─── GET ONE JOURNAL ENTRY ───────────────────────────────
	async findOne(id: string) {
		const entry = await this.prisma.journalEntry.findUnique({
			where: { id },
			include: { lines: { include: { account: true } } },
		});

		if (!entry) throw new NotFoundException('Journal entry not found');
		return entry;
	}

	// ─── VOID JOURNAL ENTRY ──────────────────────────────────
	async void(id: string, reason: string) {
		return this.postingEngine.voidTransaction(id, reason);
	}

	// ─── GET TRIAL BALANCE ───────────────────────────────────
	async getTrialBalance() {
		const accounts = await this.prisma.account.findMany({
			where: { isActive: true },
			include: {
				journalLines: {
					where: { journalEntry: { status: 'POSTED' } },
				},
			},
			orderBy: { code: 'asc' },
		});

		const trialBalance = accounts
			.map((account) => {
				const totalDebit = account.journalLines.reduce(
					(sum, line) => sum + Number(line.debit),
					0,
				);
				const totalCredit = account.journalLines.reduce(
					(sum, line) => sum + Number(line.credit),
					0,
				);

				return {
					code: account.code,
					name: account.name,
					type: account.type,
					totalDebit,
					totalCredit,
					balance: totalDebit - totalCredit,
				};
			})
			.filter((a) => a.totalDebit !== 0 || a.totalCredit !== 0);

		const grandTotalDebit = trialBalance.reduce((sum, a) => sum + a.totalDebit, 0);
		const grandTotalCredit = trialBalance.reduce((sum, a) => sum + a.totalCredit, 0);

		return {
			accounts: trialBalance,
			totals: {
				totalDebit: grandTotalDebit,
				totalCredit: grandTotalCredit,
				isBalanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.001,
			},
		};
	}

	// ─── GET P&L ─────────────────────────────────────────────
	async getProfitAndLoss(startDate: string, endDate: string) {
		const start = new Date(startDate);
		const end = new Date(endDate);

		const lines = await this.prisma.journalLine.findMany({
			where: {
				journalEntry: {
					status: 'POSTED',
					entryDate: { gte: start, lte: end },
				},
				account: {
					type: { in: ['REVENUE', 'EXPENSE'] },
				},
			},
			include: { account: true },
		});

		// Group by account
		const accountMap = new Map<string, any>();
		for (const line of lines) {
			const key = line.accountId;
			if (!accountMap.has(key)) {
				accountMap.set(key, {
					code: line.account.code,
					name: line.account.name,
					type: line.account.type,
					totalDebit: 0,
					totalCredit: 0,
				});
			}
			const entry = accountMap.get(key);
			entry.totalDebit += Number(line.debit);
			entry.totalCredit += Number(line.credit);
		}

		const accounts = Array.from(accountMap.values()).map((a) => ({
			...a,
			balance:
				a.type === 'REVENUE'
					? a.totalCredit - a.totalDebit
					: a.totalDebit - a.totalCredit,
		}));

		const revenue = accounts.filter((a) => a.type === 'REVENUE');
		const expenses = accounts.filter((a) => a.type === 'EXPENSE');

		const totalRevenue = revenue.reduce((s, a) => s + a.balance, 0);
		const totalExpenses = expenses.reduce((s, a) => s + a.balance, 0);
		const pbt = totalRevenue - totalExpenses;

		return {
			period: { startDate, endDate },
			revenue: { accounts: revenue, total: totalRevenue },
			expenses: { accounts: expenses, total: totalExpenses },
			profitBeforeTax: pbt,
		};
	}

	// ─── ACCOUNTING PERIODS ──────────────────────────────────
	async createPeriod(dto: CreatePeriodDto) {
		return this.prisma.accountingPeriod.create({ data: dto as any });
	}

	async lockPeriod(id: string) {
		const period = await this.prisma.accountingPeriod.findUnique({
			where: { id },
		});
		if (!period) throw new NotFoundException('Period not found');

		return this.prisma.accountingPeriod.update({
			where: { id },
			data: { isLocked: true },
		});
	}

	async getPeriods() {
		return this.prisma.accountingPeriod.findMany({
			orderBy: { startDate: 'desc' },
		});
	}
}
