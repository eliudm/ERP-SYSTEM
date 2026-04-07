import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

export class CreateLandedCostDto {
  purchaseOrderId?: string;
  description?: string;
  amount: number;
  method?: 'EQUAL' | 'BY_QTY' | 'BY_VALUE';
}

@Injectable()
export class LandedCostsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateLandedCostDto) {
    return this.prisma.landedCost.create({
      data: {
        purchaseOrderId: dto.purchaseOrderId,
        description: dto.description,
        amount: dto.amount,
        method: (dto.method as any) || 'BY_VALUE',
      },
      include: { purchaseOrder: true },
    });
  }

  findAll() {
    return this.prisma.landedCost.findMany({
      include: { purchaseOrder: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const lc = await this.prisma.landedCost.findUnique({
      where: { id },
      include: { purchaseOrder: true, items: { include: { product: true } } },
    });
    if (!lc) throw new NotFoundException('Landed cost not found');
    return lc;
  }

  // ─── APPLY: allocate cost to products in the PO ──────────
  async apply(id: string) {
    const lc = await this.findOne(id);
    if (lc.status === 'APPLIED')
      throw new BadRequestException('Landed cost already applied');
    if (!lc.purchaseOrderId)
      throw new BadRequestException(
        'No purchase order linked to this landed cost',
      );

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: lc.purchaseOrderId },
      include: { items: { include: { product: true } } },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'RECEIVED')
      throw new BadRequestException(
        'Purchase order must be RECEIVED to apply landed costs',
      );

    const products = po.items;
    const totalAmount = Number(lc.amount);

    let allocations: { productId: string; allocatedAmount: number }[] = [];

    if (lc.method === 'EQUAL') {
      const each = totalAmount / products.length;
      allocations = products.map((p) => ({
        productId: p.productId,
        allocatedAmount: each,
      }));
    } else if (lc.method === 'BY_QTY') {
      const totalQty = products.reduce((s, p) => s + Number(p.quantity), 0);
      allocations = products.map((p) => ({
        productId: p.productId,
        allocatedAmount: (Number(p.quantity) / totalQty) * totalAmount,
      }));
    } else {
      // BY_VALUE
      const totalValue = products.reduce(
        (s, p) => s + Number(p.quantity) * Number(p.unitCost),
        0,
      );
      allocations = products.map((p) => ({
        productId: p.productId,
        allocatedAmount:
          ((Number(p.quantity) * Number(p.unitCost)) / totalValue) *
          totalAmount,
      }));
    }

    await this.prisma.$transaction([
      // Create allocation items
      ...allocations.map((a) =>
        this.prisma.landedCostItem.create({
          data: {
            landedCostId: id,
            productId: a.productId,
            allocatedAmount: a.allocatedAmount,
          },
        }),
      ),
      // Mark as applied
      this.prisma.landedCost.update({
        where: { id },
        data: { status: 'APPLIED', appliedAt: new Date() },
      }),
    ]);

    return { allocated: allocations.length, totalAmount };
  }
}
