import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

@Injectable()
export class AppraisalsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    employeeId: string;
    reviewerId: string;
    period: string;
    criteria?: { name: string; weight?: number }[];
  }) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: data.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.appraisal.create({
      data: {
        employeeId: data.employeeId,
        reviewerId: data.reviewerId,
        period: data.period,
        items: data.criteria
          ? {
              create: data.criteria.map((c) => ({
                criteria: c.name,
                weight: c.weight ?? 1,
              })),
            }
          : undefined,
      },
      include: { employee: true, items: true },
    });
  }

  findAll(employeeId?: string, period?: string, status?: string) {
    return this.prisma.appraisal.findMany({
      where: {
        ...(employeeId && { employeeId }),
        ...(period && { period }),
        ...(status && { status: status as any }),
      },
      include: { employee: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const appraisal = await this.prisma.appraisal.findUnique({
      where: { id },
      include: { employee: true, items: true },
    });
    if (!appraisal) throw new NotFoundException('Appraisal not found');
    return appraisal;
  }

  async scoreItem(
    appraisalId: string,
    itemId: string,
    score: number,
    achievement?: string,
  ) {
    const appraisal = await this.findOne(appraisalId);
    if (appraisal.status === 'APPROVED') {
      throw new BadRequestException(
        'Appraisal is approved and cannot be modified',
      );
    }

    return this.prisma.appraisalItem.update({
      where: { id: itemId },
      data: { score, achievement },
    });
  }

  async submit(id: string) {
    const appraisal = await this.findOne(id);
    if (appraisal.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT appraisals can be submitted');
    }

    const items = appraisal.items;
    const totalWeight = items.reduce(
      (s: number, i: any) => s + Number(i.weight || 1),
      0,
    );
    const totalScore = items.reduce(
      (s: number, i: any) => s + Number(i.score || 0) * Number(i.weight || 1),
      0,
    );
    const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    return this.prisma.appraisal.update({
      where: { id },
      data: { status: 'SUBMITTED', overallScore, submittedAt: new Date() },
      include: { employee: true, items: true },
    });
  }

  async approve(id: string, comments?: string) {
    const appraisal = await this.findOne(id);
    if (appraisal.status !== 'SUBMITTED')
      throw new BadRequestException(
        'Appraisal must be submitted before approval',
      );

    return this.prisma.appraisal.update({
      where: { id },
      data: { status: 'APPROVED', comments, approvedAt: new Date() },
      include: { employee: true, items: true },
    });
  }

  async addItem(
    appraisalId: string,
    data: { name: string; target?: string; weight?: number },
  ) {
    const appraisal = await this.findOne(appraisalId);
    if (appraisal.status === 'APPROVED')
      throw new BadRequestException('Cannot modify an approved appraisal');

    return this.prisma.appraisalItem.create({
      data: {
        appraisalId,
        criteria: data.name,
        target: data.target,
        weight: data.weight ?? 1,
      },
    });
  }
}
