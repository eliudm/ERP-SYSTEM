import {
	Injectable,
	ConflictException,
	NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateAccountDto } from '../dto';

@Injectable()
export class AccountsService {
	constructor(private prisma: PrismaService) {}

	// ─── CREATE ACCOUNT ──────────────────────────────────────
	async create(dto: CreateAccountDto) {
		const existing = await this.prisma.account.findUnique({
			where: { code: dto.code },
		});

		if (existing) {
			throw new ConflictException(
				`Account with code "${dto.code}" already exists`,
			);
		}

		return this.prisma.account.create({
			data: dto,
			include: { parent: true },
		});
	}

	// ─── GET ALL ACCOUNTS ────────────────────────────────────
	async findAll() {
		return this.prisma.account.findMany({
			where: { isActive: true },
			include: { parent: true },
			orderBy: { code: 'asc' },
		});
	}

	// ─── GET ACCOUNTS BY TYPE ────────────────────────────────
	async findByType(type: string) {
		return this.prisma.account.findMany({
			where: { type: type as any, isActive: true },
			orderBy: { code: 'asc' },
		});
	}

	// ─── GET ONE ACCOUNT ─────────────────────────────────────
	async findOne(id: string) {
		const account = await this.prisma.account.findUnique({
			where: { id },
			include: {
				parent: true,
				children: true,
				journalLines: {
					include: { journalEntry: true },
					orderBy: { createdAt: 'desc' },
					take: 10,
				},
			},
		});

		if (!account) throw new NotFoundException('Account not found');
		return account;
	}

	// ─── GET ACCOUNT BALANCE ─────────────────────────────────
	async getBalance(id: string) {
		const account = await this.prisma.account.findUnique({
			where: { id },
		});

		if (!account) throw new NotFoundException('Account not found');

		const result = await this.prisma.journalLine.aggregate({
			where: {
				accountId: id,
				journalEntry: { status: 'POSTED' },
			},
			_sum: { debit: true, credit: true },
		});

		const totalDebit = Number(result._sum.debit || 0);
		const totalCredit = Number(result._sum.credit || 0);

		// Balance logic based on account type
		let balance: number;
		if (['ASSET', 'EXPENSE'].includes(account.type)) {
			balance = totalDebit - totalCredit; // Debit normal
		} else {
			balance = totalCredit - totalDebit; // Credit normal
		}

		return {
			account,
			totalDebit,
			totalCredit,
			balance,
		};
	}

	// ─── DEACTIVATE ACCOUNT ──────────────────────────────────
	async deactivate(id: string) {
		const account = await this.prisma.account.findUnique({ where: { id } });
		if (!account) throw new NotFoundException('Account not found');

		return this.prisma.account.update({
			where: { id },
			data: { isActive: false },
		});
	}

	// ─── SEED DEFAULT CHART OF ACCOUNTS ─────────────────────
	async seedChartOfAccounts() {
		const accounts = [
			// ASSETS
			{ code: '1000', name: 'Cash and Cash Equivalents', type: 'ASSET' },
			{ code: '1100', name: 'Accounts Receivable', type: 'ASSET' },
			{ code: '1200', name: 'Inventory', type: 'ASSET' },
			{ code: '1300', name: 'Prepaid Expenses', type: 'ASSET' },
			{ code: '1500', name: 'Property Plant & Equipment', type: 'ASSET' },
			// LIABILITIES
			{ code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
			{ code: '2100', name: 'VAT Payable', type: 'LIABILITY' },
			{ code: '2200', name: 'Income Tax Payable', type: 'LIABILITY' },
			{ code: '2300', name: 'Accrued Expenses', type: 'LIABILITY' },
			// EQUITY
			{ code: '3000', name: 'Share Capital', type: 'EQUITY' },
			{ code: '3100', name: 'Retained Earnings', type: 'EQUITY' },
			// REVENUE
			{ code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
			{ code: '4100', name: 'Other Income', type: 'REVENUE' },
			// EXPENSES
			{ code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
			{ code: '5100', name: 'Salaries & Wages', type: 'EXPENSE' },
			{ code: '5200', name: 'Rent Expense', type: 'EXPENSE' },
			{ code: '5300', name: 'Utilities Expense', type: 'EXPENSE' },
			{ code: '5400', name: 'Tax Expense', type: 'EXPENSE' },
			{ code: '5500', name: 'General & Administrative', type: 'EXPENSE' },
		];

		const created: unknown[] = [];
		for (const account of accounts) {
			const exists = await this.prisma.account.findUnique({
				where: { code: account.code },
			});
			if (!exists) {
				const created_account = await this.prisma.account.create({
					data: account as any,
				});
				created.push(created_account);
			}
		}

		return {
			message: `Seeded ${created.length} accounts successfully`,
			accounts: created,
		};
	}
}
