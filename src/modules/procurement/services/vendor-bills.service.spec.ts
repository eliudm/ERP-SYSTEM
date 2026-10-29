import { Test, TestingModule } from '@nestjs/testing';
import { VendorBillsService } from './vendor-bills.service';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrisma = () => ({
  supplier: { findUnique: jest.fn() },
  vendorBill: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  account: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
});

describe('VendorBillsService', () => {
  let service: VendorBillsService;
  let prisma: ReturnType<typeof mockPrisma>;
  let postingEngine: { postTransaction: jest.Mock };

  beforeEach(async () => {
    prisma = mockPrisma();
    postingEngine = { postTransaction: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorBillsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
      ],
    }).compile();

    service = module.get<VendorBillsService>(VendorBillsService);
  });

  describe('approve', () => {
    const bill = {
      id: 'bill-1',
      billNumber: 'BILL-00001',
      status: 'DRAFT',
      billDate: new Date('2026-01-01'),
      subtotal: 1000,
      taxAmount: 160,
      total: 1160,
      supplier: { id: 'sup-1', name: 'Acme Supplies' },
      items: [],
    };
    const apAccount = { id: 'acc-ap', code: '2000', name: 'Accounts Payable' };
    const expenseAccount = {
      id: 'acc-exp',
      code: '5000',
      name: 'Cost of Goods Sold',
    };
    const taxAccount = {
      id: 'acc-tax',
      code: '1300',
      name: 'Prepaid Expenses',
    };

    beforeEach(() => {
      prisma.vendorBill.findUnique.mockResolvedValue(bill);
      prisma.account.findFirst.mockImplementation(
        ({ where: { code } }: any) => {
          if (code === '2000') return Promise.resolve(apAccount);
          if (code === '5000') return Promise.resolve(expenseAccount);
          if (code === '1300') return Promise.resolve(taxAccount);
          return Promise.resolve(null);
        },
      );
    });

    it('should post the journal entry against the real AP account (2000, not 2100) and approve the bill', async () => {
      prisma.vendorBill.update.mockResolvedValue({
        ...bill,
        status: 'APPROVED',
      });

      await service.approve('bill-1');

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { code: '2000' },
      });
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'BILL-JE-BILL-00001',
          lines: [
            expect.objectContaining({
              accountId: 'acc-exp',
              debit: 1000,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-tax',
              debit: 160,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-ap',
              debit: 0,
              credit: 1160,
            }),
          ],
        }),
      );
      expect(prisma.vendorBill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: { status: 'APPROVED' },
      });
    });

    it('should throw BadRequestException if not DRAFT', async () => {
      prisma.vendorBill.findUnique.mockResolvedValue({
        ...bill,
        status: 'APPROVED',
      });

      await expect(service.approve('bill-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if a required account is missing', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.approve('bill-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('pay', () => {
    const bill = {
      id: 'bill-1',
      billNumber: 'BILL-00001',
      status: 'APPROVED',
      total: 1160,
      supplier: { id: 'sup-1', name: 'Acme Supplies' },
      items: [],
    };
    const apAccount = { id: 'acc-ap', code: '2000', name: 'Accounts Payable' };
    const cashAccount = {
      id: 'acc-cash',
      code: '1000',
      name: 'Cash and Cash Equivalents',
    };

    beforeEach(() => {
      prisma.vendorBill.findUnique.mockResolvedValue(bill);
      prisma.account.findFirst.mockResolvedValue(apAccount);
    });

    it('should post Debit AP / Credit the caller-supplied cash account (not the hardcoded, wrong 1100) and mark PAID', async () => {
      prisma.account.findUnique.mockResolvedValue(cashAccount);
      prisma.vendorBill.update.mockResolvedValue({ ...bill, status: 'PAID' });

      await service.pay('bill-1', 'acc-cash');

      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'acc-cash' },
      });
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'BILL-PAY-BILL-00001',
          lines: [
            expect.objectContaining({
              accountId: 'acc-ap',
              debit: 1160,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-cash',
              debit: 0,
              credit: 1160,
            }),
          ],
        }),
      );
      expect(prisma.vendorBill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bill-1' },
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
    });

    it('should throw NotFoundException if the cash account does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.pay('bill-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(postingEngine.postTransaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if not APPROVED', async () => {
      prisma.vendorBill.findUnique.mockResolvedValue({
        ...bill,
        status: 'DRAFT',
      });

      await expect(service.pay('bill-1', 'acc-cash')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('void', () => {
    it('should void a non-PAID bill', async () => {
      prisma.vendorBill.findUnique.mockResolvedValue({
        id: 'bill-1',
        status: 'APPROVED',
      });
      prisma.vendorBill.update.mockResolvedValue({
        id: 'bill-1',
        status: 'VOID',
      });

      const result = await service.void('bill-1');

      expect(result.status).toBe('VOID');
    });

    it('should throw BadRequestException if already PAID', async () => {
      prisma.vendorBill.findUnique.mockResolvedValue({
        id: 'bill-1',
        status: 'PAID',
      });

      await expect(service.void('bill-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if the bill does not exist', async () => {
      prisma.vendorBill.findUnique.mockResolvedValue(null);

      await expect(service.void('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
