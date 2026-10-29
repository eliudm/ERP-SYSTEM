import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { EtimsQueueService } from '../../etims/etims-queue/etims-queue.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditService } from '../../audit/audit.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentMethod, Prisma } from '@prisma/client';

const mockPrisma = () => ({
  salesInvoice: {
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  customer: {
    findUnique: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  warehouse: {
    findFirst: jest.fn(),
  },
  account: {
    findFirst: jest.fn(),
  },
  journalEntry: {
    findFirst: jest.fn(),
  },
  journalLine: {
    findFirst: jest.fn(),
  },
  stockMovement: {
    create: jest.fn(),
  },
  posSession: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: ReturnType<typeof mockPrisma>;
  let postingEngine: { postTransaction: jest.Mock; voidTransaction: jest.Mock };
  let etimsQueue: { addSubmitJob: jest.Mock };
  let notificationsService: { checkAndNotifyLowStock: jest.Mock };
  let auditService: { log: jest.Mock };
  let workflowService: {
    assertApprovalIfExists: jest.Mock;
    consumeApprovedRequest: jest.Mock;
  };

  beforeEach(async () => {
    prisma = mockPrisma();
    postingEngine = {
      postTransaction: jest.fn().mockResolvedValue({}),
      voidTransaction: jest.fn().mockResolvedValue({}),
    };
    etimsQueue = { addSubmitJob: jest.fn().mockResolvedValue({}) };
    notificationsService = {
      checkAndNotifyLowStock: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { log: jest.fn().mockResolvedValue({}) };
    workflowService = {
      assertApprovalIfExists: jest.fn().mockResolvedValue(undefined),
      consumeApprovedRequest: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
        { provide: EtimsQueueService, useValue: etimsQueue },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuditService, useValue: auditService },
        { provide: WorkflowService, useValue: workflowService },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  describe('create', () => {
    const dto = {
      customerId: 'cust-1',
      invoiceDate: '2026-01-01',
      items: [
        { productId: 'prod-1', quantity: 2, unitPrice: 100, taxRate: 0.16 },
        { productId: 'prod-2', quantity: 1, unitPrice: 50, taxRate: 0 },
      ],
    };

    it('should batch-fetch products, compute totals, and create the invoice', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        name: 'Jane',
      });
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Widget' },
        { id: 'prod-2', name: 'Gadget' },
      ]);
      prisma.salesInvoice.count.mockResolvedValue(0);
      const created = {
        id: 'inv-1',
        invoiceNo: 'INV-00001',
        customerId: 'cust-1',
        total: 282,
        status: InvoiceStatus.DRAFT,
      };
      prisma.salesInvoice.create.mockResolvedValue(created);

      const result = await service.create(dto as any, 'user-1');

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['prod-1', 'prod-2'] } },
      });
      expect(prisma.salesInvoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceNo: 'INV-00001',
          customerId: 'cust-1',
          status: InvoiceStatus.DRAFT,
          subtotal: 222.41,
          taxAmount: 27.59,
          total: 250,
          items: {
            create: [
              expect.objectContaining({
                productId: 'prod-1',
                description: 'Widget',
                lineTotal: 200,
                taxAmount: 27.59,
              }),
              expect.objectContaining({
                productId: 'prod-2',
                description: 'Gadget',
                lineTotal: 50,
                taxAmount: 0,
              }),
            ],
          },
        }),
        include: { customer: true, items: { include: { product: true } } },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'CREATE',
          tableName: 'sales_invoices',
          recordId: created.id,
        }),
      );
      expect(result).toEqual(created);
    });

    it('should throw NotFoundException if the customer does not exist', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.create(dto as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if a product from the batch lookup is missing', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        name: 'Jane',
      });
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Widget' },
      ]);

      await expect(service.create(dto as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.salesInvoice.create).not.toHaveBeenCalled();
    });

    it('should return the existing invoice for a clientRef already used, without creating a duplicate or re-validating the customer', async () => {
      const existing = {
        id: 'inv-1',
        invoiceNo: 'INV-00001',
        clientRef: 'offline-123',
      };
      prisma.salesInvoice.findFirst.mockResolvedValue(existing);

      const result = await service.create({
        ...dto,
        clientRef: 'offline-123',
      } as any);

      expect(prisma.salesInvoice.findFirst).toHaveBeenCalledWith({
        where: { clientRef: 'offline-123' },
        include: { customer: true, items: { include: { product: true } } },
      });
      expect(prisma.customer.findUnique).not.toHaveBeenCalled();
      expect(prisma.salesInvoice.create).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it('should self-heal a P2002 race on clientRef by returning the row that won', async () => {
      prisma.salesInvoice.findFirst.mockResolvedValueOnce(null); // no existing row yet
      prisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        name: 'Jane',
        tenantId: 't-1',
      });
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Widget' },
        { id: 'prod-2', name: 'Gadget' },
      ]);
      prisma.salesInvoice.count.mockResolvedValue(0);

      const raceError = Object.assign(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['tenantId', 'clientRef'] },
        } as any),
        {},
      );
      prisma.salesInvoice.create.mockRejectedValue(raceError);

      const winner = {
        id: 'inv-2',
        invoiceNo: 'INV-00002',
        clientRef: 'offline-456',
      };
      prisma.salesInvoice.findFirst.mockResolvedValueOnce(winner); // re-fetch after the race

      const result = await service.create({
        ...dto,
        clientRef: 'offline-456',
      } as any);

      expect(result).toEqual(winner);
    });

    it("attributes the invoice to the cashier's open POS session", async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        name: 'Jane',
      });
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Widget' },
        { id: 'prod-2', name: 'Gadget' },
      ]);
      prisma.salesInvoice.count.mockResolvedValue(0);
      prisma.posSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        status: 'OPEN',
        cashierId: 'user-1',
      });
      prisma.salesInvoice.create.mockResolvedValue({ id: 'inv-1' });

      await service.create(dto as any, 'user-1');

      expect(prisma.posSession.findFirst).toHaveBeenCalledWith({
        where: { cashierId: 'user-1', status: 'OPEN' },
      });
      expect(prisma.salesInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cashierId: 'user-1',
            posSessionId: 'sess-1',
          }),
        }),
      );
    });
  });

  describe('approve', () => {
    const invoice = {
      id: 'inv-1',
      invoiceNo: 'INV-00001',
      status: InvoiceStatus.DRAFT,
      invoiceDate: new Date('2026-01-01'),
      subtotal: 222.41,
      taxAmount: 27.59,
      total: 250,
      customer: { id: 'cust-1', name: 'Jane' },
      items: [
        {
          productId: 'prod-1',
          quantity: 2,
          product: { id: 'prod-1', name: 'Widget', stockQuantity: 10 },
        },
      ],
    };
    const warehouse = { id: 'wh-1', branchId: 'branch-1' };
    const arAccount = { id: 'acc-ar', code: '1100' };
    const revenueAccount = { id: 'acc-rev', code: '4000' };
    const vatAccount = { id: 'acc-vat', code: '2100' };
    const cogsAccount = { id: 'acc-cogs', code: '5000' };
    const inventoryAccount = { id: 'acc-inv', code: '1200' };

    beforeEach(() => {
      prisma.salesInvoice.findUnique.mockResolvedValue(invoice);
      prisma.warehouse.findFirst.mockResolvedValue(warehouse);
      prisma.account.findFirst.mockImplementation(({ where: { code } }) => {
        if (code === '1100') return Promise.resolve(arAccount);
        if (code === '4000') return Promise.resolve(revenueAccount);
        if (code === '2100') return Promise.resolve(vatAccount);
        if (code === '5000') return Promise.resolve(cogsAccount);
        if (code === '1200') return Promise.resolve(inventoryAccount);
        return Promise.resolve(null);
      });
      prisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          stockMovement: { create: jest.fn().mockResolvedValue({}) },
          product: { update: jest.fn().mockResolvedValue({}) },
          salesInvoice: {
            update: jest.fn().mockResolvedValue({
              ...invoice,
              status: InvoiceStatus.APPROVED,
              branchId: warehouse.branchId,
            }),
          },
        };
        return cb(tx);
      });
    });

    it('should post the journal entry, move stock, and approve the invoice', async () => {
      const result = await service.approve(
        'inv-1',
        undefined,
        undefined,
        'user-1',
      );

      expect(workflowService.assertApprovalIfExists).toHaveBeenCalledWith(
        'SALES_INVOICE',
        'inv-1',
      );
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'SALE-INV-00001',
          lines: [
            expect.objectContaining({
              accountId: arAccount.id,
              debit: 250,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: revenueAccount.id,
              debit: 0,
              credit: 222.41,
            }),
            expect.objectContaining({
              accountId: vatAccount.id,
              debit: 0,
              credit: 27.59,
            }),
          ],
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'APPROVE', recordId: 'inv-1' }),
      );
      expect(workflowService.consumeApprovedRequest).toHaveBeenCalledWith(
        'SALES_INVOICE',
        'inv-1',
      );
      expect(etimsQueue.addSubmitJob).toHaveBeenCalledWith('inv-1');
      expect(result.status).toBe(InvoiceStatus.APPROVED);
    });

    it('should also post COGS/Inventory lines when the sold product has a costPrice', async () => {
      prisma.salesInvoice.findUnique.mockResolvedValue({
        ...invoice,
        items: [
          {
            productId: 'prod-1',
            quantity: 2,
            product: {
              id: 'prod-1',
              name: 'Widget',
              stockQuantity: 10,
              costPrice: 50,
              taxRate: 0.16,
              costPriceIncludesVat: true,
            },
          },
        ],
      });

      let capturedTx: any;
      prisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          stockMovement: { create: jest.fn().mockResolvedValue({}) },
          product: { update: jest.fn().mockResolvedValue({}) },
          salesInvoice: {
            update: jest.fn().mockResolvedValue({
              ...invoice,
              status: InvoiceStatus.APPROVED,
              branchId: warehouse.branchId,
            }),
          },
        };
        capturedTx = tx;
        return cb(tx);
      });

      await service.approve('inv-1', undefined, undefined, 'user-1');

      // gross cost: 2*50=100; tax: 100*0.16/1.16=13.79; net COGS=86.21
      expect(capturedTx.salesInvoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cogsAmount: 86.21 }),
        }),
      );
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'SALE-INV-00001',
          lines: [
            expect.objectContaining({
              accountId: arAccount.id,
              debit: 250,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: revenueAccount.id,
              debit: 0,
              credit: 222.41,
            }),
            expect.objectContaining({
              accountId: vatAccount.id,
              debit: 0,
              credit: 27.59,
            }),
            expect.objectContaining({
              accountId: cogsAccount.id,
              debit: 86.21,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: inventoryAccount.id,
              debit: 0,
              credit: 86.21,
            }),
          ],
        }),
      );
    });

    it('should throw NotFoundException if the invoice does not exist', async () => {
      prisma.salesInvoice.findUnique.mockResolvedValue(null);

      await expect(service.approve('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if the invoice is not DRAFT', async () => {
      prisma.salesInvoice.findUnique.mockResolvedValue({
        ...invoice,
        status: InvoiceStatus.APPROVED,
      });

      await expect(service.approve('inv-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if no active warehouse is found', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(service.approve('inv-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if stock is insufficient', async () => {
      prisma.salesInvoice.findUnique.mockResolvedValue({
        ...invoice,
        items: [
          {
            productId: 'prod-1',
            quantity: 20,
            product: { id: 'prod-1', name: 'Widget', stockQuantity: 10 },
          },
        ],
      });

      await expect(service.approve('inv-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if required accounts are missing', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.approve('inv-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mark the invoice as paid immediately for instant-settlement methods', async () => {
      prisma.salesInvoice.findUnique
        .mockResolvedValueOnce(invoice)
        .mockResolvedValueOnce({ ...invoice, status: InvoiceStatus.APPROVED });
      prisma.salesInvoice.update.mockResolvedValue({
        ...invoice,
        status: InvoiceStatus.PAID,
        paymentMethod: PaymentMethod.CASH,
      });
      prisma.account.findFirst.mockImplementation(({ where: { code } }) => {
        if (code === '1000')
          return Promise.resolve({ id: 'acc-cash', code: '1000' });
        if (code === '1100') return Promise.resolve(arAccount);
        if (code === '4000') return Promise.resolve(revenueAccount);
        if (code === '2100') return Promise.resolve(vatAccount);
        if (code === '5000') return Promise.resolve(cogsAccount);
        if (code === '1200') return Promise.resolve(inventoryAccount);
        return Promise.resolve(null);
      });

      const result = await service.approve(
        'inv-1',
        undefined,
        PaymentMethod.CASH,
        'user-1',
      );

      expect(result.status).toBe(InvoiceStatus.PAID);
    });
  });

  describe('void', () => {
    it('should void the invoice and the related journal entry', async () => {
      prisma.salesInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.APPROVED,
      });
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1' });
      prisma.salesInvoice.update.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.VOID,
      });

      const result = await service.void(
        'inv-1',
        'customer cancelled',
        'user-1',
      );

      expect(postingEngine.voidTransaction).toHaveBeenCalledWith(
        'je-1',
        'customer cancelled',
        'user-1',
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VOID', recordId: 'inv-1' }),
      );
      expect(result.status).toBe(InvoiceStatus.VOID);
    });

    it('should throw NotFoundException if the invoice does not exist', async () => {
      prisma.salesInvoice.findUnique.mockResolvedValue(null);

      await expect(service.void('missing', 'reason')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if already voided', async () => {
      prisma.salesInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.VOID,
      });

      await expect(service.void('inv-1', 'reason')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if the invoice is already paid', async () => {
      prisma.salesInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.PAID,
      });

      await expect(service.void('inv-1', 'reason')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDailySummary', () => {
    it('should default to the whole calendar day when no time window is given', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([]);

      await service.getDailySummary('2026-04-02');

      expect(prisma.salesInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-04-02T00:00:00'),
              lte: new Date('2026-04-02T23:59:59'),
            },
          }),
        }),
      );
    });

    it('should narrow the query to a given time-of-day window', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([]);

      await service.getDailySummary('2026-04-02', '14:00', '18:00');

      expect(prisma.salesInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-04-02T14:00:00'),
              lte: new Date('2026-04-02T18:00:59'),
            },
          }),
        }),
      );
    });

    it('should compute gross profit from subtotal minus cogsAmount, skipping invoices with no cost data', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        {
          total: 250,
          subtotal: 222.41,
          cogsAmount: 86.21,
          paymentMethod: PaymentMethod.CASH,
          status: InvoiceStatus.APPROVED,
          invoiceNo: 'INV-1',
        },
        {
          total: 100,
          subtotal: 86.21,
          cogsAmount: null,
          paymentMethod: PaymentMethod.CARD,
          status: InvoiceStatus.APPROVED,
          invoiceNo: 'INV-2',
        },
      ]);

      const result = await service.getDailySummary('2026-04-02');

      expect(result.totalOrders).toBe(2);
      expect(result.totalRevenue).toBe(350);
      expect(result.totalCogs).toBe(86.21);
      expect(result.grossProfit).toBeCloseTo(222.41);
      expect(result.invoicesMissingCostData).toBe(1);
      expect(result.byPaymentMethod).toEqual([
        { method: PaymentMethod.CASH, amount: 250, orders: 1 },
        { method: PaymentMethod.CARD, amount: 100, orders: 1 },
      ]);
    });
  });

  describe('backfillCogs', () => {
    const cogsAccount = { id: 'acc-cogs', code: '5000' };
    const inventoryAccount = { id: 'acc-inv', code: '1200' };

    beforeEach(() => {
      prisma.account.findFirst.mockImplementation(
        ({ where: { code } }: any) => {
          if (code === '5000') return Promise.resolve(cogsAccount);
          if (code === '1200') return Promise.resolve(inventoryAccount);
          return Promise.resolve(null);
        },
      );
    });

    it('stores cogsAmount and posts a catch-up entry for an invoice with no COGS posted yet', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNo: 'INV-1',
          invoiceDate: new Date('2026-01-01'),
          cogsAmount: null,
          items: [
            {
              productId: 'prod-1',
              quantity: 2,
              product: {
                costPrice: 50,
                taxRate: 0.16,
                costPriceIncludesVat: true,
              },
            },
          ],
        },
      ]);
      prisma.journalLine.findFirst.mockResolvedValue(null);

      const result = await service.backfillCogs();

      expect(prisma.salesInvoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { cogsAmount: 86.21 },
      });
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'COGS-INV-1' }),
      );
      expect(result.posted).toBe(1);
      expect(result.skippedAlreadyBackfilled).toBe(0);
    });

    it('backfills cogsAmount without re-posting when COGS was already posted (e.g. bundled into a normal approve())', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-2',
          invoiceNo: 'INV-2',
          invoiceDate: new Date('2026-01-01'),
          cogsAmount: null,
          items: [
            {
              productId: 'prod-1',
              quantity: 2,
              product: {
                costPrice: 50,
                taxRate: 0.16,
                costPriceIncludesVat: true,
              },
            },
          ],
        },
      ]);
      prisma.journalLine.findFirst.mockResolvedValue({ id: 'line-1' });

      const result = await service.backfillCogs();

      expect(prisma.salesInvoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-2' },
        data: { cogsAmount: 86.21 },
      });
      expect(postingEngine.postTransaction).not.toHaveBeenCalled();
      expect(result.posted).toBe(0);
      expect(result.skippedAlreadyBackfilled).toBe(1);
    });

    it('skips invoices that already have cogsAmount stored and no new posting needed', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-3',
          invoiceNo: 'INV-3',
          invoiceDate: new Date('2026-01-01'),
          cogsAmount: 86.21,
          items: [
            {
              productId: 'prod-1',
              quantity: 2,
              product: {
                costPrice: 50,
                taxRate: 0.16,
                costPriceIncludesVat: true,
              },
            },
          ],
        },
      ]);
      prisma.journalLine.findFirst.mockResolvedValue({ id: 'line-1' });

      await service.backfillCogs();

      expect(prisma.salesInvoice.update).not.toHaveBeenCalled();
    });

    it('skips posting (but still records cogsAmount as 0) when no sold product has cost data', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-4',
          invoiceNo: 'INV-4',
          invoiceDate: new Date('2026-01-01'),
          cogsAmount: null,
          items: [
            {
              productId: 'prod-1',
              quantity: 2,
              product: {
                costPrice: null,
                taxRate: 0.16,
                costPriceIncludesVat: true,
              },
            },
          ],
        },
      ]);
      prisma.journalLine.findFirst.mockResolvedValue(null);

      const result = await service.backfillCogs();

      expect(prisma.salesInvoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-4' },
        data: { cogsAmount: 0 },
      });
      expect(postingEngine.postTransaction).not.toHaveBeenCalled();
      expect(result.skippedNoCostData).toBe(1);
    });
  });
});
