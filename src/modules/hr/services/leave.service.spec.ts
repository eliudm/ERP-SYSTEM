import { Test, TestingModule } from '@nestjs/testing';
import { LeaveService } from './leave.service';
import { PrismaService } from '../../../prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LeaveStatus, LeaveType } from '@prisma/client';

const mockPrisma = () => ({
  employee: {
    findUnique: jest.fn(),
  },
  leaveRequest: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
});

describe('LeaveService', () => {
  let service: LeaveService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [LeaveService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<LeaveService>(LeaveService);
  });

  describe('create', () => {
    const dto = {
      employeeId: 'emp-1',
      leaveType: LeaveType.ANNUAL,
      startDate: '2024-01-01', // Monday
      endDate: '2024-01-08', // following Monday
      reason: 'Vacation',
    };

    it('should create a leave request with correctly calculated working days', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      prisma.leaveRequest.findFirst.mockResolvedValue(null);
      prisma.leaveRequest.create.mockResolvedValue({ id: 'leave-1', days: 6 });

      const result = await service.create(dto as any);

      expect(prisma.leaveRequest.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp-1',
          leaveType: LeaveType.ANNUAL,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-08'),
          days: 6,
          reason: 'Vacation',
          status: LeaveStatus.PENDING,
        },
        include: { employee: true },
      });
      expect(result).toEqual({ id: 'leave-1', days: 6 });
    });

    it('should calculate a 5-day work week excluding no weekend', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      prisma.leaveRequest.findFirst.mockResolvedValue(null);
      prisma.leaveRequest.create.mockResolvedValue({});

      await service.create({
        ...dto,
        startDate: '2024-01-01', // Monday
        endDate: '2024-01-05', // Friday
      } as any);

      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ days: 5 }) }),
      );
    });

    it('should throw NotFoundException if employee does not exist', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.create(dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if end date is before start date', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });

      await expect(
        service.create({
          ...dto,
          startDate: '2024-01-08',
          endDate: '2024-01-01',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if an overlapping leave request exists', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('should approve a pending leave request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave-1',
        status: LeaveStatus.PENDING,
      });
      prisma.leaveRequest.update.mockResolvedValue({
        id: 'leave-1',
        status: LeaveStatus.APPROVED,
        approvedBy: 'approver-1',
      });

      const result = await service.approve('leave-1', 'approver-1');

      expect(prisma.leaveRequest.update).toHaveBeenCalledWith({
        where: { id: 'leave-1' },
        data: { status: LeaveStatus.APPROVED, approvedBy: 'approver-1' },
        include: { employee: true },
      });
      expect(result.status).toBe(LeaveStatus.APPROVED);
    });

    it('should throw NotFoundException if leave request does not exist', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);

      await expect(service.approve('missing', 'approver-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if leave request is not pending', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave-1',
        status: LeaveStatus.APPROVED,
      });

      await expect(service.approve('leave-1', 'approver-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reject', () => {
    it('should reject a pending leave request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave-1',
        status: LeaveStatus.PENDING,
      });
      prisma.leaveRequest.update.mockResolvedValue({
        id: 'leave-1',
        status: LeaveStatus.REJECTED,
      });

      const result = await service.reject('leave-1');

      expect(prisma.leaveRequest.update).toHaveBeenCalledWith({
        where: { id: 'leave-1' },
        data: { status: LeaveStatus.REJECTED },
        include: { employee: true },
      });
      expect(result.status).toBe(LeaveStatus.REJECTED);
    });

    it('should throw NotFoundException if leave request does not exist', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);

      await expect(service.reject('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if leave request is not pending', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave-1',
        status: LeaveStatus.REJECTED,
      });

      await expect(service.reject('leave-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all leave requests ordered by most recent', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([{ id: 'leave-1' }]);

      const result = await service.findAll();

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith({
        where: {},
        include: { employee: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by status and employeeId', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);

      await service.findAll('APPROVED', 'emp-1');

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'APPROVED', employeeId: 'emp-1' },
        }),
      );
    });
  });

  describe('getLeaveBalance', () => {
    it('should throw NotFoundException if employee does not exist', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.getLeaveBalance('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should compute entitlement, used and remaining days per leave type', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      prisma.leaveRequest.findMany.mockResolvedValue([
        { leaveType: 'ANNUAL', days: 5 },
        { leaveType: 'ANNUAL', days: 3 },
        { leaveType: 'SICK', days: 2 },
      ]);

      const result = await service.getLeaveBalance('emp-1');

      expect(result.balance).toEqual(
        expect.arrayContaining([
          { leaveType: 'ANNUAL', entitled: 21, used: 8, remaining: 13 },
          { leaveType: 'SICK', entitled: 30, used: 2, remaining: 28 },
          { leaveType: 'MATERNITY', entitled: 90, used: 0, remaining: 90 },
          { leaveType: 'PATERNITY', entitled: 14, used: 0, remaining: 14 },
          { leaveType: 'UNPAID', entitled: 0, used: 0, remaining: 0 },
        ]),
      );
    });

    it('should clamp remaining days to zero when used exceeds entitlement', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      prisma.leaveRequest.findMany.mockResolvedValue([
        { leaveType: 'ANNUAL', days: 25 },
      ]);

      const result = await service.getLeaveBalance('emp-1');
      const annual = result.balance.find((b: any) => b.leaveType === 'ANNUAL');

      expect(annual?.remaining).toBe(0);
    });
  });
});
