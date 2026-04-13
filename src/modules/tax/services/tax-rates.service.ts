import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

@Injectable()
export class TaxRatesService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    rate: number;
    type: string;
    isDefault?: boolean;
    glAccountId?: string;
  }) {
    if (data.isDefault) {
      // Un-default existing default for this type
      await this.prisma.taxRate.updateMany({
        where: { type: data.type as any, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.taxRate.create({
      data: { ...data, type: data.type as any },
    });
  }

  findAll(type?: string, activeOnly = true) {
    return this.prisma.taxRate.findMany({
      where: {
        ...(type && { type: type as any }),
        ...(activeOnly && { isActive: true }),
      },
      include: { glAccount: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const rate = await this.prisma.taxRate.findUnique({
      where: { id },
      include: { glAccount: true },
    });
    if (!rate) throw new NotFoundException('Tax rate not found');
    return rate;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      rate: number;
      isDefault: boolean;
      glAccountId: string;
      isActive: boolean;
    }>,
  ) {
    await this.findOne(id);
    if (data.isDefault) {
      const existing = await this.prisma.taxRate.findUnique({ where: { id } });
      if (existing) {
        await this.prisma.taxRate.updateMany({
          where: { type: existing.type, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
    }
    return this.prisma.taxRate.update({ where: { id }, data });
  }

  async setDefault(id: string) {
    return this.update(id, { isDefault: true });
  }

  async deactivate(id: string) {
    return this.update(id, { isActive: false });
  }
}
