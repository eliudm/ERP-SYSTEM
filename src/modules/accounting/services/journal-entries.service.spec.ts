import { Test, TestingModule } from '@nestjs/testing';
import { JournalEntriesService } from './journal-entries.service';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from './posting-engine.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = () => ({
  journalEntry: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  journalLine: {
    findMany: jest.fn(),
  },
  account: {
    findMany: jest.fn(),
  },
  accountingPeriod: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
});

const mockPostingEngine = () => ({
  postTransaction: jest.fn(),
  voidTransaction: jest.fn(),
});

describe('JournalEntriesService', () => {
  let service: JournalEntriesService;
  let prisma: ReturnType<typeof mockPrisma>;
  let postingEngine: ReturnType<typeof mockPostingEngine>;

  beforeEach(async () => {
    prisma = mockPrisma();
    postingEngine = mockPostingEngine();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalEntriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
      ],
    }).compile();

    service = module.get<JournalEntriesService>(JournalEntriesService);
  });

  describe('create', () => {
    it('should delegate to postingEngine.postTransaction with dto and userId', async () => {
      const dto = { reference: 'JE-1', entryDate: '2024-01-01', lines: [] } as any;
      postingEngine.postTransaction.mockResolvedValue({ id: 'je-1' });

      const result = await service.create(dto, 'user-1');

      expect(postingEngine.postTransaction).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toEqual({ id: 'je-1' });
    });
  });

  describe('findAll', () => {
    it('should return paginated journal entries', async () => {
      const entries = [{ id: 'je-1' }, { id: 'je-2' }];
      prisma.journalEntry.findMany.mockResolvedValue(entries);
      prisma.journalEntry.count.mockResolvedValue(42);

      const result = await service.findAll(2, 10);

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        include: { lines: { include: { account: true } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({
        data: entries,
        meta: { total: 42, page: 2, limit: 10, totalPages: 5 },
      });
    });

    it('should default to page 1 and limit 20', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([]);
      prisma.journalEntry.count.mockResolvedValue(0);

      await service.findAll();

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return the journal entry with lines and accounts', async () => {
      const entry = { id: 'je-1', lines: [] };
      prisma.journalEntry.findUnique.mockResolvedValue(entry);

      const result = await service.findOne('je-1');

      expect(prisma.journalEntry.findUnique).toHaveBeenCalledWith({
        where: { id: 'je-1' },
        include: { lines: { include: { account: true } } },
      });
      expect(result).toEqual(entry);
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('void', () => {
    it('should delegate to postingEngine.voidTransaction', async () => {
      postingEngine.voidTransaction.mockResolvedValue({ id: 'reversal-1' });

      const result = await service.void('je-1', 'mistake', 'user-1');

      expect(postingEngine.voidTransaction).toHaveBeenCalledWith('je-1', 'mistake', 'user-1');
      expect(result).toEqual({ id: 'reversal-1' });
    });
  });

  describe('getTrialBalance', () => {
    it('should aggregate debits and credits per account and flag imbalance', async () => {
      prisma.account.findMany.mockResolvedValue([
        {
          code: '1000',
          name: 'Cash',
          type: 'ASSET',
          journalLines: [
            { debit: 100, credit: 0 },
            { debit: 0, credit: 40 },
          ],
        },
        {
          code: '4000',
          name: 'Sales',
          type: 'REVENUE',
          journalLines: [],
        },
      ]);

      const result = await service.getTrialBalance();

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          journalLines: { where: { journalEntry: { status: 'POSTED' } } },
        },
        orderBy: { code: 'asc' },
      });
      expect(result.accounts).toEqual([
        { code: '1000', name: 'Cash', type: 'ASSET', totalDebit: 100, totalCredit: 40, balance: 60 },
      ]);
      expect(result.totals).toEqual({ totalDebit: 100, totalCredit: 40, isBalanced: false });
    });

    it('should mark as balanced when totals match', async () => {
      prisma.account.findMany.mockResolvedValue([
        { code: '1000', name: 'Cash', type: 'ASSET', journalLines: [{ debit: 50, credit: 50 }] },
      ]);

      const result = await service.getTrialBalance();

      expect(result.totals.isBalanced).toBe(true);
    });
  });

  describe('getProfitAndLoss', () => {
    it('should group revenue and expense lines and compute profit before tax', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        {
          accountId: 'rev-1',
          debit: 0,
          credit: 500,
          account: { code: '4000', name: 'Sales', type: 'REVENUE' },
        },
        {
          accountId: 'exp-1',
          debit: 200,
          credit: 0,
          account: { code: '5000', name: 'COGS', type: 'EXPENSE' },
        },
      ]);

      const result = await service.getProfitAndLoss('2024-01-01', '2024-01-31');

      expect(prisma.journalLine.findMany).toHaveBeenCalledWith({
        where: {
          journalEntry: {
            status: 'POSTED',
            entryDate: { gte: new Date('2024-01-01'), lte: new Date('2024-01-31') },
          },
          account: { type: { in: ['REVENUE', 'EXPENSE'] } },
        },
        include: { account: true },
      });
      expect(result.revenue.total).toBe(500);
      expect(result.expenses.total).toBe(200);
      expect(result.profitBeforeTax).toBe(300);
    });
  });

  describe('createPeriod', () => {
    it('should create an accounting period', async () => {
      const dto = { name: 'Jan', startDate: '2024-01-01', endDate: '2024-01-31' };
      prisma.accountingPeriod.create.mockResolvedValue({ id: 'p1', ...dto });

      const result = await service.createPeriod(dto);

      expect(prisma.accountingPeriod.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual({ id: 'p1', ...dto });
    });
  });

  describe('lockPeriod', () => {
    it('should lock the period', async () => {
      prisma.accountingPeriod.findUnique.mockResolvedValue({ id: 'p1', isLocked: false });
      prisma.accountingPeriod.update.mockResolvedValue({ id: 'p1', isLocked: true });

      const result = await service.lockPeriod('p1');

      expect(prisma.accountingPeriod.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isLocked: true },
      });
      expect(result).toEqual({ id: 'p1', isLocked: true });
    });

    it('should throw NotFoundException when period does not exist', async () => {
      prisma.accountingPeriod.findUnique.mockResolvedValue(null);

      await expect(service.lockPeriod('missing')).rejects.toThrow(NotFoundException);
      expect(prisma.accountingPeriod.update).not.toHaveBeenCalled();
    });
  });

  describe('getPeriods', () => {
    it('should return periods ordered by startDate desc', async () => {
      const periods = [{ id: 'p1' }];
      prisma.accountingPeriod.findMany.mockResolvedValue(periods);

      const result = await service.getPeriods();

      expect(prisma.accountingPeriod.findMany).toHaveBeenCalledWith({
        orderBy: { startDate: 'desc' },
      });
      expect(result).toEqual(periods);
    });
  });
});
