import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../../../prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = () => ({
  employee: {
    count: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
});

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmployeesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  describe('create', () => {
    const dto = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      salary: 50000,
      startDate: '2024-01-15',
    };

    it('should create an employee with a generated employee number', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      prisma.employee.count.mockResolvedValue(3);
      const expected = { id: 'emp-1', ...dto, employeeNo: 'EMP-0004' };
      prisma.employee.create.mockResolvedValue(expected);

      const result = await service.create(dto as any);

      expect(prisma.employee.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          employeeNo: 'EMP-0004',
          startDate: new Date(dto.startDate),
        },
      });
      expect(result).toEqual(expected);
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.employee.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return active employees ordered by first name', async () => {
      prisma.employee.findMany.mockResolvedValue([{ id: '1' }]);

      const result = await service.findAll();

      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        orderBy: { firstName: 'asc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by department', async () => {
      prisma.employee.findMany.mockResolvedValue([]);

      await service.findAll(undefined, 'Finance');

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE', department: 'Finance' },
        }),
      );
    });

    it('should filter by search term across multiple fields', async () => {
      prisma.employee.findMany.mockResolvedValue([]);

      await service.findAll('jane');

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { firstName: { contains: 'jane', mode: 'insensitive' } },
              { lastName: { contains: 'jane', mode: 'insensitive' } },
              { email: { contains: 'jane', mode: 'insensitive' } },
              { employeeNo: { contains: 'jane', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return an employee with payroll lines and leave requests', async () => {
      const employee = { id: 'emp-1', firstName: 'Jane' };
      prisma.employee.findUnique.mockResolvedValue(employee);

      const result = await service.findOne('emp-1');

      expect(prisma.employee.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'emp-1' } }),
      );
      expect(result).toEqual(employee);
    });

    it('should throw NotFoundException if employee does not exist', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      const updated = { id: 'emp-1', firstName: 'Janet' };
      prisma.employee.update.mockResolvedValue(updated);

      const result = await service.update('emp-1', { firstName: 'Janet' });

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { firstName: 'Janet' },
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if employee does not exist', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { firstName: 'Janet' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('terminate', () => {
    it('should set employee status to TERMINATED', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      prisma.employee.update.mockResolvedValue({
        id: 'emp-1',
        status: 'TERMINATED',
      });

      const result = await service.terminate('emp-1');

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { status: 'TERMINATED' },
      });
      expect(result.status).toBe('TERMINATED');
    });

    it('should throw NotFoundException if employee does not exist', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.terminate('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDepartments', () => {
    it('should return distinct non-null department names', async () => {
      prisma.employee.findMany.mockResolvedValue([
        { department: 'Finance' },
        { department: 'IT' },
        { department: null },
      ]);

      const result = await service.getDepartments();

      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', department: { not: null } },
        select: { department: true },
        distinct: ['department'],
      });
      expect(result).toEqual(['Finance', 'IT']);
    });
  });

  describe('getHeadcount', () => {
    it('should aggregate counts by status and department', async () => {
      prisma.employee.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      prisma.employee.groupBy.mockResolvedValue([
        { department: 'Finance', _count: { id: 7 } },
        { department: null, _count: { id: 3 } },
      ]);

      const result = await service.getHeadcount();

      expect(result).toEqual({
        total: 13,
        active: 10,
        inactive: 2,
        terminated: 1,
        byDepartment: [
          { department: 'Finance', count: 7 },
          { department: 'Unassigned', count: 3 },
        ],
      });
    });
  });
});
