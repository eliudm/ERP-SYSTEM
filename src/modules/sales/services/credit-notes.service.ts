import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateCreditNoteDto } from '../dto/create-credit-note.dto';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { AccountsService } from '../../accounting/services/accounts.service';

@Injectable()
export class CreditNotesService {
  constructor(
    private prisma: PrismaService,
    private postingEngine: PostingEngineService,
    private accountsService: AccountsService,
  ) {}

  private async generateNumber(): Promise<string> {
    const count = await this.prisma.creditNote.count();
    return `CN-${String(count + 1).padStart(5, '0')}`;
  }

  // ─── CREATE ──────────────────────────────────────────────
  async create(dto: CreateCreditNoteDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (dto.invoiceId) {
      const inv = await this.prisma.salesInvoice.findUnique({
        where: { id: dto.invoiceId },
      });
      if (!inv) throw new NotFoundException('Invoice not found');
    }

    const items = dto.items.map((item) => {
      const lineSubtotal = item.unitPrice * item.quantity;
      const taxAmount = lineSubtotal * item.taxRate;
      return { ...item, taxAmount, lineTotal: lineSubtotal + taxAmount };
    });

    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const taxAmount = items.reduce((s, i) => s + i.taxAmount, 0);
    const total = subtotal + taxAmount;
    const creditNoteNumber = await this.generateNumber();

    return this.prisma.creditNote.create({
      data: {
        creditNoteNumber,
        customerId: dto.customerId,
        invoiceId: dto.invoiceId,
        reason: dto.reason,
        subtotal,
        taxAmount,
        total,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
            taxAmount: i.taxAmount,
            lineTotal: i.lineTotal,
          })),
        },
      },
      include: { customer: true, items: { include: { product: true } } },
    });
  }

  // ─── LIST ────────────────────────────────────────────────
  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.creditNote.findMany({
        skip,
        take: limit,
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.creditNote.count(),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── GET ONE ─────────────────────────────────────────────
  async findOne(id: string) {
    const cn = await this.prisma.creditNote.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        invoice: true,
      },
    });
    if (!cn) throw new NotFoundException('Credit note not found');
    return cn;
  }

  // ─── APPROVE (creates reverse journal entry + restores stock) ───
  async approve(id: string) {
    const cn = await this.findOne(id);
    if (cn.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT credit notes can be approved');

    // Get chart of accounts
    const arAccount = await this.prisma.account.findFirst({
      where: { code: '1200' },
    });
    const revenueAccount = await this.prisma.account.findFirst({
      where: { code: '4000' },
    });
    const taxAccount = await this.prisma.account.findFirst({
      where: { code: '2200' },
    });

    if (!arAccount || !revenueAccount || !taxAccount) {
      throw new BadRequestException(
        'Required GL accounts not configured (AR: 1200, Revenue: 4000, Tax: 2200)',
      );
    }

    // Reverse journal: Credit AR, Debit Revenue, Debit Tax (VAT adjustments)
    const entryDate = new Date();
    await this.postingEngine.postTransaction({
      reference: `CN-JE-${cn.creditNoteNumber}`,
      description: `Credit Note ${cn.creditNoteNumber} - ${cn.reason || 'Return'}`,
      entryDate: entryDate.toISOString(),
      sourceType: 'CREDIT_NOTE',
      sourceId: cn.id,
      lines: [
        {
          accountId: revenueAccount.id,
          debit: Number(cn.subtotal),
          credit: 0,
          description: 'Revenue reversal',
        },
        {
          accountId: taxAccount.id,
          debit: Number(cn.taxAmount),
          credit: 0,
          description: 'VAT reversal',
        },
        {
          accountId: arAccount.id,
          debit: 0,
          credit: Number(cn.total),
          description: 'AR reduction',
        },
      ],
    });

    // Restore stock for each item
    await this.prisma.$transaction(
      cn.items.map((item) =>
        this.prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: Number(item.quantity) } },
        }),
      ),
    );

    return this.prisma.creditNote.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
  }

  // ─── APPLY TO INVOICE ────────────────────────────────────
  async applyToInvoice(id: string, invoiceId: string) {
    const cn = await this.findOne(id);
    if (cn.status !== 'APPROVED')
      throw new BadRequestException(
        'Only APPROVED credit notes can be applied',
      );

    return this.prisma.creditNote.update({
      where: { id },
      data: { status: 'APPLIED', invoiceId, appliedAt: new Date() },
    });
  }
}
