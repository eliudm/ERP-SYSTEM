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
  stockMovement: {
    create: jest.fn(),
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
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', name: 'Jane' });
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
          subtotal: 250,
          taxAmount: 32,
          total: 282,
          items: {
            create: [
              expect.objectContaining({
                productId: 'prod-1',
                description: 'Widget',
                lineTotal: 232,
                taxAmount: 32,
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
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', name: 'Jane' });
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1', name: 'Widget' }]);

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

      const result = await service.create(
        { ...dto, clientRef: 'offline-123' } as any,
      );

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
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', name: 'Jane', tenantId: 't-1' });
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

      const result = await service.create(
        { ...dto, clientRef: 'offline-456' } as any,
      );

      expect(result).toEqual(winner);
    });
  });

  describe('approve', () => {
    const invoice = {
      id: 'inv-1',
      invoiceNo: 'INV-00001',
      status: InvoiceStatus.DRAFT,
      invoiceDate: new Date('2026-01-01'),
      subtotal: 250,
      taxAmount: 32,
      total: 282,
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

    beforeEach(() => {
      prisma.salesInvoice.findUnique.mockResolvedValue(invoice);
      prisma.warehouse.findFirst.mockResolvedValue(warehouse);
      prisma.account.findFirst.mockImplementation(({ where: { code } }) => {
        if (code === '1100') return Promise.resolve(arAccount);
        if (code === '4000') return Promise.resolve(revenueAccount);
        if (code === '2100') return Promise.resolve(vatAccount);
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
      const result = await service.approve('inv-1', undefined, undefined, 'user-1');

      expect(workflowService.assertApprovalIfExists).toHaveBeenCalledWith(
        'SALES_INVOICE',
        'inv-1',
      );
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'SALE-INV-00001',
          lines: [
            expect.objectContaining({ accountId: arAccount.id, debit: 282, credit: 0 }),
            expect.objectContaining({ accountId: revenueAccount.id, debit: 0, credit: 250 }),
            expect.objectContaining({ accountId: vatAccount.id, debit: 0, credit: 32 }),
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
        if (code === '1000') return Promise.resolve({ id: 'acc-cash', code: '1000' });
        if (code === '1100') return Promise.resolve(arAccount);
        if (code === '4000') return Promise.resolve(revenueAccount);
        if (code === '2100') return Promise.resolve(vatAccount);
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

      const result = await service.void('inv-1', 'customer cancelled', 'user-1');

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
});
