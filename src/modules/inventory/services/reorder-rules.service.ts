import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateReorderRuleDto, UpdateReorderRuleDto } from '../dto';

@Injectable()
export class ReorderRulesService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE REORDER RULE ─────────────────────────────────
  async create(dto: CreateReorderRuleDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new BadRequestException('Product not found');

    const existing = await this.prisma.reorderRule.findUnique({
      where: { productId: dto.productId },
    });
    if (existing) {
      throw new ConflictException(
        `A reorder rule already exists for product "${product.name}". Update it instead.`,
      );
    }

    if (dto.preferredSupplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.preferredSupplierId },
      });
      if (!supplier)
        throw new BadRequestException('Preferred supplier not found');
    }

    return this.prisma.reorderRule.create({
      data: {
        productId: dto.productId,
        preferredSupplierId: dto.preferredSupplierId,
        reorderPoint: dto.reorderPoint,
        reorderQty: dto.reorderQty,
        maxStock: dto.maxStock,
        isAutomatic: dto.isAutomatic ?? false,
      },
      include: { product: true, preferredSupplier: true },
    });
  }

  // ─── GET ALL RULES ───────────────────────────────────────
  async findAll(activeOnly = true) {
    return this.prisma.reorderRule.findMany({
      where: activeOnly ? { isActive: true } : {},
      include: { product: true, preferredSupplier: true },
      orderBy: { product: { name: 'asc' } },
    });
  }

  // ─── GET ONE RULE ────────────────────────────────────────
  async findOne(id: string) {
    const rule = await this.prisma.reorderRule.findUnique({
      where: { id },
      include: { product: true, preferredSupplier: true },
    });
    if (!rule) throw new NotFoundException('Reorder rule not found');
    return rule;
  }

  // ─── UPDATE RULE ─────────────────────────────────────────
  async update(id: string, dto: UpdateReorderRuleDto) {
    const rule = await this.prisma.reorderRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Reorder rule not found');

    if (dto.preferredSupplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.preferredSupplierId },
      });
      if (!supplier)
        throw new BadRequestException('Preferred supplier not found');
    }

    return this.prisma.reorderRule.update({
      where: { id },
      data: dto,
      include: { product: true, preferredSupplier: true },
    });
  }

  // ─── DELETE RULE ─────────────────────────────────────────
  async remove(id: string) {
    const rule = await this.prisma.reorderRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Reorder rule not found');

    return this.prisma.reorderRule.delete({ where: { id } });
  }

  // ─── CHECK STOCK & GENERATE SUGGESTIONS ──────────────────
  // Scans all active reorder rules, compares current stock vs reorderPoint,
  // and returns a list of purchase suggestions for products needing restock.
  async checkAndSuggest() {
    const rules = await this.prisma.reorderRule.findMany({
      where: { isActive: true },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            stockQuantity: true,
            unitPrice: true,
          },
        },
        preferredSupplier: { select: { id: true, name: true } },
      },
    });

    const suggestions: {
      ruleId: string;
      productId: string;
      productCode: string;
      productName: string;
      currentStock: number;
      reorderPoint: number;
      suggestedQty: number;
      maxStock: number | null;
      preferredSupplier: { id: string; name: string } | null;
      isAutomatic: boolean;
    }[] = [];

    for (const rule of rules) {
      const currentStock = Number(rule.product.stockQuantity);
      const reorderPoint = Number(rule.reorderPoint);

      if (currentStock <= reorderPoint) {
        let suggestedQty = Number(rule.reorderQty);

        // If maxStock is set, calculate exact qty to reach it
        if (rule.maxStock) {
          const maxStock = Number(rule.maxStock);
          const toMax = maxStock - currentStock;
          suggestedQty = Math.max(suggestedQty, toMax);
        }

        suggestions.push({
          ruleId: rule.id,
          productId: rule.product.id,
          productCode: rule.product.code,
          productName: rule.product.name,
          currentStock,
          reorderPoint,
          suggestedQty,
          maxStock: rule.maxStock ? Number(rule.maxStock) : null,
          preferredSupplier: rule.preferredSupplier
            ? {
                id: rule.preferredSupplier.id,
                name: rule.preferredSupplier.name,
              }
            : null,
          isAutomatic: rule.isAutomatic,
        });

        // Update lastTriggeredAt
        await this.prisma.reorderRule.update({
          where: { id: rule.id },
          data: { lastTriggeredAt: new Date() },
        });
      }
    }

    return {
      scannedRules: rules.length,
      suggestionsCount: suggestions.length,
      suggestions,
    };
  }
}
