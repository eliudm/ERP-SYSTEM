import { Test, TestingModule } from '@nestjs/testing';
import { MobileService } from './mobile.service';
import { PrismaService } from '../../prisma.service';

const mockPrisma = () => ({
  product: {
    findMany: jest.fn(),
    count: jest.fn(),
    fields: { reorderLevel: 'reorderLevel' },
  },
  productCategory: {
    findMany: jest.fn(),
  },
  salesInvoice: {
    aggregate: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  approvalRequest: {
    count: jest.fn(),
  },
  notification: {
    count: jest.fn(),
  },
  customer: {
    count: jest.fn(),
  },
});

describe('MobileService', () => {
  let service: MobileService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MobileService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<MobileService>(MobileService);
  });

  describe('getPosData', () => {
    it('should return products, categories, and payment methods', async () => {
      const products = [
        {
          id: 'p1',
          code: 'P001',
          barcode: '123',
          name: 'Product 1',
          unitPrice: '100.00',
          taxRate: '16.00',
          stockQuantity: '50',
          categoryId: 'cat-1',
        },
      ];
      const categories = [
        { id: 'cat-1', name: 'Cat A', color: '#fff', icon: 'box' },
      ];

      prisma.product.findMany.mockResolvedValue(products);
      prisma.productCategory.findMany.mockResolvedValue(categories);

      const result = await service.getPosData();

      expect(result.products).toHaveLength(1);
      expect(result.products[0].unitPrice).toBe(100);
      expect(result.products[0].taxRate).toBe(16);
      expect(result.products[0].stockQuantity).toBe(50);
      expect(result.categories).toEqual(categories);
      expect(result.paymentMethods).toContain('CASH');
      expect(result.paymentMethods).toContain('MOBILE_MONEY');
    });
  });

  describe('getMobileDashboard', () => {
    it('should return compact dashboard KPIs', async () => {
      prisma.salesInvoice.aggregate
        .mockResolvedValueOnce({ _sum: { total: '5000' }, _count: 3 })
        .mockResolvedValueOnce({ _sum: { total: '25000' } });
      prisma.salesInvoice.count.mockResolvedValue(5);
      prisma.approvalRequest.count.mockResolvedValue(2);
      prisma.product.count.mockResolvedValue(1);
      prisma.notification.count.mockResolvedValue(7);

      const result = await service.getMobileDashboard();

      expect(result.salesToday).toEqual({ amount: 5000, count: 3 });
      expect(result.salesThisMonth).toBe(25000);
      expect(result.pendingInvoices).toBe(5);
      expect(result.pendingApprovals).toBe(2);
      expect(result.lowStockCount).toBe(1);
      expect(result.unreadNotifications).toBe(7);
      expect(result.serverTime).toBeDefined();
    });

    it('should default to 0 if lowStockCount query fails', async () => {
      prisma.salesInvoice.aggregate
        .mockResolvedValueOnce({ _sum: { total: null }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { total: null } });
      prisma.salesInvoice.count.mockResolvedValue(0);
      prisma.approvalRequest.count.mockResolvedValue(0);
      prisma.product.count.mockRejectedValue(new Error('query error'));
      prisma.notification.count.mockResolvedValue(0);

      const result = await service.getMobileDashboard();

      expect(result.lowStockCount).toBe(0);
      expect(result.salesToday.amount).toBe(0);
    });
  });

  describe('quickSearch', () => {
    it('should return matching products', async () => {
      const products = [{ id: 'p1', name: 'Widget', code: 'W001' }];
      prisma.product.findMany.mockResolvedValue(products);

      const result = await service.quickSearch('Widget');

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: { contains: 'Widget', mode: 'insensitive' },
              }),
            ]),
          }),
          take: 20,
        }),
      );
      expect(result).toEqual(products);
    });

    it('should return empty array for short queries', async () => {
      expect(await service.quickSearch('a')).toEqual([]);
      expect(await service.quickSearch('')).toEqual([]);
    });
  });

  describe('getRecentInvoices', () => {
    it('should return recent invoices with numeric totals', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNo: 'INV-001',
          invoiceDate: new Date(),
          status: 'PAID',
          total: '1500.00',
          paymentMethod: 'CASH',
          customer: { id: 'c1', name: 'Customer 1' },
        },
      ]);

      const result = await service.getRecentInvoices(10);

      expect(prisma.salesInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
      expect(result[0].total).toBe(1500);
    });

    it('should default to 20 invoices', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([]);

      await service.getRecentInvoices();

      expect(prisma.salesInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });
  });

  describe('getSyncStatus', () => {
    it('should return counts and last invoice timestamp', async () => {
      const lastDate = new Date('2026-04-12T10:00:00Z');
      prisma.product.count.mockResolvedValue(100);
      prisma.customer.count.mockResolvedValue(50);
      prisma.salesInvoice.findFirst.mockResolvedValue({ createdAt: lastDate });

      const result = await service.getSyncStatus();

      expect(result.productCount).toBe(100);
      expect(result.customerCount).toBe(50);
      expect(result.lastInvoiceAt).toEqual(lastDate);
      expect(result.serverTime).toBeDefined();
    });

    it('should return null lastInvoiceAt if no invoices', async () => {
      prisma.product.count.mockResolvedValue(0);
      prisma.customer.count.mockResolvedValue(0);
      prisma.salesInvoice.findFirst.mockResolvedValue(null);

      const result = await service.getSyncStatus();
      expect(result.lastInvoiceAt).toBeNull();
    });
  });
});
