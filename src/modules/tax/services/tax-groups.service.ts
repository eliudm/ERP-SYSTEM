import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

@Injectable()
export class TaxGroupsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    description?: string;
    taxRateIds: string[];
  }) {
    return this.prisma.taxGroup.create({ data });
  }

  async findAll() {
    const groups = await this.prisma.taxGroup.findMany({
      orderBy: { name: 'asc' },
    });
    // Enrich with tax rates
    const taxRates = await this.prisma.taxRate.findMany({
      where: { isActive: true },
    });
    const rateMap = new Map(taxRates.map((r) => [r.id, r]));

    return groups.map((g) => ({
      ...g,
      taxRates: g.taxRateIds.map((id) => rateMap.get(id)).filter(Boolean),
    }));
  }

  async findOne(id: string) {
    const group = await this.prisma.taxGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Tax group not found');

    const taxRates = await this.prisma.taxRate.findMany({
      where: { id: { in: group.taxRateIds } },
    });
    return { ...group, taxRates };
  }

  async update(
    id: string,
    data: Partial<{ name: string; description: string; taxRateIds: string[] }>,
  ) {
    await this.findOne(id);
    return this.prisma.taxGroup.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.taxGroup.delete({ where: { id } });
  }

  async getTotalRate(groupId: string): Promise<number> {
    const group = await this.findOne(groupId);
    return (group as any).taxRates.reduce(
      (s: number, r: any) => s + Number(r.rate),
      0,
    );
  }
}
