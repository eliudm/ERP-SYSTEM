import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { ApprovalEntityType, ApprovalStatus, Role } from '@prisma/client';

const mockWorkflowService = () => ({
  findRequests: jest.fn(),
  createApprovalRequest: jest.fn(),
  escalateOverduePendingRequests: jest.fn(),
  approveRequest: jest.fn(),
  rejectRequest: jest.fn(),
});

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let service: ReturnType<typeof mockWorkflowService>;

  beforeEach(async () => {
    service = mockWorkflowService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [{ provide: WorkflowService, useValue: service }],
    }).compile();

    controller = module.get<WorkflowController>(WorkflowController);
  });

  describe('findAll', () => {
    it('should delegate to workflowService.findRequests with the given filters', () => {
      const expected = [{ id: 'req-1' }];
      service.findRequests.mockReturnValue(expected);

      const result = controller.findAll(
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
        ApprovalStatus.PENDING,
      );

      expect(service.findRequests).toHaveBeenCalledWith(
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
        ApprovalStatus.PENDING,
      );
      expect(result).toEqual(expected);
    });

    it('should delegate with undefined filters when none are given', () => {
      service.findRequests.mockReturnValue([]);

      controller.findAll();

      expect(service.findRequests).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('create', () => {
    it('should delegate to workflowService.createApprovalRequest with parsed dto fields', async () => {
      const expected = { id: 'req-1' };
      service.createApprovalRequest.mockResolvedValue(expected);
      const dto = {
        entityType: ApprovalEntityType.SALES_INVOICE,
        entityId: 'inv-1',
        comments: 'please review',
        dueAt: '2030-01-01T00:00:00.000Z',
      };
      const req = { user: { id: 'user-1' } };

      const result = await controller.create(dto as any, req);

      expect(service.createApprovalRequest).toHaveBeenCalledWith(
        ApprovalEntityType.SALES_INVOICE,
        'inv-1',
        'user-1',
        'please review',
        new Date(dto.dueAt),
      );
      expect(result).toEqual(expected);
    });

    it('should pass undefined dueAt when the dto has none', async () => {
      service.createApprovalRequest.mockResolvedValue({});
      const dto = {
        entityType: ApprovalEntityType.PURCHASE_ORDER,
        entityId: 'po-1',
      };

      await controller.create(dto as any, { user: {} });

      expect(service.createApprovalRequest).toHaveBeenCalledWith(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('runOverdueCheck', () => {
    it('should delegate to workflowService.escalateOverduePendingRequests', async () => {
      const expected = { scanned: 2, escalated: 1 };
      service.escalateOverduePendingRequests.mockResolvedValue(expected);

      const result = await controller.runOverdueCheck();

      expect(service.escalateOverduePendingRequests).toHaveBeenCalledWith();
      expect(result).toEqual(expected);
    });
  });

  describe('approve', () => {
    it('should delegate to workflowService.approveRequest with id, user id, comments and role', async () => {
      const expected = { id: 'req-1', status: 'APPROVED' };
      service.approveRequest.mockResolvedValue(expected);
      const req = { user: { id: 'approver-1', role: Role.ACCOUNTANT } };

      const result = await controller.approve(
        'req-1',
        { comments: 'ok' },
        req,
      );

      expect(service.approveRequest).toHaveBeenCalledWith(
        'req-1',
        'approver-1',
        'ok',
        Role.ACCOUNTANT,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('reject', () => {
    it('should delegate to workflowService.rejectRequest with id, user id, reason and role', async () => {
      const expected = { id: 'req-1', status: 'REJECTED' };
      service.rejectRequest.mockResolvedValue(expected);
      const req = { user: { id: 'approver-1', role: Role.HR_MANAGER } };

      const result = await controller.reject(
        'req-1',
        { reason: 'invalid' },
        req,
      );

      expect(service.rejectRequest).toHaveBeenCalledWith(
        'req-1',
        'approver-1',
        'invalid',
        Role.HR_MANAGER,
      );
      expect(result).toEqual(expected);
    });
  });
});
