import { Test, TestingModule } from '@nestjs/testing';
import { PostingEngineService } from './posting-engine.service';
import { PrismaService } from '../../../prisma.service';
import { AuditService } from '../../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JournalStatus } from '@prisma/client';

const mockPrisma = () => ({
  account: {
    findMany: jest.fn(),
  },
  accountingPeriod: {
    findFirst: jest.fn(),
  },
  journalEntry: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
});

const mockAuditService = () => ({
  log: jest.fn(),
});

describe('PostingEngineService', () => {
  let service: PostingEngineService;
  let prisma: ReturnType<typeof mockPrisma>;
  let auditService: ReturnType<typeof mockAuditService>;

  beforeEach(async () => {
    prisma = mockPrisma();
    auditService = mockAuditService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostingEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<PostingEngineService>(PostingEngineService);
  });

  describe('validateBalance', () => {
    it('should not throw when total debits equal total credits', () => {
      expect(() =>
        service.validateBalance([
          { debit: 100, credit: 0 },
          { debit: 0, credit: 100 },
        ]),
      ).not.toThrow();
    });

    it('should throw BadRequestException when debits and credits differ', () => {
      expect(() =>
        service.validateBalance([
          { debit: 100, credit: 0 },
          { debit: 0, credit: 50 },
        ]),
      ).toThrow(BadRequestException);
    });
  });

  describe('validateAccounts', () => {
    it('should resolve when all accounts exist and are active', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', code: '1000', name: 'Cash', isActive: true },
      ]);

      await expect(
        service.validateAccounts([{ accountId: 'acc-1' }]),
      ).resolves.toBeUndefined();

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['acc-1'] } },
      });
    });

    it('should throw NotFoundException when an account does not exist', async () => {
      prisma.account.findMany.mockResolvedValue([]);

      await expect(
        service.validateAccounts([{ accountId: 'missing' }]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when an account is inactive', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', code: '1000', name: 'Cash', isActive: false },
      ]);

      await expect(
        service.validateAccounts([{ accountId: 'acc-1' }]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkPeriodLock', () => {
    it('should resolve when no locked period covers the date', async () => {
      prisma.accountingPeriod.findFirst.mockResolvedValue(null);

      await expect(service.checkPeriodLock(new Date('2024-01-15'))).resolves.toBeUndefined();
    });

    it('should throw BadRequestException when a locked period covers the date', async () => {
      prisma.accountingPeriod.findFirst.mockResolvedValue({ name: 'Jan 2024' });

      await expect(service.checkPeriodLock(new Date('2024-01-15'))).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('postTransaction', () => {
    const dto = {
      reference: 'JE-1',
      description: 'Test entry',
      entryDate: '2024-01-15',
      lines: [
        { accountId: 'acc-1', debit: 100, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: 100 },
      ],
    } as any;

    const setupHappyPath = () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', code: '1000', name: 'Cash', isActive: true },
        { id: 'acc-2', code: '4000', name: 'Sales', isActive: true },
      ]);
      prisma.accountingPeriod.findFirst.mockResolvedValue(null);
      prisma.journalEntry.findFirst.mockResolvedValue(null);
    };

    it('should post a balanced transaction and write an audit log', async () => {
      setupHappyPath();
      const createdEntry = { id: 'je-1', reference: 'JE-1', sourceType: undefined, sourceId: undefined, currency: 'KES', exchangeRate: 1 };
      const tx = { journalEntry: { create: jest.fn().mockResolvedValue(createdEntry) } };
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));
      auditService.log.mockResolvedValue({ id: 'log-1' });

      const result = await service.postTransaction(dto, 'user-1');

      expect(tx.journalEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reference: 'JE-1',
          currency: 'KES',
          exchangeRate: 1,
          status: JournalStatus.POSTED,
          lines: {
            create: dto.lines.map((line: any) => ({
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description,
            })),
          },
        }),
        include: { lines: { include: { account: true } } },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', action: 'CREATE', tableName: 'journal_entries', recordId: 'je-1' }),
      );
      expect(result).toEqual(createdEntry);
    });

    it('should throw BadRequestException when exchange rate is not positive', async () => {
      await expect(
        service.postTransaction({ ...dto, exchangeRate: 0 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.findMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when lines are unbalanced', async () => {
      const unbalanced = { ...dto, lines: [{ accountId: 'acc-1', debit: 100, credit: 0 }] };

      await expect(service.postTransaction(unbalanced, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.account.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when a referenced account does not exist', async () => {
      prisma.account.findMany.mockResolvedValue([]);

      await expect(service.postTransaction(dto, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when the accounting period is locked', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', code: '1000', name: 'Cash', isActive: true },
        { id: 'acc-2', code: '4000', name: 'Sales', isActive: true },
      ]);
      prisma.accountingPeriod.findFirst.mockResolvedValue({ name: 'Jan 2024' });

      await expect(service.postTransaction(dto, 'user-1')).rejects.toThrow(BadRequestException);
      expect(prisma.journalEntry.findFirst).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when the reference already exists', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', code: '1000', name: 'Cash', isActive: true },
        { id: 'acc-2', code: '4000', name: 'Sales', isActive: true },
      ]);
      prisma.accountingPeriod.findFirst.mockResolvedValue(null);
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.postTransaction(dto, 'user-1')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('voidTransaction', () => {
    const existingEntry = {
      id: 'je-1',
      reference: 'JE-1',
      status: JournalStatus.POSTED,
      entryDate: new Date('2024-01-15'),
      currency: 'KES',
      exchangeRate: 1,
      lines: [{ accountId: 'acc-1', debit: 100, credit: 0, description: 'orig' }],
    };

    it('should void the entry and create a reversing entry with an audit log', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue(existingEntry);
      prisma.accountingPeriod.findFirst.mockResolvedValue(null);
      const reversingEntry = { id: 'je-2', reference: 'VOID-JE-1' };
      const tx = {
        journalEntry: {
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue(reversingEntry),
        },
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));
      auditService.log.mockResolvedValue({ id: 'log-1' });

      const result = await service.voidTransaction('je-1', 'mistake', 'user-1');

      expect(tx.journalEntry.update).toHaveBeenCalledWith({
        where: { id: 'je-1' },
        data: { status: JournalStatus.VOID },
      });
      expect(tx.journalEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reference: 'VOID-JE-1',
          sourceType: 'VOID',
          sourceId: 'je-1',
          lines: {
            create: [
              { accountId: 'acc-1', debit: 0, credit: 100, description: 'Reversal: orig' },
            ],
          },
        }),
        include: { lines: { include: { account: true } } },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'VOID',
          tableName: 'journal_entries',
          recordId: 'je-1',
          oldValues: { status: JournalStatus.POSTED },
        }),
      );
      expect(result).toEqual(reversingEntry);
    });

    it('should throw NotFoundException when the journal entry does not exist', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue(null);

      await expect(service.voidTransaction('missing', 'mistake', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when the entry is already voided', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue({
        ...existingEntry,
        status: JournalStatus.VOID,
      });

      await expect(service.voidTransaction('je-1', 'mistake', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when the period is locked', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue(existingEntry);
      prisma.accountingPeriod.findFirst.mockResolvedValue({ name: 'Jan 2024' });

      await expect(service.voidTransaction('je-1', 'mistake', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
