import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { LeadActivityType, LeadStage } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateLeadDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsNumber()
  estimatedValue?: number;

  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsNumber()
  estimatedValue?: number;

  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLeadStageDto {
  @IsEnum(LeadStage)
  stage!: LeadStage;
}

export class CreateLeadActivityDto {
  @IsEnum(LeadActivityType)
  type!: LeadActivityType;

  @IsString()
  summary!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  createLead(dto: CreateLeadDto, userId?: string) {
    return this.prisma.crmLead.create({
      data: {
        title: dto.title,
        companyName: dto.companyName,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        estimatedValue: dto.estimatedValue,
        stage: dto.stage ?? LeadStage.NEW,
        probability: dto.probability ?? 0,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : null,
        source: dto.source,
        notes: dto.notes,
        createdById: userId ?? null,
      },
    });
  }

  findLeads(stage?: LeadStage, search?: string) {
    return this.prisma.crmLead.findMany({
      where: {
        ...(stage && { stage }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { companyName: { contains: search, mode: 'insensitive' } },
            { contactName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findLead(id: string) {
    const lead = await this.prisma.crmLead.findUnique({
      where: { id },
      include: {
        activities: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async updateLead(id: string, dto: UpdateLeadDto) {
    await this.findLead(id);

    return this.prisma.crmLead.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.estimatedValue !== undefined && {
          estimatedValue: dto.estimatedValue,
        }),
        ...(dto.stage !== undefined && { stage: dto.stage }),
        ...(dto.probability !== undefined && { probability: dto.probability }),
        ...(dto.expectedCloseDate !== undefined && {
          expectedCloseDate: dto.expectedCloseDate
            ? new Date(dto.expectedCloseDate)
            : null,
        }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async updateStage(id: string, stage: LeadStage) {
    await this.findLead(id);
    return this.prisma.crmLead.update({ where: { id }, data: { stage } });
  }

  async addActivity(id: string, dto: CreateLeadActivityDto, userId?: string) {
    await this.findLead(id);

    return this.prisma.crmLeadActivity.create({
      data: {
        leadId: id,
        type: dto.type,
        summary: dto.summary,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        createdById: userId ?? null,
      },
    });
  }

  async getPipeline() {
    const leads = await this.prisma.crmLead.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        companyName: true,
        contactName: true,
        estimatedValue: true,
        probability: true,
        stage: true,
      },
    });

    const grouped = Object.values(LeadStage).reduce(
      (acc, stage) => {
        acc[stage] = leads.filter((lead) => lead.stage === stage);
        return acc;
      },
      {} as Record<LeadStage, typeof leads>,
    );

    return grouped;
  }
}
