import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { PrismaService } from '../../prisma.service';

const mockPrisma = () => ({
  branch: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  salesInvoice: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
});

describe('BranchesService', () => {
  let service: BranchesService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [BranchesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BranchesService>(BranchesService);
  });

  describe('create', () => {
    const dto = { name: 'Main Branch', code: 'MB-01', location: 'Nairobi' };

    it('should create a branch when code is unique', async () => {
      prisma.branch.findFirst.mockResolvedValue(null);
      const expected = { id: 'branch-1', ...dto };
      prisma.branch.create.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: { code: dto.code },
      });
      expect(prisma.branch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Main Branch', code: 'MB-01' }),
      });
      expect(result).toEqual(expected);
    });

    it('should throw ConflictException if code already exists', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(prisma.branch.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all branches with counts, ordered by name', async () => {
      prisma.branch.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);

      const result = await service.findAll();

      expect(prisma.branch.findMany).toHaveBeenCalledWith({
        include: { _count: { select: { warehouses: true, invoices: true } } },
        orderBy: { name: 'asc' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a branch by id with active warehouses', async () => {
      const branch = { id: 'branch-1', name: 'Main' };
      prisma.branch.findUnique.mockResolvedValue(branch);

      const result = await service.findOne('branch-1');

      expect(prisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        include: {
          warehouses: {
            where: { isActive: true },
            select: { id: true, name: true, location: true },
          },
        },
      });
      expect(result).toEqual(branch);
    });

    it('should throw NotFoundException if branch does not exist', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a branch when no code conflict exists', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      prisma.branch.findFirst.mockResolvedValue(null);
      const dto = { name: 'Updated', code: 'MB-02' };
      const expected = { id: 'branch-1', ...dto };
      prisma.branch.update.mockResolvedValue(expected);

      const result = await service.update('branch-1', dto);

      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: { code: 'MB-02' },
      });
      expect(prisma.branch.update).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        data: dto,
      });
      expect(result).toEqual(expected);
    });

    it('should skip the code-conflict check when code is not in the dto', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      prisma.branch.update.mockResolvedValue({ id: 'branch-1', name: 'New' });

      await service.update('branch-1', { name: 'New' });

      expect(prisma.branch.findFirst).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if branch does not exist', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if new code clashes with another branch', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'other-branch' });

      await expect(
        service.update('branch-1', { code: 'TAKEN' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.branch.update).not.toHaveBeenCalled();
    });

    it('should allow updating to the same code on the same branch', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      prisma.branch.update.mockResolvedValue({ id: 'branch-1', code: 'MB-01' });

      await service.update('branch-1', { code: 'MB-01' });

      expect(prisma.branch.update).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        data: { code: 'MB-01' },
      });
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      const expected = { id: 'branch-1', isActive: false };
      prisma.branch.update.mockResolvedValue(expected);

      const result = await service.deactivate('branch-1');

      expect(prisma.branch.update).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        data: { isActive: false },
      });
      expect(result).toEqual(expected);
    });

    it('should throw NotFoundException if branch does not exist', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getReport', () => {
    it('should compute revenue and paid count for a date range', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      prisma.salesInvoice.findMany.mockResolvedValue([
        { total: 100, status: 'PAID' },
        { total: 50, status: 'APPROVED' },
      ]);

      const result = await service.getReport(
        'branch-1',
        '2024-01-01',
        '2024-01-31',
      );

      expect(prisma.salesInvoice.findMany).toHaveBeenCalledWith({
        where: {
          branchId: 'branch-1',
          invoiceDate: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-01-31'),
          },
          status: { in: ['APPROVED', 'PAID'] },
        },
        select: { total: true, status: true },
      });
      expect(result).toEqual({
        branchId: 'branch-1',
        period: {
          from: new Date('2024-01-01'),
          to: new Date('2024-01-31'),
        },
        totals: { invoices: 2, paidInvoices: 1, revenue: 150 },
      });
    });

    it('should throw NotFoundException if branch does not exist', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.getReport('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getComparison', () => {
    it('should rank active branches by revenue, defaulting zero totals for branches with no activity', async () => {
      prisma.branch.findMany.mockResolvedValue([
        { id: 'branch-1', name: 'Main', code: 'MB-01' },
        { id: 'branch-2', name: 'Annex', code: 'MB-02' },
      ]);
      prisma.salesInvoice.groupBy.mockResolvedValue([
        { branchId: 'branch-1', status: 'PAID', _sum: { total: 100 }, _count: 1 },
        { branchId: 'branch-1', status: 'APPROVED', _sum: { total: 50 }, _count: 1 },
      ]);

      const result = await service.getComparison('2024-01-01', '2024-01-31');

      expect(prisma.salesInvoice.groupBy).toHaveBeenCalledWith({
        by: ['branchId', 'status'],
        where: {
          branchId: { not: null },
          invoiceDate: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-01-31'),
          },
          status: { in: ['APPROVED', 'PAID'] },
        },
        _sum: { total: true },
        _count: true,
      });
      expect(result).toEqual({
        period: { from: new Date('2024-01-01'), to: new Date('2024-01-31') },
        branches: [
          {
            branchId: 'branch-1',
            name: 'Main',
            code: 'MB-01',
            totals: { invoices: 2, paidInvoices: 1, revenue: 150 },
          },
          {
            branchId: 'branch-2',
            name: 'Annex',
            code: 'MB-02',
            totals: { invoices: 0, paidInvoices: 0, revenue: 0 },
          },
        ],
      });
    });
  });
});
