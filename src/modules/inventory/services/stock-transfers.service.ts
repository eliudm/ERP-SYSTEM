import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

export class CreateTransferDto {
  fromWarehouseId: string;
  toWarehouseId: string;
  notes?: string;
  lines: { productId: string; quantity: number }[];
}

@Injectable()
export class StockTransfersService {
  constructor(private prisma: PrismaService) {}

  private async generateReference(): Promise<string> {
    const count = await this.prisma.stockTransfer.count();
    return `TRF-${String(count + 1).padStart(5, '0')}`;
  }

  async create(dto: CreateTransferDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException(
        'Source and destination warehouses must be different',
      );
    }

    const [from, to] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: dto.fromWarehouseId } }),
      this.prisma.warehouse.findUnique({ where: { id: dto.toWarehouseId } }),
    ]);
    if (!from) throw new NotFoundException('Source warehouse not found');
    if (!to) throw new NotFoundException('Destination warehouse not found');

    const reference = await this.generateReference();

    return this.prisma.stockTransfer.create({
      data: {
        reference,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        notes: dto.notes,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
          })),
        },
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        lines: { include: { product: true } },
      },
    });
  }

  async findAll() {
    return this.prisma.stockTransfer.findMany({
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const t = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        lines: { include: { product: true } },
      },
    });
    if (!t) throw new NotFoundException('Transfer not found');
    return t;
  }

  // ─── COMPLETE: moves stock between warehouses ─────────────
  async complete(id: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'DRAFT' && transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException(
        'Transfer cannot be completed in its current state',
      );
    }

    // Validate stock availability from source warehouse
    for (const line of transfer.lines) {
      const product = await this.prisma.product.findUnique({
        where: { id: line.productId },
      });
      if (!product)
        throw new NotFoundException(`Product ${line.productId} not found`);
      if (Number(product.stockQuantity) < Number(line.quantity)) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name}: available ${product.stockQuantity}, required ${line.quantity}`,
        );
      }
    }

    await this.prisma.$transaction([
      // Create OUT movements from source warehouse
      ...transfer.lines.map((line) =>
        this.prisma.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: transfer.fromWarehouseId,
            movementType: 'OUT',
            quantity: line.quantity,
            reference: transfer.reference,
            notes: `Transfer to ${transfer.toWarehouse.name}`,
          },
        }),
      ),
      // Create IN movements to destination warehouse
      ...transfer.lines.map((line) =>
        this.prisma.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: transfer.toWarehouseId,
            movementType: 'IN',
            quantity: line.quantity,
            reference: transfer.reference,
            notes: `Transfer from ${transfer.fromWarehouse.name}`,
          },
        }),
      ),
      // Product stockQuantity stays the same (net zero transfer)
      // Mark transfer as completed
      this.prisma.stockTransfer.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
    ]);

    return { completed: true, linesTransferred: transfer.lines.length };
  }

  async cancel(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status === 'COMPLETED')
      throw new BadRequestException('Completed transfers cannot be cancelled');
    return this.prisma.stockTransfer.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
