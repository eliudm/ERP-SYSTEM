import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

export class CreateStockCountDto {
  warehouseId: string;
  countDate: string;
  notes?: string;
}

export class AddCountLineDto {
  productId: string;
  countedQty: number;
}

@Injectable()
export class StockCountsService {
  constructor(private prisma: PrismaService) {}

  private async generateReference(): Promise<string> {
    const count = await this.prisma.stockCount.count();
    return `SC-${String(count + 1).padStart(5, '0')}`;
  }

  async create(dto: CreateStockCountDto) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const reference = await this.generateReference();

    // Pre-populate with current stock levels
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
    });

    return this.prisma.stockCount.create({
      data: {
        reference,
        warehouseId: dto.warehouseId,
        countDate: new Date(dto.countDate),
        notes: dto.notes,
        lines: {
          create: products.map((p) => ({
            productId: p.id,
            expectedQty: p.stockQuantity,
            countedQty: 0,
            difference: 0,
          })),
        },
      },
      include: { warehouse: true, lines: { include: { product: true } } },
    });
  }

  async findAll() {
    return this.prisma.stockCount.findMany({
      include: { warehouse: true, _count: { select: { lines: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const sc = await this.prisma.stockCount.findUnique({
      where: { id },
      include: { warehouse: true, lines: { include: { product: true } } },
    });
    if (!sc) throw new NotFoundException('Stock count not found');
    return sc;
  }

  async startCount(id: string) {
    const sc = await this.prisma.stockCount.findUnique({ where: { id } });
    if (!sc) throw new NotFoundException('Stock count not found');
    if (sc.status !== 'DRAFT')
      throw new BadRequestException('Stock count already started');
    return this.prisma.stockCount.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });
  }

  // ─── UPDATE COUNT LINE ───────────────────────────────────
  async updateLine(id: string, productId: string, countedQty: number) {
    const sc = await this.prisma.stockCount.findUnique({ where: { id } });
    if (!sc) throw new NotFoundException('Stock count not found');
    if (sc.status === 'VALIDATED')
      throw new BadRequestException('Stock count already validated');

    const line = await this.prisma.stockCountLine.findFirst({
      where: { stockCountId: id, productId },
    });
    if (!line) throw new NotFoundException('Line not found');

    return this.prisma.stockCountLine.update({
      where: { id: line.id },
      data: { countedQty, difference: countedQty - Number(line.expectedQty) },
    });
  }

  // ─── VALIDATE: creates adjustment movements ──────────────
  async validate(id: string) {
    const sc = await this.findOne(id);
    if (!['DRAFT', 'IN_PROGRESS'].includes(sc.status)) {
      throw new BadRequestException('Stock count is already validated');
    }

    const adjustmentLines = sc.lines.filter((l) => Number(l.difference) !== 0);

    await this.prisma.$transaction([
      // Create stock adjustments
      ...adjustmentLines.map((line) =>
        this.prisma.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: sc.warehouseId,
            movementType: 'ADJUSTMENT',
            quantity: Math.abs(Number(line.difference)),
            reference: sc.reference,
            notes: `Stock count adjustment: ${Number(line.difference) > 0 ? '+' : ''}${line.difference}`,
          },
        }),
      ),
      // Update actual product stock
      ...adjustmentLines.map((line) =>
        this.prisma.product.update({
          where: { id: line.productId },
          data: { stockQuantity: { increment: Number(line.difference) } },
        }),
      ),
      // Mark as validated
      this.prisma.stockCount.update({
        where: { id },
        data: { status: 'VALIDATED', validatedAt: new Date() },
      }),
    ]);

    return { validated: true, adjustments: adjustmentLines.length };
  }
}
