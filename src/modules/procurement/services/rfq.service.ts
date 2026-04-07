import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { PurchaseOrderStatus } from '@prisma/client';

export class CreateRFQDto {
  supplierId: string;
  requestDate?: string;
  vendorReference?: string;
  paymentTerms?: string;
  orderDeadline?: string;
  expectedArrival?: string;
  deliverTo?: string;
  notes?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }[];
}

export class UpdateRFQDto {
  supplierId?: string;
  vendorReference?: string;
  paymentTerms?: string;
  orderDeadline?: string;
  expectedArrival?: string;
  deliverTo?: string;
  notes?: string;
  items?: {
    productId: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }[];
}

@Injectable()
export class RFQService {
  constructor(
    private prisma: PrismaService,
    private postingEngine: PostingEngineService,
  ) {}

  private async generateNumber(): Promise<string> {
    const count = await this.prisma.requestForQuotation.count();
    return `RFQ-${String(count + 1).padStart(5, '0')}`;
  }

  private computeItems(
    items: {
      productId: string;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
    }[],
  ) {
    return items.map((i) => {
      const taxRate = i.taxRate ?? 0.16;
      const lineSubtotal = Number(i.quantity) * Number(i.unitPrice);
      const taxAmount = lineSubtotal * taxRate;
      return {
        productId: i.productId,
        quantity: i.quantity,
        expectedPrice: i.unitPrice,
        taxRate,
        taxAmount,
        lineTotal: lineSubtotal + taxAmount,
      };
    });
  }

  async create(dto: CreateRFQDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const rfqNumber = await this.generateNumber();
    const itemsData = this.computeItems(dto.items);

    return this.prisma.requestForQuotation.create({
      data: {
        rfqNumber,
        supplierId: dto.supplierId,
        requestDate: dto.requestDate ? new Date(dto.requestDate) : new Date(),
        vendorReference: dto.vendorReference,
        paymentTerms: dto.paymentTerms,
        orderDeadline: dto.orderDeadline
          ? new Date(dto.orderDeadline)
          : undefined,
        expectedArrival: dto.expectedArrival
          ? new Date(dto.expectedArrival)
          : undefined,
        deliverTo: dto.deliverTo,
        notes: dto.notes,
        items: { create: itemsData },
      },
      include: { supplier: true, items: { include: { product: true } } },
    });
  }

  findAll(supplierId?: string, status?: string) {
    return this.prisma.requestForQuotation.findMany({
      where: {
        ...(supplierId ? { supplierId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        supplier: true,
        _count: { select: { items: true } },
        purchaseOrder: { select: { id: true, orderNo: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rfq = await this.prisma.requestForQuotation.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { product: true } },
        purchaseOrder: {
          include: { items: { include: { product: true } } },
        },
      },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    return rfq;
  }

  async update(id: string, dto: UpdateRFQDto) {
    const rfq = await this.prisma.requestForQuotation.findUnique({
      where: { id },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT RFQs can be updated');

    let itemsUpdate = {};
    if (dto.items) {
      await this.prisma.rFQItem.deleteMany({ where: { rfqId: id } });
      const itemsData = this.computeItems(dto.items);
      itemsUpdate = { items: { create: itemsData } };
    }

    return this.prisma.requestForQuotation.update({
      where: { id },
      data: {
        ...(dto.supplierId ? { supplierId: dto.supplierId } : {}),
        vendorReference: dto.vendorReference,
        paymentTerms: dto.paymentTerms,
        orderDeadline: dto.orderDeadline
          ? new Date(dto.orderDeadline)
          : undefined,
        expectedArrival: dto.expectedArrival
          ? new Date(dto.expectedArrival)
          : undefined,
        deliverTo: dto.deliverTo,
        notes: dto.notes,
        ...itemsUpdate,
      },
      include: { supplier: true, items: { include: { product: true } } },
    });
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
      include: { supplier: true, items: { include: { product: true } } },
    });
  }

  async confirm(id: string) {
    const rfq = await this.findOne(id);
    if (!['DRAFT', 'SENT'].includes(rfq.status))
      throw new BadRequestException('Only DRAFT or SENT RFQs can be confirmed');
    if (rfq.items.length === 0)
      throw new BadRequestException('Cannot confirm an RFQ with no items');

    const count = await this.prisma.purchaseOrder.count();
    const orderNo = `PO-${String(count + 1).padStart(5, '0')}`;

    const items = rfq.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitCost: Number(i.quotedPrice || i.expectedPrice || 0),
      taxRate: Number(i.taxRate),
      taxAmount: Number(i.taxAmount),
      lineTotal: Number(i.lineTotal),
    }));

    const subtotal = items.reduce(
      (s, i) => s + Number(i.quantity) * i.unitCost,
      0,
    );
    const taxAmount = items.reduce((s, i) => s + i.taxAmount, 0);
    const total = subtotal + taxAmount;

    // Get accounting accounts for journal entry
    const apAccount = await this.prisma.account.findFirst({
      where: { code: '2000' },
    });
    const inventoryAccount = await this.prisma.account.findFirst({
      where: { code: '1200' },
    });
    const vatAccount = await this.prisma.account.findFirst({
      where: { code: '2100' },
    });

    // Create PO (APPROVED so it can be received immediately)
    const po = await this.prisma.purchaseOrder.create({
      data: {
        orderNo,
        supplierId: rfq.supplierId,
        rfqId: id,
        orderDate: new Date(),
        status: PurchaseOrderStatus.APPROVED,
        subtotal,
        taxAmount,
        total,
        notes: rfq.notes,
        items: { create: items },
      },
      include: { supplier: true },
    });

    // Post accounting entry if accounts configured
    if (apAccount && inventoryAccount && vatAccount) {
      await this.postingEngine.postTransaction({
        reference: `PO-APPR-${po.orderNo}`,
        description: `Purchase Order ${po.orderNo} – ${po.supplier.name}`,
        entryDate: po.orderDate.toISOString(),
        sourceType: 'PURCHASE_ORDER',
        sourceId: po.id,
        lines: [
          {
            accountId: inventoryAccount.id,
            debit: subtotal,
            credit: 0,
            description: `Inventory – ${po.orderNo}`,
          },
          {
            accountId: vatAccount.id,
            debit: taxAmount,
            credit: 0,
            description: `VAT Input – ${po.orderNo}`,
          },
          {
            accountId: apAccount.id,
            debit: 0,
            credit: total,
            description: `AP – ${po.orderNo}`,
          },
        ],
      });
    }

    await this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'CONVERTED' },
    });

    return this.findOne(id);
  }

  async cancel(id: string) {
    const rfq = await this.prisma.requestForQuotation.findUnique({
      where: { id },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (['CONVERTED', 'CANCELLED'].includes(rfq.status))
      throw new BadRequestException(`Cannot cancel a ${rfq.status} RFQ`);
    return this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // Keep old receive/convert for backwards compat
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
    return this.confirm(id);
  }
}
