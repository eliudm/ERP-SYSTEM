import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateWarehouseDto } from '../dto';

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE WAREHOUSE ────────────────────────────────────
  async create(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto });
  }

  // ─── GET ALL WAREHOUSES ──────────────────────────────────
  async findAll() {
    return this.prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── GET ONE WAREHOUSE ───────────────────────────────────
  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        stockMovements: {
          include: { product: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  // ─── GET WAREHOUSE STOCK ─────────────────────────────────
  async getWarehouseStock(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) throw new NotFoundException('Warehouse not found');

    // Aggregate stock per product in this warehouse
    const movements = await this.prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { warehouseId: id },
      _sum: { quantity: true },
    });

    const stockItems = await Promise.all(
      movements.map(async (m) => {
        const product = await this.prisma.product.findUnique({
          where: { id: m.productId },
        });

        // Calculate net stock (IN - OUT)
        const inQty = await this.prisma.stockMovement.aggregate({
          where: {
            warehouseId: id,
            productId: m.productId,
            movementType: 'IN',
          },
          _sum: { quantity: true },
        });

        const outQty = await this.prisma.stockMovement.aggregate({
          where: {
            warehouseId: id,
            productId: m.productId,
            movementType: 'OUT',
          },
          _sum: { quantity: true },
        });

        const netStock =
          Number(inQty._sum.quantity || 0) - Number(outQty._sum.quantity || 0);

        return {
          product,
          netStock,
          totalValue: netStock * Number(product?.unitPrice || 0),
        };
      }),
    );

    return { warehouse, stock: stockItems };
  }

  // ─── DEACTIVATE WAREHOUSE ────────────────────────────────
  async deactivate(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    return this.prisma.warehouse.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
