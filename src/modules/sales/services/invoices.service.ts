import {
	Injectable,
	NotFoundException,
	BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateInvoiceDto } from '../dto';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class InvoicesService {
	constructor(
		private prisma: PrismaService,
		private postingEngine: PostingEngineService,
	) {}

	// ─── GENERATE INVOICE NUMBER ─────────────────────────────
	private async generateInvoiceNo(): Promise<string> {
		const count = await this.prisma.salesInvoice.count();
		const padded = String(count + 1).padStart(5, '0');
		return `INV-${padded}`;
	}

	// ─── CREATE INVOICE (DRAFT) ──────────────────────────────
	async create(dto: CreateInvoiceDto) {
		// Validate customer exists
		const customer = await this.prisma.customer.findUnique({
			where: { id: dto.customerId },
		});
		if (!customer) throw new NotFoundException('Customer not found');

		// Validate all products exist & calculate totals
		let subtotal = 0;
		let taxAmount = 0;

		const itemsData: any[] = [];

		for (const item of dto.items) {
			const product = await this.prisma.product.findUnique({
				where: { id: item.productId },
			});
			if (!product) {
				throw new NotFoundException(
					`Product with ID ${item.productId} not found`,
				);
			}

			const lineTotal = item.quantity * item.unitPrice;
			const lineTax = lineTotal * item.taxRate;

			subtotal += lineTotal;
			taxAmount += lineTax;

			itemsData.push({
				productId: item.productId,
				description: item.description || product.name,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				taxRate: item.taxRate,
				taxAmount: lineTax,
				lineTotal: lineTotal + lineTax,
			});
		}

		const total = subtotal + taxAmount;
		const invoiceNo = await this.generateInvoiceNo();

		// Create invoice in database
		const invoice = await this.prisma.salesInvoice.create({
			data: {
				invoiceNo,
				customerId: dto.customerId,
				invoiceDate: new Date(dto.invoiceDate),
				dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
				status: InvoiceStatus.DRAFT,
				subtotal,
				taxAmount,
				total,
				notes: dto.notes,
				items: { create: itemsData },
			},
			include: {
				customer: true,
				items: { include: { product: true } },
			},
		});

		return invoice;
	}

	// ─── APPROVE & POST INVOICE ──────────────────────────────
	async approve(id: string) {
		const invoice = await this.prisma.salesInvoice.findUnique({
			where: { id },
			include: {
				customer: true,
				items: { include: { product: true } },
			},
		});

		if (!invoice) throw new NotFoundException('Invoice not found');

		if (invoice.status !== InvoiceStatus.DRAFT) {
			throw new BadRequestException(
				`Invoice is already ${invoice.status}. Only DRAFT invoices can be approved.`,
			);
		}

		// Get required accounts
		const [arAccount, revenueAccount, vatAccount] = await Promise.all([
			this.prisma.account.findFirst({ where: { code: '1100' } }), // Accounts Receivable
			this.prisma.account.findFirst({ where: { code: '4000' } }), // Sales Revenue
			this.prisma.account.findFirst({ where: { code: '2100' } }), // VAT Payable
		]);

		if (!arAccount || !revenueAccount || !vatAccount) {
			throw new BadRequestException(
				'Required accounts not found. Please seed chart of accounts first.',
			);
		}

		// Post accounting journal entry automatically
		await this.postingEngine.postTransaction({
			reference: `SALE-${invoice.invoiceNo}`,
			description: `Sales Invoice ${invoice.invoiceNo} - ${invoice.customer.name}`,
			entryDate: invoice.invoiceDate.toISOString(),
			sourceType: 'SALES_INVOICE',
			sourceId: invoice.id,
			lines: [
				// Debit Accounts Receivable (full amount)
				{
					accountId: arAccount.id,
					debit: Number(invoice.total),
					credit: 0,
					description: `AR - ${invoice.invoiceNo}`,
				},
				// Credit Sales Revenue (subtotal)
				{
					accountId: revenueAccount.id,
					debit: 0,
					credit: Number(invoice.subtotal),
					description: `Revenue - ${invoice.invoiceNo}`,
				},
				// Credit VAT Payable (tax amount)
				{
					accountId: vatAccount.id,
					debit: 0,
					credit: Number(invoice.taxAmount),
					description: `VAT - ${invoice.invoiceNo}`,
				},
			],
		});

		// Update invoice status to APPROVED
		return this.prisma.salesInvoice.update({
			where: { id },
			data: { status: InvoiceStatus.APPROVED },
			include: {
				customer: true,
				items: { include: { product: true } },
			},
		});
	}

	// ─── MARK AS PAID ────────────────────────────────────────
	async markAsPaid(id: string) {
		const invoice = await this.prisma.salesInvoice.findUnique({
			where: { id },
			include: { customer: true },
		});

		if (!invoice) throw new NotFoundException('Invoice not found');

		if (invoice.status !== InvoiceStatus.APPROVED) {
			throw new BadRequestException(
				'Only APPROVED invoices can be marked as paid',
			);
		}

		// Get accounts
		const [cashAccount, arAccount] = await Promise.all([
			this.prisma.account.findFirst({ where: { code: '1000' } }), // Cash
			this.prisma.account.findFirst({ where: { code: '1100' } }), // AR
		]);

		if (!cashAccount || !arAccount) {
			throw new BadRequestException('Required accounts not found');
		}

		// Post payment journal entry
		await this.postingEngine.postTransaction({
			reference: `PMT-${invoice.invoiceNo}`,
			description: `Payment received - ${invoice.invoiceNo} - ${invoice.customer.name}`,
			entryDate: new Date().toISOString(),
			sourceType: 'PAYMENT',
			sourceId: invoice.id,
			lines: [
				// Debit Cash
				{
					accountId: cashAccount.id,
					debit: Number(invoice.total),
					credit: 0,
					description: `Payment - ${invoice.invoiceNo}`,
				},
				// Credit Accounts Receivable
				{
					accountId: arAccount.id,
					debit: 0,
					credit: Number(invoice.total),
					description: `Clear AR - ${invoice.invoiceNo}`,
				},
			],
		});

		// Update status to PAID
		return this.prisma.salesInvoice.update({
			where: { id },
			data: { status: InvoiceStatus.PAID },
			include: { customer: true },
		});
	}

	// ─── VOID INVOICE ────────────────────────────────────────
	async void(id: string, reason: string) {
		const invoice = await this.prisma.salesInvoice.findUnique({
			where: { id },
		});

		if (!invoice) throw new NotFoundException('Invoice not found');

		if (invoice.status === InvoiceStatus.VOID) {
			throw new BadRequestException('Invoice is already voided');
		}

		if (invoice.status === InvoiceStatus.PAID) {
			throw new BadRequestException('Cannot void a paid invoice');
		}

		// Find and void the related journal entry
		const journalEntry = await this.prisma.journalEntry.findFirst({
			where: { sourceType: 'SALES_INVOICE', sourceId: id },
		});

		if (journalEntry) {
			await this.postingEngine.voidTransaction(journalEntry.id, reason);
		}

		return this.prisma.salesInvoice.update({
			where: { id },
			data: { status: InvoiceStatus.VOID },
		});
	}

	// ─── GET ALL INVOICES ────────────────────────────────────
	async findAll(page = 1, limit = 20, status?: string) {
		const skip = (page - 1) * limit;

		const [invoices, total] = await Promise.all([
			this.prisma.salesInvoice.findMany({
				skip,
				take: limit,
				where: status ? { status: status as any } : {},
				include: {
					customer: true,
					items: { include: { product: true } },
				},
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.salesInvoice.count({
				where: status ? { status: status as any } : {},
			}),
		]);

		return {
			data: invoices,
			meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
		};
	}

	// ─── GET ONE INVOICE ─────────────────────────────────────
	async findOne(id: string) {
		const invoice = await this.prisma.salesInvoice.findUnique({
			where: { id },
			include: {
				customer: true,
				items: { include: { product: true } },
				etimsInvoice: true,
			},
		});

		if (!invoice) throw new NotFoundException('Invoice not found');
		return invoice;
	}

	// ─── GET SALES SUMMARY ───────────────────────────────────
	async getSalesSummary(startDate: string, endDate: string) {
		const invoices = await this.prisma.salesInvoice.findMany({
			where: {
				status: { not: InvoiceStatus.VOID },
				invoiceDate: {
					gte: new Date(startDate),
					lte: new Date(endDate),
				},
			},
		});

		const totalRevenue = invoices.reduce(
			(sum, inv) => sum + Number(inv.subtotal), 0,
		);
		const totalTax = invoices.reduce(
			(sum, inv) => sum + Number(inv.taxAmount), 0,
		);
		const totalBilled = invoices.reduce(
			(sum, inv) => sum + Number(inv.total), 0,
		);
		const totalPaid = invoices
			.filter((inv) => inv.status === InvoiceStatus.PAID)
			.reduce((sum, inv) => sum + Number(inv.total), 0);

		return {
			period: { startDate, endDate },
			totalInvoices: invoices.length,
			totalRevenue,
			totalTax,
			totalBilled,
			totalPaid,
			outstanding: totalBilled - totalPaid,
		};
	}
}
