import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

export class CreateRFQDto {
  supplierId: string;
  requestDate: string;
  notes?: string;
  items: { productId: string; quantity: number; expectedPrice?: number }[];
}

@Injectable()
export class RFQService {
  constructor(private prisma: PrismaService) {}

  private async generateNumber(): Promise<string> {
    const count = await this.prisma.requestForQuotation.count();
    return `RFQ-${String(count + 1).padStart(5, '0')}`;
  }

  async create(dto: CreateRFQDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const rfqNumber = await this.generateNumber();

    return this.prisma.requestForQuotation.create({
      data: {
        rfqNumber,
        supplierId: dto.supplierId,
        requestDate: new Date(dto.requestDate),
        notes: dto.notes,
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            expectedPrice: i.expectedPrice,
          })),
        },
      },
      include: { supplier: true, items: { include: { product: true } } },
    });
  }

  async findAll(supplierId?: string) {
    return this.prisma.requestForQuotation.findMany({
      where: supplierId ? { supplierId } : {},
      include: { supplier: true, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rfq = await this.prisma.requestForQuotation.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { product: true } } },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    return rfq;
  }

  async send(id: string) {
    const rfq = await this.prisma.requestForQuotation.findUnique({
      where: { id },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT RFQs can be sent');
    return this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'SENT' },
    });
  }

  async receiveQuotation(
    id: string,
    items: { productId: string; quotedPrice: number }[],
  ) {
    const rfq = await this.prisma.requestForQuotation.findUnique({
      where: { id },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.rFQItem.updateMany({
          where: { rfqId: id, productId: item.productId },
          data: { quotedPrice: item.quotedPrice },
        }),
      ),
    );

    return this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'RECEIVED' },
    });
  }

  async convertToPO(id: string) {
    const rfq = await this.findOne(id);
    if (rfq.status !== 'RECEIVED')
      throw new BadRequestException(
        'RFQ must be RECEIVED before converting to PO',
      );

    const count = await this.prisma.purchaseOrder.count();
    const orderNo = `PO-${String(count + 1).padStart(5, '0')}`;

    const items = rfq.items.map((i) => {
      const unitCost = Number(i.quotedPrice || i.expectedPrice || 0);
      const lineTotal = unitCost * Number(i.quantity);
      const taxRate = 0.16;
      const taxAmount = lineTotal * taxRate;
      return {
        productId: i.productId,
        quantity: i.quantity,
        unitCost,
        taxRate,
        taxAmount,
        lineTotal: lineTotal + taxAmount,
      };
    });

    const subtotal = items.reduce(
      (s, i) => s + Number(i.quantity) * i.unitCost,
      0,
    );
    const taxAmount = items.reduce((s, i) => s + i.taxAmount, 0);
    const total = subtotal + taxAmount;

    const po = await this.prisma.purchaseOrder.create({
      data: {
        orderNo,
        supplierId: rfq.supplierId,
        orderDate: new Date(),
        subtotal,
        taxAmount,
        total,
        items: { create: items },
      },
    });

    await this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'CONVERTED' },
    });

    return po;
  }
}
