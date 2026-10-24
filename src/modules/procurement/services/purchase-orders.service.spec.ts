import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PrismaService } from '../../../prisma.service';
import { PostingEngineService } from '../../accounting/services/posting-engine.service';
import { StockMovementsService } from '../../inventory/services/stock-movements.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { PurchaseOrderStatus, ApprovalEntityType } from '@prisma/client';

const mockPrisma = () => ({
  purchaseOrder: {
    count: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  supplier: {
    findUnique: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
  account: {
    findFirst: jest.fn(),
  },
  journalEntry: {
    findFirst: jest.fn(),
  },
  vendorBill: {
    count: jest.fn(),
    create: jest.fn(),
  },
});

const mockPostingEngine = () => ({
  postTransaction: jest.fn(),
  voidTransaction: jest.fn(),
});

const mockStockMovements = () => ({
  create: jest.fn(),
});

const mockWorkflowService = () => ({
  assertApprovalIfExists: jest.fn(),
  consumeApprovedRequest: jest.fn(),
});

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let prisma: ReturnType<typeof mockPrisma>;
  let postingEngine: ReturnType<typeof mockPostingEngine>;
  let stockMovements: ReturnType<typeof mockStockMovements>;
  let workflowService: ReturnType<typeof mockWorkflowService>;

  beforeEach(async () => {
    prisma = mockPrisma();
    postingEngine = mockPostingEngine();
    stockMovements = mockStockMovements();
    workflowService = mockWorkflowService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
        { provide: StockMovementsService, useValue: stockMovements },
        { provide: WorkflowService, useValue: workflowService },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  describe('create', () => {
    const dto = {
      supplierId: 'sup-1',
      orderDate: '2024-01-01',
      notes: 'test order',
      items: [
        { productId: 'prod-1', quantity: 2, unitCost: 100, taxRate: 0.1 },
        { productId: 'prod-2', quantity: 1, unitCost: 50, taxRate: 0 },
      ],
    };

    it('should create a purchase order with computed totals', async () => {
      prisma.supplier.findUnique.mockResolvedValue({ id: 'sup-1' });
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1' },
        { id: 'prod-2' },
      ]);
      prisma.purchaseOrder.count.mockResolvedValue(4);
      const expected = { id: 'po-1' };
      prisma.purchaseOrder.create.mockResolvedValue(expected);

      const result = await service.create(dto as any);

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['prod-1', 'prod-2'] } },
      });
      // subtotal: 2*100 + 1*50 = 250; tax: 200*0.1 + 0 = 20; total = 270
      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderNo: 'PO-00005',
          supplierId: 'sup-1',
          status: PurchaseOrderStatus.DRAFT,
          subtotal: 250,
          taxAmount: 20,
          total: 270,
          items: {
            create: [
              {
                productId: 'prod-1',
                quantity: 2,
                unitCost: 100,
                taxRate: 0.1,
                taxAmount: 20,
                lineTotal: 220,
              },
              {
                productId: 'prod-2',
                quantity: 1,
                unitCost: 50,
                taxRate: 0,
                taxAmount: 0,
                lineTotal: 50,
              },
            ],
          },
        }),
        include: { supplier: true, items: { include: { product: true } } },
      });
      expect(result).toBe(expected);
    });

    it('should throw NotFoundException if supplier not found', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.create(dto as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if a product id is not found', async () => {
      prisma.supplier.findUnique.mockResolvedValue({ id: 'sup-1' });
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }]);

      await expect(service.create(dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('approve', () => {
    const po = {
      id: 'po-1',
      orderNo: 'PO-00001',
      status: PurchaseOrderStatus.DRAFT,
      subtotal: 250,
      taxAmount: 20,
      total: 270,
      orderDate: new Date('2024-01-01'),
      supplier: { name: 'Acme' },
    };

    it('should post a journal entry and mark the PO approved', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po);
      prisma.account.findFirst
        .mockResolvedValueOnce({ id: 'acc-ap' })
        .mockResolvedValueOnce({ id: 'acc-inv' })
        .mockResolvedValueOnce({ id: 'acc-vat' });
      const updated = { ...po, status: PurchaseOrderStatus.APPROVED };
      prisma.purchaseOrder.update.mockResolvedValue(updated);

      const result = await service.approve('po-1');

      expect(workflowService.assertApprovalIfExists).toHaveBeenCalledWith(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
      );
      expect(postingEngine.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'PO-APPR-PO-00001',
          sourceType: 'PURCHASE_ORDER',
          sourceId: 'po-1',
          lines: [
            expect.objectContaining({ accountId: 'acc-inv', debit: 250, credit: 0 }),
            expect.objectContaining({ accountId: 'acc-vat', debit: 20, credit: 0 }),
            expect.objectContaining({ accountId: 'acc-ap', debit: 0, credit: 270 }),
          ],
        }),
      );
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po-1' },
        data: { status: PurchaseOrderStatus.APPROVED },
        include: { supplier: true, items: { include: { product: true } } },
      });
      expect(workflowService.consumeApprovedRequest).toHaveBeenCalledWith(
        ApprovalEntityType.PURCHASE_ORDER,
        'po-1',
      );
      expect(result).toBe(updated);
    });

    it('should throw NotFoundException if PO not found', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(service.approve('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if PO is not DRAFT', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        ...po,
        status: PurchaseOrderStatus.APPROVED,
      });

      await expect(service.approve('po-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if required accounts are missing', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po);
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.approve('po-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(postingEngine.postTransaction).not.toHaveBeenCalled();
    });
  });

  describe('receiveGoods', () => {
    const dto = {
      items: [
        { productId: 'prod-1', quantityReceived: 2, warehouseId: 'wh-1' },
      ],
    };
    const po = {
      id: 'po-1',
      orderNo: 'PO-00001',
      status: PurchaseOrderStatus.APPROVED,
      items: [{ productId: 'prod-1', unitCost: 100 }],
    };

    it('should create stock movements and mark the PO received', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po);
      const updated = { ...po, status: PurchaseOrderStatus.RECEIVED };
      prisma.purchaseOrder.update.mockResolvedValue(updated);

      const result = await service.receiveGoods('po-1', dto as any);

      expect(stockMovements.create).toHaveBeenCalledWith({
        productId: 'prod-1',
        warehouseId: 'wh-1',
        movementType: 'IN',
        quantity: 2,
        unitCost: 100,
        reference: 'PO-00001',
        notes: 'Goods received from PO PO-00001',
      });
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po-1' },
        data: { status: PurchaseOrderStatus.RECEIVED },
        include: { supplier: true, items: { include: { product: true } } },
      });
      expect(result).toBe(updated);
    });

    it('should throw NotFoundException if PO not found', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(
        service.receiveGoods('missing', dto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if PO is not APPROVED', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        ...po,
        status: PurchaseOrderStatus.DRAFT,
      });

      await expect(service.receiveGoods('po-1', dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if a received product is not in the PO', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po);

      await expect(
        service.receiveGoods('po-1', {
          items: [
            { productId: 'prod-x', quantityReceived: 1, warehouseId: 'wh-1' },
          ],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('void', () => {
    it('should void a DRAFT purchase order without touching journal entries', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.DRAFT,
      });
      const updated = { id: 'po-1', status: PurchaseOrderStatus.VOID };
      prisma.purchaseOrder.update.mockResolvedValue(updated);

      const result = await service.void('po-1', 'mistake');

      expect(prisma.journalEntry.findFirst).not.toHaveBeenCalled();
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po-1' },
        data: { status: PurchaseOrderStatus.VOID },
      });
      expect(result).toBe(updated);
    });

    it('should void the related journal entry when the PO is APPROVED', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.APPROVED,
      });
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1' });
      prisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.VOID,
      });

      await service.void('po-1', 'cancelled');

      expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith({
        where: { sourceType: 'PURCHASE_ORDER', sourceId: 'po-1' },
      });
      expect(postingEngine.voidTransaction).toHaveBeenCalledWith(
        'je-1',
        'cancelled',
      );
    });

    it('should throw NotFoundException if PO not found', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(service.void('missing', 'x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if PO is RECEIVED', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.RECEIVED,
      });

      await expect(service.void('po-1', 'x')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if PO is already VOID', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.VOID,
      });

      await expect(service.void('po-1', 'x')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createBillFromPO', () => {
    const po = {
      id: 'po-1',
      supplierId: 'sup-1',
      status: 'APPROVED',
      items: [
        {
          productId: 'prod-1',
          quantity: 2,
          unitCost: 100,
          taxRate: 0.1,
          product: { name: 'Widget' },
        },
      ],
    };

    it('should create a vendor bill from an APPROVED purchase order', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po);
      prisma.vendorBill.count.mockResolvedValue(2);
      const bill = { id: 'bill-1' };
      prisma.vendorBill.create.mockResolvedValue(bill);

      const result = await service.createBillFromPO('po-1');

      expect(prisma.vendorBill.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          billNumber: 'BILL-00003',
          supplierId: 'sup-1',
          purchaseOrderId: 'po-1',
          subtotal: 200,
          taxAmount: 20,
          total: 220,
          items: {
            create: [
              expect.objectContaining({
                productId: 'prod-1',
                description: 'Widget',
                quantity: 2,
                unitCost: 100,
                taxAmount: 20,
                lineTotal: 220,
              }),
            ],
          },
        }),
        include: { supplier: true, items: { include: { product: true } } },
      });
      expect(result).toBe(bill);
    });

    it('should throw BadRequestException if PO is not APPROVED or RECEIVED', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        ...po,
        status: 'DRAFT',
      });

      await expect(service.createBillFromPO('po-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated purchase orders', async () => {
      prisma.purchaseOrder.findMany.mockResolvedValue([{ id: 'po-1' }]);
      prisma.purchaseOrder.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, where: {} }),
      );
      expect(result).toEqual({
        data: [{ id: 'po-1' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should filter by status when provided', async () => {
      prisma.purchaseOrder.findMany.mockResolvedValue([]);
      prisma.purchaseOrder.count.mockResolvedValue(0);

      await service.findAll(2, 10, 'DRAFT');

      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10, where: { status: 'DRAFT' } }),
      );
      expect(prisma.purchaseOrder.count).toHaveBeenCalledWith({
        where: { status: 'DRAFT' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a purchase order by id', async () => {
      const po = { id: 'po-1' };
      prisma.purchaseOrder.findUnique.mockResolvedValue(po);

      expect(await service.findOne('po-1')).toBe(po);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSummary', () => {
    it('should compute totals for the period', async () => {
      prisma.purchaseOrder.findMany.mockResolvedValue([
        { status: PurchaseOrderStatus.RECEIVED, total: 100 },
        { status: PurchaseOrderStatus.APPROVED, total: 50 },
      ]);

      const result = await service.getSummary('2024-01-01', '2024-01-31');

      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: PurchaseOrderStatus.VOID },
          }),
        }),
      );
      expect(result).toEqual({
        period: { startDate: '2024-01-01', endDate: '2024-01-31' },
        totalOrders: 2,
        totalValue: 150,
        totalReceived: 100,
        pendingValue: 50,
      });
    });
  });
});
