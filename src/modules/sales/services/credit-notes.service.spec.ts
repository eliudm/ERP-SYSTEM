import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { AccountsService } from '../../accounting/services/accounts.service';

const mockPrisma = () => ({
  creditNote: {
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  customer: {
    findUnique: jest.fn(),
  },
  salesInvoice: {
    findUnique: jest.fn(),
  },
  product: {
    update: jest.fn(),
  },
  account: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('CreditNotesService', () => {
  let service: CreditNotesService;
  let prisma: ReturnType<typeof mockPrisma>;
  let postingEngine: { postTransaction: jest.Mock };

  beforeEach(async () => {
    prisma = mockPrisma();
    postingEngine = { postTransaction: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditNotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
        { provide: AccountsService, useValue: {} },
      ],
    }).compile();

    service = module.get<CreditNotesService>(CreditNotesService);
  });

  describe('approve', () => {
    const arAccount = { id: 'acc-ar', code: '1100' };
    const revenueAccount = { id: 'acc-rev', code: '4000' };
    const taxAccount = { id: 'acc-vat', code: '2100' };
    const cogsAccount = { id: 'acc-cogs', code: '5000' };
    const inventoryAccount = { id: 'acc-inv', code: '1200' };

    const baseCn = {
      id: 'cn-1',
      creditNoteNumber: 'CN-00001',
      status: 'DRAFT',
      reason: 'Damaged goods',
      subtotal: 100,
      taxAmount: 16,
      total: 116,
      items: [
        {
          productId: 'prod-1',
          quantity: 2,
          product: { id: 'prod-1', name: 'Widget' },
        },
      ],
    };

    beforeEach(() => {
      prisma.account.findFirst.mockImplementation(({ where: { code } }) => {
        if (code === '1100') return Promise.resolve(arAccount);
        if (code === '4000') return Promise.resolve(revenueAccount);
        if (code === '2100') return Promise.resolve(taxAccount);
        if (code === '5000') return Promise.resolve(cogsAccount);
        if (code === '1200') return Promise.resolve(inventoryAccount);
        return Promise.resolve(null);
      });
      prisma.$transaction.mockResolvedValue([]);
      prisma.creditNote.update.mockResolvedValue({
        ...baseCn,
        status: 'APPROVED',
      });
    });

    it('posts the reversal to the correct accounts (AR 1100, VAT 2100 — not Inventory/Income Tax Payable)', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(baseCn);

      await service.approve('cn-1');

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { code: '1100' },
      });
      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { code: '2100' },
      });
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'CN-JE-CN-00001',
          lines: expect.arrayContaining([
            expect.objectContaining({
              accountId: arAccount.id,
              debit: 0,
              credit: 116,
            }),
            expect.objectContaining({
              accountId: taxAccount.id,
              debit: 16,
              credit: 0,
            }),
          ]),
        }),
      );
    });

    it('does not post COGS/Inventory reversal lines when the product has no costPrice', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(baseCn);

      await service.approve('cn-1');

      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            expect.objectContaining({
              accountId: revenueAccount.id,
              debit: 100,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: taxAccount.id,
              debit: 16,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: arAccount.id,
              debit: 0,
              credit: 116,
            }),
          ],
        }),
      );
    });

    it('posts a COGS/Inventory reversal when the returned product has a costPrice', async () => {
      prisma.creditNote.findUnique.mockResolvedValue({
        ...baseCn,
        items: [
          {
            productId: 'prod-1',
            quantity: 2,
            product: {
              id: 'prod-1',
              name: 'Widget',
              costPrice: 30,
              taxRate: 0.16,
              costPriceIncludesVat: true,
            },
          },
        ],
      });

      await service.approve('cn-1');

      // gross cost: 2*30=60; tax: 60*0.16/1.16=8.28; net COGS reversal=51.72
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            expect.objectContaining({
              accountId: revenueAccount.id,
              debit: 100,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: taxAccount.id,
              debit: 16,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: arAccount.id,
              debit: 0,
              credit: 116,
            }),
            expect.objectContaining({
              accountId: cogsAccount.id,
              debit: 0,
              credit: 51.72,
            }),
            expect.objectContaining({
              accountId: inventoryAccount.id,
              debit: 51.72,
              credit: 0,
            }),
          ],
        }),
      );
    });

    it('restores stock for each returned item', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(baseCn);

      await service.approve('cn-1');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('throws NotFoundException if the credit note does not exist', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(null);

      await expect(service.approve('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if the credit note is not DRAFT', async () => {
      prisma.creditNote.findUnique.mockResolvedValue({
        ...baseCn,
        status: 'APPROVED',
      });

      await expect(service.approve('cn-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if required accounts are missing', async () => {
      prisma.creditNote.findUnique.mockResolvedValue(baseCn);
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.approve('cn-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
