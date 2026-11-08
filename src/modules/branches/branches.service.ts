import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { getCurrentTenantId } from '../../tenant-context';
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
    // findFirst, not findUnique: code is only unique per-tenant now, and the
    // tenant filter is applied automatically (see tenant-scoping.extension.ts)
    const exists = await this.prisma.branch.findFirst({
      where: { code: dto.code },
    });
    if (exists) {
      throw new ConflictException(`Branch code "${dto.code}" already exists`);
    }

    return this.prisma.branch.create({
      data: { ...dto, tenantId: getCurrentTenantId()! },
    });
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
      const existing = await this.prisma.branch.findFirst({
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

  // Revenue/invoice comparison across every active branch for one date
  // range — a single groupBy instead of looping getReport() per branch, so
  // this stays one query regardless of branch count.
  async getComparison(from?: string, to?: string) {
    const startDate = from
      ? new Date(from)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = to ? new Date(to) : new Date();

    const [branches, invoices] = await Promise.all([
      this.prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      // Use findMany so we can resolve branchId from multiple sources:
      // invoice.branchId (set at approval) → warehouse.branchId → cashier.branchId
      // This handles warehouses that were created before being linked to a branch.
      (this.prisma.salesInvoice.findMany as any)({
        where: {
          invoiceDate: { gte: startDate, lte: endDate },
          status: { in: ['APPROVED', 'PAID'] },
        },
        select: {
          branchId: true,
          status: true,
          total: true,
          warehouse: { select: { branchId: true } },
          cashier: { select: { branchId: true } },
        },
      }) as Promise<Array<{
        branchId: string | null;
        status: string;
        total: any;
        warehouse: { branchId: string | null } | null;
        cashier: { branchId: string | null } | null;
      }>>,
    ]);

    const totalsByBranch = new Map<
      string,
      { invoices: number; paidInvoices: number; revenue: number }
    >();

    for (const inv of invoices) {
      // Resolve branch: direct branchId → warehouse's branch → cashier's branch
      const resolvedBranchId =
        inv.branchId ??
        inv.warehouse?.branchId ??
        inv.cashier?.branchId ??
        null;
      if (!resolvedBranchId) continue;

      const existing = totalsByBranch.get(resolvedBranchId) ?? {
        invoices: 0,
        paidInvoices: 0,
        revenue: 0,
      };
      existing.invoices += 1;
      existing.revenue += Number(inv.total ?? 0);
      if (inv.status === 'PAID') existing.paidInvoices += 1;
      totalsByBranch.set(resolvedBranchId, existing);
    }

    const results = branches
      .map((branch) => ({
        branchId: branch.id,
        name: branch.name,
        code: branch.code,
        totals: totalsByBranch.get(branch.id) ?? {
          invoices: 0,
          paidInvoices: 0,
          revenue: 0,
        },
      }))
      .sort((a, b) => b.totals.revenue - a.totals.revenue);

    return {
      period: { from: startDate, to: endDate },
      branches: results,
    };
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
