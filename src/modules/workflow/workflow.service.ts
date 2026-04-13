import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalEntityType, ApprovalStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WorkflowService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async createApprovalRequest(
    entityType: ApprovalEntityType,
    entityId: string,
    requestedById?: string,
    comments?: string,
    dueAt?: Date,
  ) {
    await this.ensureEntityExists(entityType, entityId);
    const { assignedRole, amountSnapshot } = await this.resolveApprovalRouting(
      entityType,
      entityId,
    );

    const existingPending = await this.prisma.approvalRequest.findFirst({
      where: {
        entityType,
        entityId,
        status: ApprovalStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new ConflictException('An approval request is already pending');
    }

    const effectiveDueAt = dueAt ?? this.computeDefaultDueAt(entityType);

    const created = await this.prisma.approvalRequest.create({
      data: {
        entityType,
        entityId,
        assignedRole,
        amountSnapshot,
        requestedById: requestedById ?? null,
        comments,
        dueAt: effectiveDueAt,
      },
    });

    await this.notificationsService.notifyApprovalRequired(
      entityType,
      entityId,
      assignedRole,
      effectiveDueAt,
    );

    return created;
  }

  async escalateOverduePendingRequests() {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const overdue = await this.prisma.approvalRequest.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        dueAt: { not: null, lte: now },
        OR: [{ lastEscalatedAt: null }, { lastEscalatedAt: { lt: yesterday } }],
      },
      orderBy: { dueAt: 'asc' },
    });

    let escalated = 0;

    for (const request of overdue) {
      await this.notificationsService.notifyApprovalOverdue(
        request.entityType,
        request.entityId,
        request.dueAt,
      );

      await this.prisma.approvalRequest.update({
        where: { id: request.id },
        data: {
          escalationCount: { increment: 1 },
          lastEscalatedAt: now,
        },
      });

      escalated += 1;
    }

    return {
      scanned: overdue.length,
      escalated,
      runAt: now.toISOString(),
    };
  }

  async approveRequest(
    id: string,
    approvedById?: string,
    comments?: string,
    approverRole?: Role,
  ) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Approval request not found');

    const assignedRole = (request as any).assignedRole as string | undefined;
    if (assignedRole && approverRole !== (assignedRole as Role)) {
      throw new ForbiddenException(
        `This request must be approved by ${assignedRole}`,
      );
    }

    if (request.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be approved');
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: ApprovalStatus.APPROVED,
        approvedById: approvedById ?? null,
        approvedAt: new Date(),
        comments: comments ?? request.comments,
      },
    });

    const requester = request.requestedById
      ? await this.prisma.user.findUnique({
          where: { id: request.requestedById },
          select: { email: true },
        })
      : null;

    await this.notificationsService.notifyApprovalDecision(
      'APPROVED',
      request.entityType,
      request.entityId,
      requester?.email,
    );

    return updated;
  }

  async rejectRequest(
    id: string,
    rejectedById?: string,
    reason?: string,
    approverRole?: Role,
  ) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Approval request not found');

    const assignedRole = (request as any).assignedRole as string | undefined;
    if (assignedRole && approverRole !== (assignedRole as Role)) {
      throw new ForbiddenException(
        `This request must be reviewed by ${assignedRole}`,
      );
    }

    if (request.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: ApprovalStatus.REJECTED,
        rejectedById: rejectedById ?? null,
        rejectedAt: new Date(),
        rejectionReason: reason ?? 'Rejected by approver',
      },
    });

    const requester = request.requestedById
      ? await this.prisma.user.findUnique({
          where: { id: request.requestedById },
          select: { email: true },
        })
      : null;

    await this.notificationsService.notifyApprovalDecision(
      'REJECTED',
      request.entityType,
      request.entityId,
      requester?.email,
      reason,
    );

    return updated;
  }

  findRequests(
    entityType?: ApprovalEntityType,
    entityId?: string,
    status?: ApprovalStatus,
  ) {
    return this.prisma.approvalRequest.findMany({
      where: {
        ...(entityType && { entityType }),
        ...(entityId && { entityId }),
        ...(status && { status }),
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async assertApprovalIfExists(
    entityType: ApprovalEntityType,
    entityId: string,
  ) {
    const latest = await this.prisma.approvalRequest.findFirst({
      where: { entityType, entityId },
      orderBy: { requestedAt: 'desc' },
    });

    if (!latest) return null;

    if (latest.status === ApprovalStatus.PENDING) {
      throw new BadRequestException(
        'This document has a pending approval request',
      );
    }

    if (latest.status === ApprovalStatus.REJECTED) {
      throw new BadRequestException(
        `Approval was rejected: ${latest.rejectionReason ?? 'No reason provided'}`,
      );
    }

    return latest.status === ApprovalStatus.APPROVED ? latest : null;
  }

  async consumeApprovedRequest(
    entityType: ApprovalEntityType,
    entityId: string,
  ) {
    const approved = await this.prisma.approvalRequest.findFirst({
      where: {
        entityType,
        entityId,
        status: ApprovalStatus.APPROVED,
      },
      orderBy: { approvedAt: 'desc' },
    });

    if (!approved) return null;

    return this.prisma.approvalRequest.update({
      where: { id: approved.id },
      data: {
        status: ApprovalStatus.CONSUMED,
        consumedAt: new Date(),
      },
    });
  }

  private async ensureEntityExists(
    entityType: ApprovalEntityType,
    entityId: string,
  ): Promise<void> {
    let exists = false;

    if (entityType === ApprovalEntityType.SALES_INVOICE) {
      exists =
        (await this.prisma.salesInvoice.count({ where: { id: entityId } })) > 0;
    } else if (entityType === ApprovalEntityType.PURCHASE_ORDER) {
      exists =
        (await this.prisma.purchaseOrder.count({ where: { id: entityId } })) >
        0;
    } else if (entityType === ApprovalEntityType.PAYROLL) {
      exists =
        (await this.prisma.payroll.count({ where: { id: entityId } })) > 0;
    }

    if (!exists) {
      throw new NotFoundException(
        `Cannot create request: ${entityType} ${entityId} was not found`,
      );
    }
  }

  private computeDefaultDueAt(entityType: ApprovalEntityType): Date {
    const now = new Date();
    const due = new Date(now);

    if (entityType === ApprovalEntityType.SALES_INVOICE) {
      due.setHours(due.getHours() + 8);
      return due;
    }

    if (entityType === ApprovalEntityType.PURCHASE_ORDER) {
      due.setHours(due.getHours() + 12);
      return due;
    }

    due.setDate(due.getDate() + 1);
    return due;
  }

  private async resolveApprovalRouting(
    entityType: ApprovalEntityType,
    entityId: string,
  ): Promise<{ assignedRole: Role; amountSnapshot: number }> {
    const amount = await this.resolveEntityAmount(entityType, entityId);

    if (entityType === ApprovalEntityType.SALES_INVOICE) {
      return {
        assignedRole: amount >= 500000 ? Role.ADMIN : Role.ACCOUNTANT,
        amountSnapshot: amount,
      };
    }

    if (entityType === ApprovalEntityType.PURCHASE_ORDER) {
      return {
        assignedRole: amount >= 300000 ? Role.ADMIN : Role.PROCUREMENT_OFFICER,
        amountSnapshot: amount,
      };
    }

    return {
      assignedRole: amount >= 800000 ? Role.ADMIN : Role.HR_MANAGER,
      amountSnapshot: amount,
    };
  }

  private async resolveEntityAmount(
    entityType: ApprovalEntityType,
    entityId: string,
  ): Promise<number> {
    if (entityType === ApprovalEntityType.SALES_INVOICE) {
      const row = await this.prisma.salesInvoice.findUnique({
        where: { id: entityId },
        select: { total: true },
      });
      return Number(row?.total ?? 0);
    }

    if (entityType === ApprovalEntityType.PURCHASE_ORDER) {
      const row = await this.prisma.purchaseOrder.findUnique({
        where: { id: entityId },
        select: { total: true },
      });
      return Number(row?.total ?? 0);
    }

    const row = await this.prisma.payroll.findUnique({
      where: { id: entityId },
      select: { totalNet: true },
    });
    return Number(row?.totalNet ?? 0);
  }
}
