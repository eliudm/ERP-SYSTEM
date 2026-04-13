import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface CreateAuditLogInput {
  userId?: string | null;
  action: string;
  tableName: string;
  recordId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(input: CreateAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        tableName: input.tableName,
        recordId: input.recordId ?? null,
        oldValues: (input.oldValues as any) ?? undefined,
        newValues: (input.newValues as any) ?? undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async findAll(page = 1, limit = 50, tableName?: string, action?: string) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        where: {
          ...(tableName && { tableName }),
          ...(action && { action }),
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({
        where: {
          ...(tableName && { tableName }),
          ...(action && { action }),
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
