import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from '../dto';

@Injectable()
export class ProductCategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductCategoryDto) {
    const normalizedName = dto.name.trim();

    const existing = await this.prisma.productCategory.findUnique({
      where: { name: normalizedName },
    });

    if (existing) {
      throw new ConflictException('Category already exists');
    }

    return this.prisma.productCategory.create({
      data: { name: normalizedName, color: dto.color, icon: dto.icon },
    });
  }

  findAll() {
    return this.prisma.productCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateProductCategoryDto) {
    const existing = await this.prisma.productCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    if (dto.name) {
      const nameConflict = await this.prisma.productCategory.findFirst({
        where: { name: dto.name.trim(), id: { not: id } },
      });
      if (nameConflict) {
        throw new ConflictException('Category name already exists');
      }
    }

    return this.prisma.productCategory.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.color !== undefined && { color: dto.color || null }),
        ...(dto.icon !== undefined && { icon: dto.icon || null }),
      },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category._count.products > 0) {
      throw new ConflictException(
        `Cannot delete: ${category._count.products} product(s) use this category`,
      );
    }

    await this.prisma.productCategory.delete({ where: { id } });
  }
}
