import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from '../dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE CUSTOMER ─────────────────────────────────────
  async create(dto: CreateCustomerDto) {
    // Check duplicate email
    if (dto.email) {
      const existing = await this.prisma.customer.findFirst({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('Customer with this email already exists');
      }
    }

    return this.prisma.customer.create({ data: dto });
  }

  // ─── GET ALL CUSTOMERS ───────────────────────────────────
  async findAll(search?: string) {
    return this.prisma.customer.findMany({
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

  // ─── GET ONE CUSTOMER ────────────────────────────────────
  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  // ─── UPDATE CUSTOMER ─────────────────────────────────────
  async update(id: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.customer.update({
      where: { id },
      data: dto,
    });
  }

  // ─── DEACTIVATE CUSTOMER ─────────────────────────────────
  async deactivate(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── GET CUSTOMER STATEMENT ──────────────────────────────
  async getStatement(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          where: { status: { not: 'VOID' } },
          include: { items: true },
          orderBy: { invoiceDate: 'asc' },
        },
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    const totalBilled = customer.invoices.reduce(
      (sum, inv) => sum + Number(inv.total),
      0,
    );

    const totalPaid = customer.invoices
      .filter((inv) => inv.status === 'PAID')
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    return {
      customer,
      summary: {
        totalInvoices: customer.invoices.length,
        totalBilled,
        totalPaid,
        outstandingBalance: totalBilled - totalPaid,
      },
    };
  }
}
