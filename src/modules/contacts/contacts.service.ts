import { Injectable, NotFoundException } from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { PrismaService } from '../../prisma.service';
import { getCurrentTenantId } from '../../tenant-context';
import { ContactType } from '@prisma/client';

export class CreateContactDto {
  @IsOptional()
  @IsEnum(ContactType)
  type?: ContactType;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  street2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  jobPosition?: string;

  @IsOptional()
  @IsString()
  partnerLevel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateContactDto {
  @IsOptional()
  @IsEnum(ContactType)
  type?: ContactType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  companyId?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  street2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  jobPosition?: string;

  @IsOptional()
  @IsString()
  partnerLevel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  private buildAddress(contact: {
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

  private async syncContactToCustomer(contact: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
    street?: string | null;
    street2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
    taxId?: string | null;
    isActive: boolean;
  }) {
    const address = this.buildAddress(contact);
    await this.prisma.customer.upsert({
      where: { id: contact.id },
      create: {
        id: contact.id,
        tenantId: getCurrentTenantId()!,
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

  findAll(search?: string, type?: ContactType) {
    return this.prisma.contact.findMany({
      where: {
        isActive: true,
        ...(type && { type }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { contacts: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        contacts: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            jobPosition: true,
            type: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async create(dto: CreateContactDto) {
    const contact = await this.prisma.contact.create({
      data: {
        tenantId: getCurrentTenantId()!,
        type: dto.type ?? 'INDIVIDUAL',
        name: dto.name,
        companyId: dto.companyId || null,
        email: dto.email,
        phone: dto.phone,
        mobile: dto.mobile,
        website: dto.website,
        street: dto.street,
        street2: dto.street2,
        city: dto.city,
        state: dto.state,
        zip: dto.zip,
        country: dto.country,
        taxId: dto.taxId,
        jobPosition: dto.jobPosition,
        partnerLevel: dto.partnerLevel,
        tags: dto.tags ?? [],
        notes: dto.notes,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });
    await this.syncContactToCustomer(contact);
    return contact;
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.findOne(id);
    const contact = await this.prisma.contact.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.companyId !== undefined && { companyId: dto.companyId }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.mobile !== undefined && { mobile: dto.mobile }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.street !== undefined && { street: dto.street }),
        ...(dto.street2 !== undefined && { street2: dto.street2 }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.zip !== undefined && { zip: dto.zip }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.jobPosition !== undefined && { jobPosition: dto.jobPosition }),
        ...(dto.partnerLevel !== undefined && {
          partnerLevel: dto.partnerLevel,
        }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        company: { select: { id: true, name: true } },
        contacts: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            jobPosition: true,
            type: true,
          },
        },
      },
    });
    await this.syncContactToCustomer(contact);
    return contact;
  }

  async remove(id: string) {
    await this.findOne(id);
    const contact = await this.prisma.contact.update({
      where: { id },
      data: { isActive: false },
    });
    await this.prisma.customer.updateMany({
      where: { id: contact.id },
      data: { isActive: false },
    });
    return contact;
  }

  getCompanies(search?: string) {
    return this.prisma.contact.findMany({
      where: {
        type: 'COMPANY',
        isActive: true,
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
