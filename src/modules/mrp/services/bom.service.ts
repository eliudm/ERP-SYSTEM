import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateBOMDto, UpdateBOMDto, BOMLineDto } from '../dto/mrp.dto';

@Injectable()
export class BomService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE BOM ──────────────────────────────────────────
  async create(dto: CreateBOMDto, userId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new BadRequestException('Finished product not found');

    // Validate all component products exist
    const componentIds = dto.lines.map((l) => l.productId);
    if (componentIds.includes(dto.productId)) {
      throw new BadRequestException(
        'A product cannot be a component of itself',
      );
    }

    const components = await this.prisma.product.findMany({
      where: { id: { in: componentIds } },
    });
    if (components.length !== componentIds.length) {
      throw new BadRequestException('One or more component products not found');
    }

    return this.prisma.billOfMaterial.create({
      data: {
        name: dto.name,
        productId: dto.productId,
        quantity: dto.quantity ?? 1,
        notes: dto.notes,
        createdById: userId,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            notes: l.notes,
          })),
        },
      },
      include: {
        product: true,
        lines: { include: { product: true } },
      },
    });
  }

  // ─── GET ALL BOMs ────────────────────────────────────────
  async findAll(status?: string) {
    return this.prisma.billOfMaterial.findMany({
      where: status ? { status: status as any } : {},
      include: {
        product: { select: { id: true, code: true, name: true } },
        _count: { select: { lines: true, workOrders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── GET ONE BOM ─────────────────────────────────────────
  async findOne(id: string) {
    const bom = await this.prisma.billOfMaterial.findUnique({
      where: { id },
      include: {
        product: true,
        lines: {
          include: {
            product: {
              select: { id: true, code: true, name: true, stockQuantity: true },
            },
          },
        },
        workOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!bom) throw new NotFoundException('BOM not found');
    return bom;
  }

  // ─── UPDATE BOM (metadata only) ──────────────────────────
  async update(id: string, dto: UpdateBOMDto) {
    const bom = await this.prisma.billOfMaterial.findUnique({ where: { id } });
    if (!bom) throw new NotFoundException('BOM not found');

    return this.prisma.billOfMaterial.update({
      where: { id },
      data: dto,
      include: { product: true, lines: { include: { product: true } } },
    });
  }

  // ─── SET BOM STATUS ──────────────────────────────────────
  async setStatus(id: string, status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED') {
    const bom = await this.prisma.billOfMaterial.findUnique({ where: { id } });
    if (!bom) throw new NotFoundException('BOM not found');

    return this.prisma.billOfMaterial.update({
      where: { id },
      data: { status },
    });
  }

  // ─── ADD / REPLACE BOM LINES ─────────────────────────────
  async upsertLines(id: string, lines: BOMLineDto[]) {
    const bom = await this.prisma.billOfMaterial.findUnique({ where: { id } });
    if (!bom) throw new NotFoundException('BOM not found');

    // Validate no self-reference
    if (lines.some((l) => l.productId === bom.productId)) {
      throw new BadRequestException(
        'A product cannot be a component of itself',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Remove existing lines
      await tx.bOMLine.deleteMany({ where: { bomId: id } });

      // Create new lines
      await tx.bOMLine.createMany({
        data: lines.map((l) => ({
          bomId: id,
          productId: l.productId,
          quantity: l.quantity,
          notes: l.notes,
        })),
      });

      return tx.billOfMaterial.findUnique({
        where: { id },
        include: { product: true, lines: { include: { product: true } } },
      });
    });
  }

  // ─── CHECK MATERIAL AVAILABILITY ─────────────────────────
  async checkAvailability(id: string, quantity: number) {
    const bom = await this.prisma.billOfMaterial.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            product: {
              select: { id: true, code: true, name: true, stockQuantity: true },
            },
          },
        },
      },
    });
    if (!bom) throw new NotFoundException('BOM not found');

    const result = bom.lines.map((line) => {
      const required = Number(line.quantity) * quantity;
      const available = Number(line.product.stockQuantity);
      return {
        productId: line.product.id,
        code: line.product.code,
        name: line.product.name,
        requiredQty: required,
        availableQty: available,
        shortage: Math.max(0, required - available),
        isSufficient: available >= required,
      };
    });

    return {
      bomId: id,
      bomName: bom.name,
      productionQty: quantity,
      components: result,
      allAvailable: result.every((r) => r.isSufficient),
    };
  }
}
