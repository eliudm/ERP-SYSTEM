import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateProductDto, UpdateProductDto } from '../dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE PRODUCT ──────────────────────────────────────
  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(
        `Product with code "${dto.code}" already exists`,
      );
    }

    if (dto.categoryId) {
      const category = await this.prisma.productCategory.findUnique({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new BadRequestException('Selected category not found');
      }
    }

    return this.prisma.product.create({
      data: dto,
      include: { category: true },
    });
  }

  // ─── GET ALL PRODUCTS ────────────────────────────────────
  async findAll(search?: string, categoryId?: string) {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(categoryId && { categoryId }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: { category: true },
      orderBy: { code: 'asc' },
    });
  }

  // ─── GET ONE PRODUCT ─────────────────────────────────────
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        stockMovements: {
          include: { warehouse: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  // ─── FIND BY BARCODE ──────────────────────────────────────
  async findByBarcode(barcode: string) {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: { category: true },
    });

    if (!product)
      throw new NotFoundException(`No product found with barcode "${barcode}"`);
    return product;
  }

  // ─── UPDATE PRODUCT ──────────────────────────────────────
  async update(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    if (dto.categoryId) {
      const category = await this.prisma.productCategory.findUnique({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new BadRequestException('Selected category not found');
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
  }

  // ─── DEACTIVATE PRODUCT ──────────────────────────────────
  async deactivate(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── GET LOW STOCK PRODUCTS ──────────────────────────────
  async getLowStock() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
    });

    return products.filter(
      (p) => Number(p.stockQuantity) <= Number(p.reorderLevel),
    );
  }

  // ─── GET STOCK VALUATION ─────────────────────────────────
  async getStockValuation() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
    });

    const items = products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      stockQuantity: Number(p.stockQuantity),
      unitPrice: Number(p.unitPrice),
      totalValue: Number(p.stockQuantity) * Number(p.unitPrice),
    }));

    const totalValue = items.reduce((sum, p) => sum + p.totalValue, 0);

    return { items, totalValue };
  }
}
