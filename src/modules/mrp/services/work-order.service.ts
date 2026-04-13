import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateWorkOrderDto } from '../dto/mrp.dto';

@Injectable()
export class WorkOrderService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE WORK ORDER ───────────────────────────────────
  async create(dto: CreateWorkOrderDto, userId?: string) {
    const bom = await this.prisma.billOfMaterial.findUnique({
      where: { id: dto.bomId },
      include: { product: true },
    });
    if (!bom) throw new BadRequestException('BOM not found');
    if (bom.status !== 'ACTIVE') {
      throw new BadRequestException('BOM must be ACTIVE to create work orders');
    }

    const count = await this.prisma.workOrder.count();
    const reference = `WO-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.workOrder.create({
      data: {
        reference,
        bomId: dto.bomId,
        quantity: dto.quantity,
        scheduledStart: dto.scheduledStart
          ? new Date(dto.scheduledStart)
          : null,
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : null,
        notes: dto.notes,
        createdById: userId,
      },
      include: {
        bom: {
          include: {
            product: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }

  // ─── LIST WORK ORDERS ────────────────────────────────────
  async findAll(status?: string) {
    return this.prisma.workOrder.findMany({
      where: status ? { status: status as any } : {},
      include: {
        bom: {
          include: {
            product: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── GET ONE ─────────────────────────────────────────────
  async findOne(id: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: {
        bom: {
          include: {
            product: true,
            lines: {
              include: {
                product: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    stockQuantity: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    return wo;
  }

  // ─── CONFIRM WORK ORDER ──────────────────────────────────
  async confirm(id: string) {
    const wo = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT work orders can be confirmed');
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });
  }

  // ─── START PRODUCTION ────────────────────────────────────
  async startProduction(id: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { bom: { include: { lines: { include: { product: true } } } } },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.status !== 'CONFIRMED') {
      throw new BadRequestException('Work order must be CONFIRMED to start');
    }

    // Validate material availability
    for (const line of wo.bom.lines) {
      const required = Number(line.quantity) * Number(wo.quantity);
      const available = Number(line.product.stockQuantity);
      if (available < required) {
        throw new BadRequestException(
          `Insufficient stock for ${line.product.name}: need ${required}, have ${available}`,
        );
      }
    }

    // Consume raw materials (reduce stock)
    await this.prisma.$transaction(
      wo.bom.lines.map((line) =>
        this.prisma.product.update({
          where: { id: line.productId },
          data: {
            stockQuantity: {
              decrement: Number(line.quantity) * Number(wo.quantity),
            },
          },
        }),
      ),
    );

    return this.prisma.workOrder.update({
      where: { id },
      data: { status: 'IN_PROGRESS', actualStart: new Date() },
    });
  }

  // ─── COMPLETE PRODUCTION ─────────────────────────────────
  async complete(id: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { bom: true },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Work order must be IN_PROGRESS to complete',
      );
    }

    // Add finished goods to stock
    const outputQty = Number(wo.bom.quantity) * Number(wo.quantity);
    await this.prisma.product.update({
      where: { id: wo.bom.productId },
      data: { stockQuantity: { increment: outputQty } },
    });

    return this.prisma.workOrder.update({
      where: { id },
      data: { status: 'DONE', actualEnd: new Date() },
    });
  }

  // ─── CANCEL WORK ORDER ───────────────────────────────────
  async cancel(id: string) {
    const wo = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.status === 'DONE') {
      throw new BadRequestException('Cannot cancel a completed work order');
    }

    // If was IN_PROGRESS, reverse the consumed materials
    if (wo.status === 'IN_PROGRESS') {
      const bom = await this.prisma.billOfMaterial.findUnique({
        where: { id: wo.bomId },
        include: { lines: true },
      });

      if (bom) {
        await this.prisma.$transaction(
          bom.lines.map((line) =>
            this.prisma.product.update({
              where: { id: line.productId },
              data: {
                stockQuantity: {
                  increment: Number(line.quantity) * Number(wo.quantity),
                },
              },
            }),
          ),
        );
      }
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
