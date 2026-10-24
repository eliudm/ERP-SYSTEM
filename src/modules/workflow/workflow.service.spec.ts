import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { PrismaService } from '../../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApprovalEntityType, ApprovalStatus, Role } from '@prisma/client';

const mockPrisma = () => ({
  approvalRequest: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  salesInvoice: {
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  purchaseOrder: {
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  payroll: {
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
});

const mockNotificationsService = () => ({
  notifyApprovalRequired: jest.fn(),
  notifyApprovalOverdue: jest.fn(),
  notifyApprovalDecision: jest.fn(),
});

describe('WorkflowService', () => {
  let service: WorkflowService;
  let prisma: ReturnType<typeof mockPrisma>;
  let notificationsService: ReturnType<typeof mockNotificationsService>;

  beforeEach(async () => {
    prisma = mockPrisma();
    notificationsService = mockNotificationsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
  });

  describe('createApprovalRequest', () => {
    it('should create a request for a sales invoice below the ADMIN threshold, assigning ACCOUNTANT', async () => {
      prisma.salesInvoice.count.mockResolvedValue(1);
      prisma.salesInvoice.findUnique.mockResolvedValue({ total: 10000 });
      prisma.approvalRequest.findFirst.mockResolvedValue(null);
      const created = {
        id: 'req-1',
        tenantId: undefined,
        entityType: ApprovalEntityType.SALES_INVOICE,
        entityId: 'inv-1',
        assignedRole: Role.ACCOUNTANT,
      };
      prisma.approvalRequest.create.mockResolvedValue(created);

      const result = await service.createApprovalRequest(
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
        'user-1',
        'please review',
      );

      expect(prisma.salesInvoice.count).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
      });
      expect(prisma.approvalRequest.findFirst).toHaveBeenCalledWith({
        where: {
          entityType: ApprovalEntityType.SALES_INVOICE,
          entityId: 'inv-1',
          status: ApprovalStatus.PENDING,
        },
      });
      expect(prisma.approvalRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: ApprovalEntityType.SALES_INVOICE,
          entityId: 'inv-1',
          assignedRole: Role.ACCOUNTANT,
          amountSnapshot: 10000,
          requestedById: 'user-1',
          comments: 'please review',
          dueAt: expect.any(Date),
        }),
      });
      expect(notificationsService.notifyApprovalRequired).toHaveBeenCalledWith(
        created.tenantId,
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
        Role.ACCOUNTANT,
        expect.any(Date),
      );
      expect(result).toEqual(created);
    });

    it('should assign ADMIN for a purchase order at or above its threshold', async () => {
      prisma.purchaseOrder.count.mockResolvedValue(1);
      prisma.purchaseOrder.findUnique.mockResolvedValue({ total: 300000 });
      prisma.approvalRequest.findFirst.mockResolvedValue(null);
      prisma.approvalRequest.create.mockResolvedValue({ id: 'req-2' });

      await service.createApprovalRequest(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
      );

      expect(prisma.approvalRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assignedRole: Role.ADMIN,
          amountSnapshot: 300000,
          requestedById: null,
        }),
      });
    });

    it('should assign HR_MANAGER for a payroll below its threshold and default the due date to +1 day', async () => {
      prisma.payroll.count.mockResolvedValue(1);
      prisma.payroll.findUnique.mockResolvedValue({ totalNet: 100000 });
      prisma.approvalRequest.findFirst.mockResolvedValue(null);
      prisma.approvalRequest.create.mockResolvedValue({ id: 'req-3' });

      await service.createApprovalRequest(ApprovalEntityType.PAYROLL, 'pay-1');

      expect(prisma.approvalRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ assignedRole: Role.HR_MANAGER }),
      });
    });

    it('should use the explicit dueAt when provided instead of the computed default', async () => {
      prisma.salesInvoice.count.mockResolvedValue(1);
      prisma.salesInvoice.findUnique.mockResolvedValue({ total: 100 });
      prisma.approvalRequest.findFirst.mockResolvedValue(null);
      prisma.approvalRequest.create.mockResolvedValue({ id: 'req-4' });
      const dueAt = new Date('2030-01-01T00:00:00Z');

      await service.createApprovalRequest(
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
        undefined,
        undefined,
        dueAt,
      );

      expect(prisma.approvalRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ dueAt }),
      });
    });

    it('should throw NotFoundException when the underlying entity does not exist', async () => {
      prisma.salesInvoice.count.mockResolvedValue(0);

      await expect(
        service.createApprovalRequest(
          ApprovalEntityType.SALES_INVOICE,
          'missing',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.approvalRequest.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when a request is already pending', async () => {
      prisma.salesInvoice.count.mockResolvedValue(1);
      prisma.salesInvoice.findUnique.mockResolvedValue({ total: 100 });
      prisma.approvalRequest.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createApprovalRequest(ApprovalEntityType.SALES_INVOICE, 'inv-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.approvalRequest.create).not.toHaveBeenCalled();
    });
  });

  describe('escalateOverduePendingRequests', () => {
    it('should escalate overdue pending requests and increment their escalation count', async () => {
      const overdue = [
        {
          id: 'req-1',
          tenantId: 'tenant-1',
          entityType: ApprovalEntityType.SALES_INVOICE,
          entityId: 'inv-1',
          dueAt: new Date('2024-01-01'),
        },
      ];
      prisma.approvalRequest.findMany.mockResolvedValue(overdue);
      prisma.approvalRequest.update.mockResolvedValue({});

      const result = await service.escalateOverduePendingRequests();

      expect(notificationsService.notifyApprovalOverdue).toHaveBeenCalledWith(
        'tenant-1',
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
        overdue[0].dueAt,
      );
      expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          escalationCount: { increment: 1 },
          lastEscalatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(
        expect.objectContaining({ scanned: 1, escalated: 1 }),
      );
    });

    it('should return zero scanned/escalated when nothing is overdue', async () => {
      prisma.approvalRequest.findMany.mockResolvedValue([]);

      const result = await service.escalateOverduePendingRequests();

      expect(notificationsService.notifyApprovalOverdue).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ scanned: 0, escalated: 0 }),
      );
    });
  });

  describe('approveRequest', () => {
    const request = {
      id: 'req-1',
      tenantId: 'tenant-1',
      status: ApprovalStatus.PENDING,
      assignedRole: Role.ACCOUNTANT,
      entityType: ApprovalEntityType.SALES_INVOICE,
      entityId: 'inv-1',
      requestedById: 'user-1',
      comments: 'original',
    };

    it('should approve a pending request and notify the requester', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(request);
      const updated = { ...request, status: ApprovalStatus.APPROVED };
      prisma.approvalRequest.update.mockResolvedValue(updated);
      prisma.user.findUnique.mockResolvedValue({ email: 'requester@x.com' });

      const result = await service.approveRequest(
        'req-1',
        'approver-1',
        'looks good',
        Role.ACCOUNTANT,
      );

      expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          status: ApprovalStatus.APPROVED,
          approvedById: 'approver-1',
          approvedAt: expect.any(Date),
          comments: 'looks good',
        },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { email: true },
      });
      expect(notificationsService.notifyApprovalDecision).toHaveBeenCalledWith(
        'tenant-1',
        'APPROVED',
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
        'requester@x.com',
      );
      expect(result).toEqual(updated);
    });

    it('should skip the requester lookup when there is no requestedById', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue({
        ...request,
        requestedById: null,
      });
      prisma.approvalRequest.update.mockResolvedValue({});

      await service.approveRequest('req-1', 'approver-1', undefined, Role.ACCOUNTANT);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(notificationsService.notifyApprovalDecision).toHaveBeenCalledWith(
        'tenant-1',
        'APPROVED',
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
        undefined,
      );
    });

    it('should throw NotFoundException when the request does not exist', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.approveRequest('missing', 'approver-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when the approver role does not match the assigned role', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(request);

      await expect(
        service.approveRequest('req-1', 'approver-1', undefined, Role.HR_MANAGER),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.approvalRequest.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when the request is not pending', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue({
        ...request,
        status: ApprovalStatus.APPROVED,
      });

      await expect(
        service.approveRequest('req-1', 'approver-1', undefined, Role.ACCOUNTANT),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.approvalRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('rejectRequest', () => {
    const request = {
      id: 'req-1',
      tenantId: 'tenant-1',
      status: ApprovalStatus.PENDING,
      assignedRole: Role.ACCOUNTANT,
      entityType: ApprovalEntityType.PURCHASE_ORDER,
      entityId: 'po-1',
      requestedById: 'user-1',
    };

    it('should reject a pending request with a reason and notify the requester', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(request);
      const updated = { ...request, status: ApprovalStatus.REJECTED };
      prisma.approvalRequest.update.mockResolvedValue(updated);
      prisma.user.findUnique.mockResolvedValue({ email: 'requester@x.com' });

      const result = await service.rejectRequest(
        'req-1',
        'approver-1',
        'Budget exceeded',
        Role.ACCOUNTANT,
      );

      expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          status: ApprovalStatus.REJECTED,
          rejectedById: 'approver-1',
          rejectedAt: expect.any(Date),
          rejectionReason: 'Budget exceeded',
        },
      });
      expect(notificationsService.notifyApprovalDecision).toHaveBeenCalledWith(
        'tenant-1',
        'REJECTED',
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        'requester@x.com',
        'Budget exceeded',
      );
      expect(result).toEqual(updated);
    });

    it('should default the rejection reason when none is provided', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue({
        ...request,
        requestedById: null,
      });
      prisma.approvalRequest.update.mockResolvedValue({});

      await service.rejectRequest('req-1', 'approver-1', undefined, Role.ACCOUNTANT);

      expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: expect.objectContaining({
          rejectionReason: 'Rejected by approver',
        }),
      });
    });

    it('should throw NotFoundException when the request does not exist', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectRequest('missing', 'approver-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when the approver role does not match the assigned role', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(request);

      await expect(
        service.rejectRequest('req-1', 'approver-1', undefined, Role.HR_MANAGER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when the request is not pending', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue({
        ...request,
        status: ApprovalStatus.REJECTED,
      });

      await expect(
        service.rejectRequest('req-1', 'approver-1', undefined, Role.ACCOUNTANT),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findRequests', () => {
    it('should list all requests ordered by requestedAt when no filters are given', async () => {
      prisma.approvalRequest.findMany.mockResolvedValue([{ id: 'req-1' }]);

      const result = await service.findRequests();

      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { requestedAt: 'desc' },
      });
      expect(result).toEqual([{ id: 'req-1' }]);
    });

    it('should apply entityType, entityId and status filters', async () => {
      prisma.approvalRequest.findMany.mockResolvedValue([]);

      await service.findRequests(
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
        ApprovalStatus.PENDING,
      );

      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith({
        where: {
          entityType: ApprovalEntityType.SALES_INVOICE,
          entityId: 'inv-1',
          status: ApprovalStatus.PENDING,
        },
        orderBy: { requestedAt: 'desc' },
      });
    });
  });

  describe('assertApprovalIfExists', () => {
    it('should return null when no approval request exists', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue(null);

      const result = await service.assertApprovalIfExists(
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
      );

      expect(result).toBeNull();
    });

    it('should throw BadRequestException when the latest request is still pending', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue({
        status: ApprovalStatus.PENDING,
      });

      await expect(
        service.assertApprovalIfExists(
          ApprovalEntityType.SALES_INVOICE,
          'inv-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with the reason when the latest request was rejected', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue({
        status: ApprovalStatus.REJECTED,
        rejectionReason: 'Insufficient funds',
      });

      await expect(
        service.assertApprovalIfExists(
          ApprovalEntityType.SALES_INVOICE,
          'inv-1',
        ),
      ).rejects.toThrow('Approval was rejected: Insufficient funds');
    });

    it('should return the latest request when it was approved', async () => {
      const approved = { status: ApprovalStatus.APPROVED, id: 'req-1' };
      prisma.approvalRequest.findFirst.mockResolvedValue(approved);

      const result = await service.assertApprovalIfExists(
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
      );

      expect(result).toEqual(approved);
    });

    it('should return null for a consumed request (not pending, rejected, or approved)', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue({
        status: ApprovalStatus.CONSUMED,
      });

      const result = await service.assertApprovalIfExists(
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
      );

      expect(result).toBeNull();
    });
  });

  describe('consumeApprovedRequest', () => {
    it('should return null when there is no approved request', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue(null);

      const result = await service.consumeApprovedRequest(
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
      );

      expect(result).toBeNull();
      expect(prisma.approvalRequest.update).not.toHaveBeenCalled();
    });

    it('should mark the latest approved request as CONSUMED', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue({ id: 'req-1' });
      const updated = { id: 'req-1', status: ApprovalStatus.CONSUMED };
      prisma.approvalRequest.update.mockResolvedValue(updated);

      const result = await service.consumeApprovedRequest(
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
      );

      expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: ApprovalStatus.CONSUMED, consumedAt: expect.any(Date) },
      });
      expect(result).toEqual(updated);
    });
  });
});
