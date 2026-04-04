import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateStockMovementDto } from '../dto';
import { MovementType } from '@prisma/client';

@Injectable()
export class StockMovementsService {
  constructor(
    private prisma: PrismaService,
    private postingEngine: PostingEngineService,
    private notificationsService: NotificationsService,
  ) {}

  // ─── CREATE STOCK MOVEMENT ───────────────────────────────
  async create(dto: CreateStockMovementDto) {
    // Validate product
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Validate warehouse
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    // For OUT movements check sufficient stock
    if (dto.movementType === MovementType.OUT) {
      if (Number(product.stockQuantity) < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${product.stockQuantity}, ` +
            `Requested: ${dto.quantity}`,
        );
      }
    }

    // Create movement & update stock in one transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Record movement
      const movement = await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          movementType: dto.movementType,
          quantity: dto.quantity,
          unitCost: dto.unitCost,
          reference: dto.reference,
          notes: dto.notes,
        },
        include: { product: true, warehouse: true },
      });

      // Update product stock quantity
      const quantityChange =
        dto.movementType === MovementType.IN
          ? dto.quantity
          : dto.movementType === MovementType.OUT
            ? -dto.quantity
            : 0; // ADJUSTMENT handled separately

      await tx.product.update({
        where: { id: dto.productId },
        data: {
          stockQuantity: {
            increment: quantityChange,
          },
        },
      });

      return movement;
    });

    // Post accounting entry for stock IN (purchase/receipt)
    if (dto.movementType === MovementType.IN && dto.unitCost) {
      await this.postStockInAccounting(
        dto.productId,
        dto.quantity,
        dto.unitCost,
        dto.reference || `STK-IN-${result.id.slice(0, 8)}`,
      );
    }

    // Post accounting entry for stock OUT (COGS)
    if (dto.movementType === MovementType.OUT) {
      await this.postStockOutAccounting(
        product,
        dto.quantity,
        dto.reference || `STK-OUT-${result.id.slice(0, 8)}`,
      );
    }

    // Check low-stock after any OUT or ADJUSTMENT movement
    if (
      dto.movementType === MovementType.OUT ||
      dto.movementType === MovementType.ADJUSTMENT
    ) {
      this.notificationsService
        .checkAndNotifyLowStock(dto.productId)
        .catch(() => {});
    }

    return result;
  }

  // ─── POST STOCK IN ACCOUNTING ────────────────────────────
  private async postStockInAccounting(
    productId: string,
    quantity: number,
    unitCost: number,
    reference: string,
  ) {
    const totalCost = quantity * unitCost;

    const [inventoryAccount, apAccount] = await Promise.all([
      this.prisma.account.findFirst({ where: { code: '1200' } }), // Inventory
      this.prisma.account.findFirst({ where: { code: '2000' } }), // Accounts Payable
    ]);

    if (!inventoryAccount || !apAccount) return;

    await this.postingEngine.postTransaction({
      reference: `ACC-${reference}`,
      description: `Stock received - ${reference}`,
      entryDate: new Date().toISOString(),
      sourceType: 'STOCK_IN',
      sourceId: productId,
      lines: [
        {
          accountId: inventoryAccount.id,
          debit: totalCost,
          credit: 0,
          description: `Inventory IN - ${reference}`,
        },
        {
          accountId: apAccount.id,
          debit: 0,
          credit: totalCost,
          description: `AP - ${reference}`,
        },
      ],
    });
  }

  // ─── POST STOCK OUT ACCOUNTING (COGS) ────────────────────
  private async postStockOutAccounting(
    product: any,
    quantity: number,
    reference: string,
  ) {
    const totalCost = quantity * Number(product.unitPrice);

    const [cogsAccount, inventoryAccount] = await Promise.all([
      this.prisma.account.findFirst({ where: { code: '5000' } }), // COGS
      this.prisma.account.findFirst({ where: { code: '1200' } }), // Inventory
    ]);

    if (!cogsAccount || !inventoryAccount) return;

    await this.postingEngine.postTransaction({
      reference: `ACC-${reference}`,
      description: `Cost of goods sold - ${reference}`,
      entryDate: new Date().toISOString(),
      sourceType: 'STOCK_OUT',
      sourceId: product.id,
      lines: [
        {
          accountId: cogsAccount.id,
          debit: totalCost,
          credit: 0,
          description: `COGS - ${reference}`,
        },
        {
          accountId: inventoryAccount.id,
          debit: 0,
          credit: totalCost,
          description: `Inventory OUT - ${reference}`,
        },
      ],
    });
  }

  // ─── GET ALL MOVEMENTS ───────────────────────────────────
  async findAll(page = 1, limit = 20, productId?: string) {
    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        skip,
        take: limit,
        where: productId ? { productId } : {},
        include: { product: true, warehouse: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({
        where: productId ? { productId } : {},
      }),
    ]);

    return {
      data: movements,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── GET MOVEMENT BY ID ──────────────────────────────────
  async findOne(id: string) {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });

    if (!movement) throw new NotFoundException('Stock movement not found');
    return movement;
  }

  // ─── STOCK ADJUSTMENT ────────────────────────────────────
  async adjust(
    productId: string,
    warehouseId: string,
    newQuantity: number,
    reason: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const currentQty = Number(product.stockQuantity);
    const difference = newQuantity - currentQty;

    // Record adjustment movement
    const movement = await this.prisma.$transaction(async (tx) => {
      const mov = await tx.stockMovement.create({
        data: {
          productId,
          warehouseId,
          movementType: MovementType.ADJUSTMENT,
          quantity: Math.abs(difference),
          notes: `Stock adjustment: ${reason}. From ${currentQty} to ${newQuantity}`,
          reference: `ADJ-${Date.now()}`,
        },
        include: { product: true, warehouse: true },
      });

      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: newQuantity },
      });

      return mov;
    });

    return movement;
  }

  // ─── GET MOVEMENT SUMMARY ────────────────────────────────
  async getSummary(startDate: string, endDate: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: { product: true },
    });

    const totalIn = movements
      .filter((m) => m.movementType === 'IN')
      .reduce((sum, m) => sum + Number(m.quantity), 0);

    const totalOut = movements
      .filter((m) => m.movementType === 'OUT')
      .reduce((sum, m) => sum + Number(m.quantity), 0);

    const totalAdjustments = movements.filter(
      (m) => m.movementType === 'ADJUSTMENT',
    ).length;

    return {
      period: { startDate, endDate },
      totalMovements: movements.length,
      totalIn,
      totalOut,
      totalAdjustments,
    };
  }
}
