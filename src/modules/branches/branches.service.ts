import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBranchDto) {
    const exists = await this.prisma.branch.findUnique({
      where: { code: dto.code },
    });
    if (exists) {
      throw new ConflictException(`Branch code "${dto.code}" already exists`);
    }

    return this.prisma.branch.create({ data: dto });
  }

  findAll() {
    return this.prisma.branch.findMany({
      include: { _count: { select: { warehouses: true, invoices: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        warehouses: {
          where: { isActive: true },
          select: { id: true, name: true, location: true },
        },
      },
    });

    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.branch.findUnique({
        where: { code: dto.code },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Branch code "${dto.code}" already exists`);
      }
    }

    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getReport(id: string, from?: string, to?: string) {
    await this.findOne(id);

    const startDate = from
      ? new Date(from)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = to ? new Date(to) : new Date();

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        branchId: id,
        invoiceDate: { gte: startDate, lte: endDate },
        status: { in: ['APPROVED', 'PAID'] },
      },
      select: {
        total: true,
        status: true,
      },
    });

    const revenue = invoices.reduce((sum, i) => sum + Number(i.total), 0);
    const paidCount = invoices.filter((i) => i.status === 'PAID').length;

    return {
      branchId: id,
      period: { from: startDate, to: endDate },
      totals: {
        invoices: invoices.length,
        paidInvoices: paidCount,
        revenue,
      },
    };
  }
}
