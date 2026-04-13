import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateQuoteDto, UpdateQuoteDto } from '../dto/create-quote.dto';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { MailService } from '../../../mail.service';
import { SendQuoteEmailDto } from '../dto/send-quote-email.dto';

@Injectable()
export class QuotesService {
  private quoteCounter = 0;

  constructor(
    private prisma: PrismaService,
    private postingEngine: PostingEngineService,
    private mailService: MailService,
  ) {}

  private async generateQuoteNumber(): Promise<string> {
    const count = await this.prisma.salesQuote.count();
    return `QT-${String(count + 1).padStart(5, '0')}`;
  }

  private calcItems(items: CreateQuoteDto['items']) {
    return items.map((item) => {
      const discount = item.discount || 0;
      const discountedPrice = item.unitPrice * (1 - discount / 100);
      const lineSubtotal = discountedPrice * item.quantity;
      const taxAmount = lineSubtotal * item.taxRate;
      return {
        ...item,
        discount: discount,
        taxAmount,
        lineTotal: lineSubtotal + taxAmount,
        lineSubtotal,
      };
    });
  }

  // ─── CREATE QUOTE ────────────────────────────────────────
  async create(dto: CreateQuoteDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const calcedItems = this.calcItems(dto.items);
    const subtotal = calcedItems.reduce((s, i) => s + i.lineSubtotal, 0);
    const taxAmount = calcedItems.reduce((s, i) => s + i.taxAmount, 0);
    const total = subtotal + taxAmount;
    const quoteNumber = await this.generateQuoteNumber();

    return this.prisma.salesQuote.create({
      data: {
        quoteNumber,
        customerId: dto.customerId,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        subtotal,
        taxAmount,
        total,
        notes: dto.notes,
        items: {
          create: calcedItems.map((i) => ({
            productId: i.productId,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
            taxRate: i.taxRate,
            taxAmount: i.taxAmount,
            lineTotal: i.lineTotal,
          })),
        },
      },
      include: { customer: true, items: { include: { product: true } } },
    });
  }

  // ─── LIST QUOTES ─────────────────────────────────────────
  async findAll(page = 1, limit = 20, status?: string, customerId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const [data, total] = await Promise.all([
      this.prisma.salesQuote.findMany({
        where,
        skip,
        take: limit,
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.salesQuote.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── GET ONE ─────────────────────────────────────────────
  async findOne(id: string) {
    const quote = await this.prisma.salesQuote.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        invoice: true,
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  // ─── UPDATE QUOTE (DRAFT only) ───────────────────────────
  async update(id: string, dto: UpdateQuoteDto) {
    const quote = await this.prisma.salesQuote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT quotes can be edited');

    if (dto.items) {
      await this.prisma.salesQuoteItem.deleteMany({ where: { quoteId: id } });
      const calcedItems = this.calcItems(dto.items);
      const subtotal = calcedItems.reduce((s, i) => s + i.lineSubtotal, 0);
      const taxAmount = calcedItems.reduce((s, i) => s + i.taxAmount, 0);

      return this.prisma.salesQuote.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          subtotal,
          taxAmount,
          total: subtotal + taxAmount,
          notes: dto.notes,
          items: {
            create: calcedItems.map((i) => ({
              productId: i.productId,
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
              taxRate: i.taxRate,
              taxAmount: i.taxAmount,
              lineTotal: i.lineTotal,
            })),
          },
        },
        include: { customer: true, items: { include: { product: true } } },
      });
    }

    return this.prisma.salesQuote.update({
      where: { id },
      data: { notes: dto.notes },
    });
  }

  // ─── SEND QUOTE ──────────────────────────────────────────
  async send(id: string) {
    const quote = await this.prisma.salesQuote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT quotes can be sent');
    return this.prisma.salesQuote.update({
      where: { id },
      data: { status: 'SENT' },
    });
  }

  // ─── SEND QUOTE BY EMAIL ─────────────────────────────────
  async sendByEmail(id: string, dto: SendQuoteEmailDto) {
    const quote = await this.prisma.salesQuote.findUnique({
      where: { id },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (!['DRAFT', 'SENT'].includes(quote.status))
      throw new BadRequestException(
        'Quote cannot be emailed in current status',
      );

    const itemRows = quote.items
      .map(
        (i) =>
          `<tr>
            <td style="padding:4px 8px;border:1px solid #e0e0e0">${i.product?.name ?? i.description ?? ''}</td>
            <td style="padding:4px 8px;border:1px solid #e0e0e0;text-align:center">${i.quantity}</td>
            <td style="padding:4px 8px;border:1px solid #e0e0e0;text-align:right">${Number(i.unitPrice).toFixed(2)}</td>
            <td style="padding:4px 8px;border:1px solid #e0e0e0;text-align:right">${Number(i.lineTotal).toFixed(2)}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1976d2">${quote.quoteNumber}</h2>
        <p>${dto.body.replace(/\n/g, '<br/>')}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:left">Product</th>
              <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:center">Qty</th>
              <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:right">Unit Price</th>
              <th style="padding:6px 8px;border:1px solid #e0e0e0;text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding:6px 8px;text-align:right;font-weight:bold">Total</td>
              <td style="padding:6px 8px;border:1px solid #e0e0e0;text-align:right;font-weight:bold">${Number(quote.total).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <p style="color:#888;font-size:12px;margin-top:24px">Sent from Nexora ERP</p>
      </div>`;

    const result = await this.mailService.sendMail({
      to: dto.to,
      subject: dto.subject,
      html,
    });

    // Mark as SENT if still DRAFT
    if (quote.status === 'DRAFT') {
      await this.prisma.salesQuote.update({
        where: { id },
        data: { status: 'SENT' },
      });
    }

    return { message: 'Email sent successfully', preview: result.preview };
  }

  // ─── CONVERT TO INVOICE ──────────────────────────────────
  async convertToInvoice(id: string) {
    const quote = await this.prisma.salesQuote.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== 'SENT' && quote.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Only SENT or ACCEPTED quotes can be converted',
      );
    }
    if (quote.invoiceId)
      throw new ConflictException('Quote already converted to invoice');

    // Count existing invoices for numbering
    const invoiceCount = await this.prisma.salesInvoice.count();
    const invoiceNo = `INV-${String(invoiceCount + 1).padStart(5, '0')}`;

    const invoice = await this.prisma.salesInvoice.create({
      data: {
        invoiceNo,
        customerId: quote.customerId,
        invoiceDate: new Date(),
        subtotal: quote.subtotal,
        taxAmount: quote.taxAmount,
        total: quote.total,
        notes: quote.notes,
        items: {
          create: quote.items.map((i) => ({
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
    });

    await this.prisma.salesQuote.update({
      where: { id },
      data: { status: 'ACCEPTED', invoiceId: invoice.id },
    });

    return invoice;
  }

  // ─── DECLINE / EXPIRE ────────────────────────────────────
  async decline(id: string) {
    const quote = await this.findOne(id);
    if (!['SENT', 'DRAFT'].includes(quote.status))
      throw new BadRequestException('Cannot decline in current status');
    return this.prisma.salesQuote.update({
      where: { id },
      data: { status: 'DECLINED' },
    });
  }

  expire(id: string) {
    return this.prisma.salesQuote.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
  }
}
