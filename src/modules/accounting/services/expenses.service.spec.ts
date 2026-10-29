import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from './posting-engine.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExpenseStatus } from '@prisma/client';

const mockPrisma = () => ({
  expense: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  account: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
});

describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: ReturnType<typeof mockPrisma>;
  let postingEngine: { postTransaction: jest.Mock };

  beforeEach(async () => {
    prisma = mockPrisma();
    postingEngine = { postTransaction: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  describe('create', () => {
    const dto = {
      date: '2026-01-01',
      accountId: 'acc-rent',
      payee: 'Landlord Co',
      amount: 50000,
      description: 'January rent',
    } as any;

    it('should create a DRAFT expense when the account is a real EXPENSE account', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc-rent',
        tenantId: 't-1',
        code: '5200',
        name: 'Rent Expense',
        type: 'EXPENSE',
      });
      prisma.expense.count.mockResolvedValue(0);
      const created = { id: 'exp-1', expenseNo: 'EXP-00001', ...dto };
      prisma.expense.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(prisma.expense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 't-1',
          expenseNo: 'EXP-00001',
          accountId: 'acc-rent',
          payee: 'Landlord Co',
          amount: 50000,
        }),
        include: { account: true },
      });
      expect(result).toEqual(created);
    });

    it('should throw NotFoundException if the account does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if the account is not an EXPENSE account', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc-rent',
        tenantId: 't-1',
        code: '1000',
        name: 'Cash and Cash Equivalents',
        type: 'ASSET',
      });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(prisma.expense.create).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    const expense = {
      id: 'exp-1',
      expenseNo: 'EXP-00001',
      status: ExpenseStatus.DRAFT,
      date: new Date('2026-01-01'),
      accountId: 'acc-rent',
      account: { id: 'acc-rent', code: '5200', name: 'Rent Expense' },
      payee: 'Landlord Co',
      amount: 50000,
    };
    const cashAccount = {
      id: 'acc-cash',
      code: '1000',
      name: 'Cash and Cash Equivalents',
    };
    const apAccount = { id: 'acc-ap', code: '2000', name: 'Accounts Payable' };

    beforeEach(() => {
      prisma.expense.findUnique.mockResolvedValue(expense);
    });

    it('should post Debit expense / Credit cash and go straight to PAID when already paid', async () => {
      prisma.account.findUnique.mockResolvedValue(cashAccount);
      prisma.expense.update.mockResolvedValue({
        ...expense,
        status: ExpenseStatus.PAID,
      });

      await service.approve('exp-1', {
        alreadyPaid: true,
        cashAccountId: 'acc-cash',
      } as any);

      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'EXP-JE-EXP-00001',
          lines: [
            expect.objectContaining({
              accountId: 'acc-rent',
              debit: 50000,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-cash',
              debit: 0,
              credit: 50000,
            }),
          ],
        }),
      );
      expect(prisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'exp-1' },
          data: expect.objectContaining({ status: ExpenseStatus.PAID }),
        }),
      );
    });

    it('should throw if alreadyPaid but no cashAccountId given', async () => {
      await expect(
        service.approve('exp-1', { alreadyPaid: true } as any),
      ).rejects.toThrow(BadRequestException);
      expect(postingEngine.postTransaction).not.toHaveBeenCalled();
    });

    it('should post Debit expense / Credit Accounts Payable and go to APPROVED when payable', async () => {
      prisma.account.findFirst.mockResolvedValue(apAccount);
      prisma.expense.update.mockResolvedValue({
        ...expense,
        status: ExpenseStatus.APPROVED,
      });

      await service.approve('exp-1', {} as any);

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { code: '2000' },
      });
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            expect.objectContaining({
              accountId: 'acc-rent',
              debit: 50000,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-ap',
              debit: 0,
              credit: 50000,
            }),
          ],
        }),
      );
      expect(prisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ExpenseStatus.APPROVED } }),
      );
    });

    it('should throw BadRequestException if not DRAFT', async () => {
      prisma.expense.findUnique.mockResolvedValue({
        ...expense,
        status: ExpenseStatus.APPROVED,
      });

      await expect(service.approve('exp-1', {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('pay', () => {
    const expense = {
      id: 'exp-1',
      expenseNo: 'EXP-00001',
      status: ExpenseStatus.APPROVED,
      accountId: 'acc-rent',
      account: { id: 'acc-rent', code: '5200', name: 'Rent Expense' },
      payee: 'Landlord Co',
      amount: 50000,
    };
    const cashAccount = { id: 'acc-cash', code: '1000', name: 'Cash' };
    const apAccount = { id: 'acc-ap', code: '2000', name: 'Accounts Payable' };

    it('should post Debit AP / Credit cash and set PAID', async () => {
      prisma.expense.findUnique.mockResolvedValue(expense);
      prisma.account.findFirst.mockResolvedValue(apAccount);
      prisma.account.findUnique.mockResolvedValue(cashAccount);
      prisma.expense.update.mockResolvedValue({
        ...expense,
        status: ExpenseStatus.PAID,
      });

      await service.pay('exp-1', { cashAccountId: 'acc-cash' } as any);

      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'EXP-PAY-EXP-00001',
          lines: [
            expect.objectContaining({
              accountId: 'acc-ap',
              debit: 50000,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-cash',
              debit: 0,
              credit: 50000,
            }),
          ],
        }),
      );
      expect(prisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ExpenseStatus.PAID }),
        }),
      );
    });

    it('should throw BadRequestException if not APPROVED', async () => {
      prisma.expense.findUnique.mockResolvedValue({
        ...expense,
        status: ExpenseStatus.DRAFT,
      });

      await expect(
        service.pay('exp-1', { cashAccountId: 'acc-cash' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('void', () => {
    it('should void a DRAFT or APPROVED expense', async () => {
      prisma.expense.findUnique.mockResolvedValue({
        id: 'exp-1',
        status: ExpenseStatus.APPROVED,
      });
      prisma.expense.update.mockResolvedValue({
        id: 'exp-1',
        status: ExpenseStatus.VOID,
      });

      const result = await service.void('exp-1');

      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: { status: ExpenseStatus.VOID },
      });
      expect(result.status).toBe(ExpenseStatus.VOID);
    });

    it('should throw BadRequestException if already PAID', async () => {
      prisma.expense.findUnique.mockResolvedValue({
        id: 'exp-1',
        status: ExpenseStatus.PAID,
      });

      await expect(service.void('exp-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if the expense does not exist', async () => {
      prisma.expense.findUnique.mockResolvedValue(null);

      await expect(service.void('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
