import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';

export class CreatePurchaseReturnDto {
  supplierId: string;
  purchaseOrderId?: string;
  reason?: string;
  items: { productId: string; quantity: number; unitCost: number }[];
}

@Injectable()
export class PurchaseReturnsService {
  constructor(
    private prisma: PrismaService,
    private postingEngine: PostingEngineService,
  ) {}

  private async generateNumber(): Promise<string> {
    const count = await this.prisma.purchaseReturn.count();
    return `PR-${String(count + 1).padStart(5, '0')}`;
  }

  async create(dto: CreatePurchaseReturnDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const items = dto.items.map((i) => ({
      ...i,
      lineTotal: i.quantity * i.unitCost,
    }));
    const total = items.reduce((s, i) => s + i.lineTotal, 0);
    const returnNumber = await this.generateNumber();

    return this.prisma.purchaseReturn.create({
      data: {
        returnNumber,
        supplierId: dto.supplierId,
        purchaseOrderId: dto.purchaseOrderId,
        reason: dto.reason,
        total,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitCost: i.unitCost,
            lineTotal: i.lineTotal,
          })),
        },
      },
      include: { supplier: true, items: { include: { product: true } } },
    });
  }

  async findAll() {
    return this.prisma.purchaseReturn.findMany({
      include: { supplier: true, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const pr = await this.prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseOrder: true,
        items: { include: { product: true } },
      },
    });
    if (!pr) throw new NotFoundException('Purchase return not found');
    return pr;
  }

  // ─── APPROVE: reverses stock + creates journal entry ─────
  async approve(id: string) {
    const pr = await this.findOne(id);
    if (pr.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT returns can be approved');

    const inventoryAccount = await this.prisma.account.findFirst({
      where: { code: '1400' },
    });
    const apAccount = await this.prisma.account.findFirst({
      where: { code: '2100' },
    });

    if (!inventoryAccount || !apAccount) {
      throw new BadRequestException(
        'Required GL accounts not configured (Inventory: 1400, AP: 2100)',
      );
    }

    // Credit inventory, debit AP (reduces what we owe supplier)
    await this.postingEngine.postTransaction({
      reference: `PR-JE-${pr.returnNumber}`,
      description: `Purchase Return ${pr.returnNumber} to ${pr.supplier.name}`,
      entryDate: new Date().toISOString(),
      sourceType: 'PURCHASE_RETURN',
      sourceId: pr.id,
      lines: [
        {
          accountId: apAccount.id,
          debit: Number(pr.total),
          credit: 0,
          description: 'Reduce AP for return',
        },
        {
          accountId: inventoryAccount.id,
          debit: 0,
          credit: Number(pr.total),
          description: 'Reduce inventory',
        },
      ],
    });

    // Deduct stock for returned items
    await this.prisma.$transaction([
      ...pr.items.map((item) =>
        this.prisma.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: (async () => {
              const wh = await this.prisma.warehouse.findFirst({
                where: { isActive: true },
              });
              return wh?.id || '';
            })() as any,
            movementType: 'OUT',
            quantity: item.quantity,
            unitCost: item.unitCost,
            reference: pr.returnNumber,
            notes: `Purchase return: ${pr.reason || ''}`,
          },
        }),
      ),
      ...pr.items.map((item) =>
        this.prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: Number(item.quantity) } },
        }),
      ),
      this.prisma.purchaseReturn.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      }),
    ]);

    return { approved: true, returnNumber: pr.returnNumber };
  }
}
