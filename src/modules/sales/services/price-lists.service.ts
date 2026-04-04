import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import {
  CreatePriceListDto,
  CreatePriceListItemDto,
} from '../dto/create-price-list.dto';

@Injectable()
export class PriceListsService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE ──────────────────────────────────────────────
  async create(dto: CreatePriceListDto) {
    if (dto.isDefault) {
      // Unset any existing default
      await this.prisma.priceList.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.priceList.create({
      data: {
        ...dto,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      },
    });
  }

  // ─── LIST ────────────────────────────────────────────────
  async findAll() {
    return this.prisma.priceList.findMany({
      where: { isActive: true },
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' },
    });
  }

  // ─── GET ONE ─────────────────────────────────────────────
  async findOne(id: string) {
    const pl = await this.prisma.priceList.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!pl) throw new NotFoundException('Price list not found');
    return pl;
  }

  // ─── UPDATE ──────────────────────────────────────────────
  async update(id: string, dto: Partial<CreatePriceListDto>) {
    return this.prisma.priceList.update({
      where: { id },
      data: {
        ...dto,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      },
    });
  }

  // ─── DEACTIVATE ──────────────────────────────────────────
  async deactivate(id: string) {
    return this.prisma.priceList.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── ADD ITEM ────────────────────────────────────────────
  async addItem(priceListId: string, dto: CreatePriceListItemDto) {
    const pl = await this.prisma.priceList.findUnique({
      where: { id: priceListId },
    });
    if (!pl) throw new NotFoundException('Price list not found');

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.priceListItem.upsert({
      where: {
        priceListId_productId_minQty: {
          priceListId,
          productId: dto.productId,
          minQty: dto.minQty || 1,
        },
      },
      create: {
        priceListId,
        productId: dto.productId,
        price: dto.price,
        minQty: dto.minQty || 1,
      },
      update: { price: dto.price },
    });
  }

  // ─── GET ITEMS ───────────────────────────────────────────
  async getItems(priceListId: string) {
    return this.prisma.priceListItem.findMany({
      where: { priceListId },
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    });
  }

  // ─── DELETE ITEM ─────────────────────────────────────────
  async removeItem(itemId: string) {
    return this.prisma.priceListItem.delete({ where: { id: itemId } });
  }

  // ─── RESOLVE EFFECTIVE PRICE ─────────────────────────────
  async getEffectivePrice(productId: string, qty = 1) {
    const today = new Date();

    // Find the best price list item for this product and quantity
    const item = await this.prisma.priceListItem.findFirst({
      where: {
        productId,
        minQty: { lte: qty },
        priceList: {
          isActive: true,
          OR: [{ validFrom: null }, { validFrom: { lte: today } }],
          AND: [{ OR: [{ validTo: null }, { validTo: { gte: today } }] }],
        },
      },
      include: { priceList: true },
      orderBy: [{ minQty: 'desc' }, { priceList: { isDefault: 'desc' } }],
    });

    if (!item) {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });
      return {
        price: product ? Number(product.unitPrice) : null,
        source: 'product_default',
      };
    }

    return {
      price: Number(item.price),
      priceListId: item.priceListId,
      priceListName: item.priceList.name,
      source: 'price_list',
    };
  }
}
