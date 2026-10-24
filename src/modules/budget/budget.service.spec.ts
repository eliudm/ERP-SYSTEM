import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BudgetStatus } from '@prisma/client';
import { BudgetService } from './budget.service';
import { PrismaService } from '../../prisma.service';

const mockPrisma = () => ({
  budget: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  budgetLine: {
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  journalLine: {
    groupBy: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('BudgetService', () => {
  let service: BudgetService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
  });

  describe('create', () => {
    const dto = {
      name: 'Ops Budget',
      fiscalYear: 2025,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      notes: 'note',
      lines: [{ accountId: 'acc-1', month: 1, amount: 100, notes: 'l1' }],
    };

    it('should create a budget with mapped lines when name+year is unique', async () => {
      prisma.budget.findFirst.mockResolvedValue(null);
      const expected = { id: 'budget-1', ...dto };
      prisma.budget.create.mockResolvedValue(expected);

      const result = await service.create(dto, 'user-1');

      expect(prisma.budget.findFirst).toHaveBeenCalledWith({
        where: { fiscalYear: 2025, name: 'Ops Budget' },
      });
      expect(prisma.budget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Ops Budget',
          fiscalYear: 2025,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          notes: 'note',
          createdById: 'user-1',
          lines: {
            create: [
              { accountId: 'acc-1', month: 1, amount: 100, notes: 'l1' },
            ],
          },
        }),
        include: { lines: { include: { account: true } } },
      });
      expect(result).toEqual(expected);
    });

    it('should default createdById to null and omit lines create when none given', async () => {
      prisma.budget.findFirst.mockResolvedValue(null);
      prisma.budget.create.mockResolvedValue({ id: 'budget-2' });

      await service.create({ ...dto, lines: undefined });

      expect(prisma.budget.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdById: null,
            lines: undefined,
          }),
        }),
      );
    });

    it('should throw ConflictException if fiscalYear+name already exists', async () => {
      prisma.budget.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(prisma.budget.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should list budgets with no filters by default', async () => {
      prisma.budget.findMany.mockResolvedValue([{ id: 'b1' }]);

      const result = await service.findAll();

      expect(prisma.budget.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ fiscalYear: 'desc' }, { name: 'asc' }],
        include: { _count: { select: { lines: true } } },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by fiscalYear and status when given', async () => {
      prisma.budget.findMany.mockResolvedValue([]);

      await service.findAll(2025, BudgetStatus.ACTIVE);

      expect(prisma.budget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fiscalYear: 2025, status: BudgetStatus.ACTIVE },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a budget with ordered lines', async () => {
      const budget = { id: 'budget-1', lines: [] };
      prisma.budget.findUnique.mockResolvedValue(budget);

      const result = await service.findOne('budget-1');

      expect(prisma.budget.findUnique).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        include: {
          lines: { include: { account: true }, orderBy: [{ month: 'asc' }] },
        },
      });
      expect(result).toEqual(budget);
    });

    it('should throw NotFoundException if budget does not exist', async () => {
      prisma.budget.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a DRAFT budget', async () => {
      prisma.budget.findUnique.mockResolvedValue({
        id: 'budget-1',
        status: BudgetStatus.DRAFT,
      });
      const dto = { name: 'Renamed', startDate: '2025-02-01' };
      const expected = { id: 'budget-1', ...dto };
      prisma.budget.update.mockResolvedValue(expected);

      const result = await service.update('budget-1', dto);

      expect(prisma.budget.update).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        data: {
          name: 'Renamed',
          fiscalYear: undefined,
          startDate: new Date('2025-02-01'),
          endDate: undefined,
          notes: undefined,
        },
      });
      expect(result).toEqual(expected);
    });

    it('should throw BadRequestException if budget is not DRAFT', async () => {
      prisma.budget.findUnique.mockResolvedValue({
        id: 'budget-1',
        status: BudgetStatus.ACTIVE,
      });

      await expect(
        service.update('budget-1', { name: 'x' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.budget.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if budget does not exist', async () => {
      prisma.budget.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setStatus', () => {
    it('should update the budget status', async () => {
      prisma.budget.findUnique.mockResolvedValue({ id: 'budget-1' });
      const expected = { id: 'budget-1', status: BudgetStatus.ACTIVE };
      prisma.budget.update.mockResolvedValue(expected);

      const result = await service.setStatus('budget-1', {
        status: BudgetStatus.ACTIVE,
      });

      expect(prisma.budget.update).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        data: { status: BudgetStatus.ACTIVE },
      });
      expect(result).toEqual(expected);
    });

    it('should throw NotFoundException if budget does not exist', async () => {
      prisma.budget.findUnique.mockResolvedValue(null);

      await expect(
        service.setStatus('missing', { status: BudgetStatus.ACTIVE }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addLines', () => {
    const lines = [{ accountId: 'acc-1', month: 1, amount: 100, notes: 'n' }];

    it('should upsert lines in a transaction for a DRAFT budget', async () => {
      prisma.budget.findUnique.mockResolvedValue({
        id: 'budget-1',
        status: BudgetStatus.DRAFT,
      });
      const upsertCall = { id: 'line-1' };
      prisma.budgetLine.upsert.mockReturnValue(upsertCall);
      prisma.$transaction.mockResolvedValue([{ id: 'line-1' }]);

      const result = await service.addLines('budget-1', lines);

      expect(prisma.$transaction).toHaveBeenCalledWith([upsertCall]);
      expect(prisma.budgetLine.upsert).toHaveBeenCalledWith({
        where: {
          budgetId_accountId_month: {
            budgetId: 'budget-1',
            accountId: 'acc-1',
            month: 1,
          },
        },
        update: { amount: 100, notes: 'n' },
        create: {
          budgetId: 'budget-1',
          accountId: 'acc-1',
          month: 1,
          amount: 100,
          notes: 'n',
        },
      });
      expect(result).toEqual({ upserted: 1 });
    });

    it('should throw BadRequestException if budget is not DRAFT', async () => {
      prisma.budget.findUnique.mockResolvedValue({
        id: 'budget-1',
        status: BudgetStatus.CLOSED,
      });

      await expect(service.addLines('budget-1', lines)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if budget does not exist', async () => {
      prisma.budget.findUnique.mockResolvedValue(null);

      await expect(service.addLines('missing', lines)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteLine', () => {
    it('should delete a line from a DRAFT budget', async () => {
      prisma.budget.findUnique.mockResolvedValue({
        id: 'budget-1',
        status: BudgetStatus.DRAFT,
      });
      prisma.budgetLine.delete.mockResolvedValue({ id: 'line-1' });

      const result = await service.deleteLine('budget-1', 'line-1');

      expect(prisma.budgetLine.delete).toHaveBeenCalledWith({
        where: { id: 'line-1' },
      });
      expect(result).toEqual({ deleted: true });
    });

    it('should throw BadRequestException if budget is not DRAFT', async () => {
      prisma.budget.findUnique.mockResolvedValue({
        id: 'budget-1',
        status: BudgetStatus.ACTIVE,
      });

      await expect(
        service.deleteLine('budget-1', 'line-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.budgetLine.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if budget does not exist', async () => {
      prisma.budget.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteLine('missing', 'line-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBudgetVsActual', () => {
    it('should compute variance and utilization from budget lines and GL actuals', async () => {
      const budget = {
        id: 'budget-1',
        name: 'Ops',
        fiscalYear: 2025,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        lines: [
          {
            accountId: 'acc-1',
            amount: 100,
            account: { code: '5000', name: 'Rent', type: 'EXPENSE' },
          },
          {
            accountId: 'acc-1',
            amount: 50,
            account: { code: '5000', name: 'Rent', type: 'EXPENSE' },
          },
        ],
      };
      prisma.budget.findUnique.mockResolvedValue(budget);
      prisma.journalLine.groupBy.mockResolvedValue([
        { accountId: 'acc-1', _sum: { debit: 120, credit: 0 } },
      ]);

      const result = await service.getBudgetVsActual('budget-1');

      expect(prisma.journalLine.groupBy).toHaveBeenCalledWith({
        by: ['accountId'],
        where: {
          journalEntry: {
            status: 'POSTED',
            entryDate: { gte: budget.startDate, lte: budget.endDate },
          },
          accountId: { in: ['acc-1', 'acc-1'] },
        },
        _sum: { debit: true, credit: true },
      });

      expect(result.rows).toEqual([
        {
          accountId: 'acc-1',
          accountCode: '5000',
          accountName: 'Rent',
          accountType: 'EXPENSE',
          budgeted: 150,
          actual: 120,
          variance: 30,
          variancePct: 20,
        },
      ]);
      expect(result.summary).toEqual({
        totalBudgeted: 150,
        totalActual: 120,
        totalVariance: 30,
        utilizationPct: 80,
      });
    });

    it('should throw NotFoundException if budget does not exist', async () => {
      prisma.budget.findUnique.mockResolvedValue(null);

      await expect(
        service.getBudgetVsActual('missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
