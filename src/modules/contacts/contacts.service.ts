import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ContactType } from '@prisma/client';

export class CreateContactDto {
  type?: ContactType;
  name: string;
  companyId?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  taxId?: string;
  jobPosition?: string;
  partnerLevel?: string;
  tags?: string[];
  notes?: string;
}

export class UpdateContactDto {
  type?: ContactType;
  name?: string;
  companyId?: string | null;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  taxId?: string;
  jobPosition?: string;
  partnerLevel?: string;
  tags?: string[];
  notes?: string;
  isActive?: boolean;
}

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string, type?: ContactType) {
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
    return this.prisma.contact.create({
      data: {
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
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.findOne(id);
    return this.prisma.contact.update({
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
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.contact.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getCompanies(search?: string) {
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
