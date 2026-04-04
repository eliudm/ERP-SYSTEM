import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE SUPPLIER ─────────────────────────────────────
  async create(dto: CreateSupplierDto) {
    if (dto.email) {
      const existing = await this.prisma.supplier.findFirst({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('Supplier with this email already exists');
      }
    }

    return this.prisma.supplier.create({ data: dto });
  }

  // ─── GET ALL SUPPLIERS ───────────────────────────────────
  async findAll(search?: string) {
    return this.prisma.supplier.findMany({
      where: {
        isActive: true,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { name: 'asc' },
    });
  }

  // ─── GET ONE SUPPLIER ────────────────────────────────────
  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  // ─── UPDATE SUPPLIER ─────────────────────────────────────
  async update(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  // ─── DEACTIVATE SUPPLIER ─────────────────────────────────
  async deactivate(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── SUPPLIER STATEMENT ──────────────────────────────────
  async getStatement(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          where: { status: { not: 'VOID' } },
          orderBy: { orderDate: 'asc' },
        },
      },
    });

    if (!supplier) throw new NotFoundException('Supplier not found');

    const totalOrdered = supplier.purchaseOrders.reduce(
      (sum, po) => sum + Number(po.total),
      0,
    );

    const totalReceived = supplier.purchaseOrders
      .filter((po) => po.status === 'RECEIVED')
      .reduce((sum, po) => sum + Number(po.total), 0);

    return {
      supplier,
      summary: {
        totalOrders: supplier.purchaseOrders.length,
        totalOrdered,
        totalReceived,
        pendingValue: totalOrdered - totalReceived,
      },
    };
  }
}
