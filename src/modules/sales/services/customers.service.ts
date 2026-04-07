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

  private buildAddressFromContact(contact: {
    street?: string | null;
    street2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  }) {
    return [
      contact.street,
      contact.street2,
      contact.city,
      contact.state,
      contact.zip,
      contact.country,
    ]
      .filter(Boolean)
      .join(', ');
  }

  private async syncCustomerFromContact(contactId: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });
    if (!contact) return;

    const address = this.buildAddressFromContact(contact);
    await this.prisma.customer.upsert({
      where: { id: contact.id },
      create: {
        id: contact.id,
        name: contact.name,
        email: contact.email ?? undefined,
        phone: contact.phone ?? contact.mobile ?? undefined,
        address: address || undefined,
        taxPin: contact.taxId ?? undefined,
        isActive: contact.isActive,
      },
      update: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone ?? contact.mobile,
        address: address || null,
        taxPin: contact.taxId,
        isActive: contact.isActive,
      },
    });
  }

  private async syncContactsToCustomers(search?: string) {
    const contacts = await this.prisma.contact.findMany({
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
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        mobile: true,
        street: true,
        street2: true,
        city: true,
        state: true,
        zip: true,
        country: true,
        taxId: true,
        isActive: true,
      },
    });

    if (!contacts.length) return;

    await this.prisma.$transaction(
      contacts.map((contact) => {
        const address = this.buildAddressFromContact(contact);
        return this.prisma.customer.upsert({
          where: { id: contact.id },
          create: {
            id: contact.id,
            name: contact.name,
            email: contact.email ?? undefined,
            phone: contact.phone ?? contact.mobile ?? undefined,
            address: address || undefined,
            taxPin: contact.taxId ?? undefined,
            isActive: contact.isActive,
          },
          update: {
            name: contact.name,
            email: contact.email,
            phone: contact.phone ?? contact.mobile,
            address: address || null,
            taxPin: contact.taxId,
            isActive: contact.isActive,
          },
        });
      }),
    );
  }

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

    const customer = await this.prisma.customer.create({ data: dto });

    await this.prisma.contact.upsert({
      where: { id: customer.id },
      create: {
        id: customer.id,
        type: 'INDIVIDUAL',
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        street: customer.address,
        taxId: customer.taxPin,
        isActive: customer.isActive,
      },
      update: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        street: customer.address,
        taxId: customer.taxPin,
        isActive: customer.isActive,
      },
    });

    return customer;
  }

  // ─── GET ALL CUSTOMERS ───────────────────────────────────
  async findAll(search?: string) {
    await this.syncContactsToCustomers(search);
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
    await this.syncCustomerFromContact(id);
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

    const updatedCustomer = await this.prisma.customer.update({
      where: { id },
      data: dto,
    });

    await this.prisma.contact.upsert({
      where: { id: updatedCustomer.id },
      create: {
        id: updatedCustomer.id,
        type: 'INDIVIDUAL',
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        phone: updatedCustomer.phone,
        street: updatedCustomer.address,
        taxId: updatedCustomer.taxPin,
        isActive: updatedCustomer.isActive,
      },
      update: {
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        phone: updatedCustomer.phone,
        street: updatedCustomer.address,
        taxId: updatedCustomer.taxPin,
        isActive: updatedCustomer.isActive,
      },
    });

    return updatedCustomer;
  }

  // ─── DEACTIVATE CUSTOMER ─────────────────────────────────
  async deactivate(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');

    const updatedCustomer = await this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });

    await this.prisma.contact.updateMany({
      where: { id },
      data: { isActive: false },
    });

    return updatedCustomer;
  }

  // ─── GET CUSTOMER STATEMENT ──────────────────────────────
  async getStatement(id: string) {
    await this.syncCustomerFromContact(id);
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
