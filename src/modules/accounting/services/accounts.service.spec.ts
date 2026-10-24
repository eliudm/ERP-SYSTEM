import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../../prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = () => ({
  account: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  journalLine: {
    aggregate: jest.fn(),
  },
});

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  describe('create', () => {
    const dto = { code: '1000', name: 'Cash', type: 'ASSET' as any };

    it('should create the account when code is unique', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      const expected = { id: 'acc-1', ...dto };
      prisma.account.create.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { code: dto.code },
      });
      expect(prisma.account.create).toHaveBeenCalledWith({
        data: dto,
        include: { parent: true },
      });
      expect(result).toEqual(expected);
    });

    it('should throw ConflictException when code already exists', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(prisma.account.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return active accounts ordered by code', async () => {
      const accounts = [{ id: '1' }, { id: '2' }];
      prisma.account.findMany.mockResolvedValue(accounts);

      const result = await service.findAll();

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { parent: true },
        orderBy: { code: 'asc' },
      });
      expect(result).toEqual(accounts);
    });
  });

  describe('findByType', () => {
    it('should return accounts filtered by type', async () => {
      prisma.account.findMany.mockResolvedValue([{ id: '1', type: 'ASSET' }]);

      const result = await service.findByType('ASSET');

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { type: 'ASSET', isActive: true },
        orderBy: { code: 'asc' },
      });
      expect(result).toEqual([{ id: '1', type: 'ASSET' }]);
    });
  });

  describe('findOne', () => {
    it('should return the account with relations', async () => {
      const account = { id: 'acc-1', parent: null, children: [], journalLines: [] };
      prisma.account.findUnique.mockResolvedValue(account);

      const result = await service.findOne('acc-1');

      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        include: {
          parent: true,
          children: true,
          journalLines: {
            include: { journalEntry: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
      expect(result).toEqual(account);
    });

    it('should throw NotFoundException when account does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBalance', () => {
    it('should compute debit-normal balance for ASSET accounts', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: 'acc-1', type: 'ASSET' });
      prisma.journalLine.aggregate.mockResolvedValue({
        _sum: { debit: 500, credit: 200 },
      });

      const result = await service.getBalance('acc-1');

      expect(prisma.journalLine.aggregate).toHaveBeenCalledWith({
        where: { accountId: 'acc-1', journalEntry: { status: 'POSTED' } },
        _sum: { debit: true, credit: true },
      });
      expect(result).toEqual({
        account: { id: 'acc-1', type: 'ASSET' },
        totalDebit: 500,
        totalCredit: 200,
        balance: 300,
      });
    });

    it('should compute credit-normal balance for non debit-normal accounts', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: 'acc-2', type: 'LIABILITY' });
      prisma.journalLine.aggregate.mockResolvedValue({
        _sum: { debit: 100, credit: 400 },
      });

      const result = await service.getBalance('acc-2');

      expect(result.balance).toBe(300);
    });

    it('should default sums to zero when no journal lines exist', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: 'acc-3', type: 'EXPENSE' });
      prisma.journalLine.aggregate.mockResolvedValue({ _sum: { debit: null, credit: null } });

      const result = await service.getBalance('acc-3');

      expect(result.totalDebit).toBe(0);
      expect(result.totalCredit).toBe(0);
      expect(result.balance).toBe(0);
    });

    it('should throw NotFoundException when account does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.getBalance('missing')).rejects.toThrow(NotFoundException);
      expect(prisma.journalLine.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      prisma.account.update.mockResolvedValue({ id: 'acc-1', isActive: false });

      const result = await service.deactivate('acc-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { isActive: false },
      });
      expect(result).toEqual({ id: 'acc-1', isActive: false });
    });

    it('should throw NotFoundException when account does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('missing')).rejects.toThrow(NotFoundException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });
  });

  describe('seedChartOfAccounts', () => {
    it('should create only accounts that do not already exist', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: 'existing' });
      prisma.account.create.mockResolvedValue({ id: 'new-1' });

      const result = await service.seedChartOfAccounts();

      expect(prisma.account.findUnique).toHaveBeenCalledTimes(19);
      expect(prisma.account.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Seeded 0 accounts successfully',
        accounts: [],
      });
    });

    it('should create accounts that do not exist yet', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      prisma.account.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `acc-${data.code}`, ...data }),
      );

      const result = await service.seedChartOfAccounts();

      expect(prisma.account.create).toHaveBeenCalledTimes(19);
      expect(result.message).toBe('Seeded 19 accounts successfully');
      expect(result.accounts).toHaveLength(19);
    });
  });
});
