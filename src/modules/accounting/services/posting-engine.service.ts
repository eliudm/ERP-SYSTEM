import {
	Injectable,
	BadRequestException,
	NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateJournalEntryDto } from '../dto';
import { JournalStatus } from '@prisma/client';

@Injectable()
export class PostingEngineService {
	constructor(private prisma: PrismaService) {}

	// ─── VALIDATE JOURNAL BALANCE ────────────────────────────
	validateBalance(lines: { debit: number; credit: number }[]): void {
		const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
		const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);

		const diff = Math.abs(totalDebit - totalCredit);

		if (diff > 0.001) {
			throw new BadRequestException(
				`Journal is not balanced. ` +
					`Total Debit: ${totalDebit.toFixed(2)}, ` +
					`Total Credit: ${totalCredit.toFixed(2)}`,
			);
		}
	}

	// ─── VALIDATE ACCOUNTS EXIST ────────────────────────────
	async validateAccounts(lines: { accountId: string }[]): Promise<void> {
		for (const line of lines) {
			const account = await this.prisma.account.findUnique({
				where: { id: line.accountId },
			});
			if (!account) {
				throw new NotFoundException(
					`Account with ID ${line.accountId} not found`,
				);
			}
			if (!account.isActive) {
				throw new BadRequestException(
					`Account ${account.code} - ${account.name} is inactive`,
				);
			}
		}
	}

	// ─── CHECK PERIOD LOCK ───────────────────────────────────
	async checkPeriodLock(entryDate: Date): Promise<void> {
		const lockedPeriod = await this.prisma.accountingPeriod.findFirst({
			where: {
				isLocked: true,
				startDate: { lte: entryDate },
				endDate: { gte: entryDate },
			},
		});

		if (lockedPeriod) {
			throw new BadRequestException(
				`Accounting period "${lockedPeriod.name}" is locked. ` +
					`Cannot post entries for this date.`,
			);
		}
	}

	// ─── POST TRANSACTION ────────────────────────────────────
	async postTransaction(dto: CreateJournalEntryDto) {
		const entryDate = new Date(dto.entryDate);

		// Step 1: Validate balance
		this.validateBalance(dto.lines);

		// Step 2: Validate all accounts exist
		await this.validateAccounts(dto.lines);

		// Step 3: Check period is not locked
		await this.checkPeriodLock(entryDate);

		// Step 4: Check reference is unique
		const existing = await this.prisma.journalEntry.findUnique({
			where: { reference: dto.reference },
		});
		if (existing) {
			throw new BadRequestException(
				`Journal entry with reference "${dto.reference}" already exists`,
			);
		}

		// Step 5: Save journal entry + lines in one transaction
		const journalEntry = await this.prisma.$transaction(async (tx) => {
			const entry = await tx.journalEntry.create({
				data: {
					reference: dto.reference,
					description: dto.description,
					entryDate,
					status: JournalStatus.POSTED,
					sourceType: dto.sourceType,
					sourceId: dto.sourceId,
					lines: {
						create: dto.lines.map((line) => ({
							accountId: line.accountId,
							debit: line.debit,
							credit: line.credit,
							description: line.description,
						})),
					},
				},
				include: { lines: { include: { account: true } } },
			});

			return entry;
		});

		return journalEntry;
	}

	// ─── VOID TRANSACTION ────────────────────────────────────
	async voidTransaction(journalEntryId: string, reason: string) {
		const entry = await this.prisma.journalEntry.findUnique({
			where: { id: journalEntryId },
			include: { lines: true },
		});

		if (!entry) throw new NotFoundException('Journal entry not found');

		if (entry.status === JournalStatus.VOID) {
			throw new BadRequestException('Journal entry is already voided');
		}

		// Check period not locked
		await this.checkPeriodLock(entry.entryDate);

		// Create reversing entry
		const reversingEntry = await this.prisma.$transaction(async (tx) => {
			// Mark original as void
			await tx.journalEntry.update({
				where: { id: journalEntryId },
				data: { status: JournalStatus.VOID },
			});

			// Create reversing journal entry
			const reversing = await tx.journalEntry.create({
				data: {
					reference: `VOID-${entry.reference}`,
					description: `Reversal of ${entry.reference}. Reason: ${reason}`,
					entryDate: new Date(),
					status: JournalStatus.POSTED,
					sourceType: 'VOID',
					sourceId: journalEntryId,
					lines: {
						create: entry.lines.map((line) => ({
							accountId: line.accountId,
							// Swap debit and credit for reversal
							debit: line.credit,
							credit: line.debit,
							description: `Reversal: ${line.description || ''}`,
						})),
					},
				},
				include: { lines: { include: { account: true } } },
			});

			return reversing;
		});

		return reversingEntry;
	}
}
