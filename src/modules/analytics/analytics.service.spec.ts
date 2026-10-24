import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma.service';
import { CacheService } from '../../cache.service';

const mockPrisma = () => ({
  salesInvoice: { findMany: jest.fn() },
  journalLine: { findMany: jest.fn() },
  salesInvoiceItem: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
});

const mockCache = () => ({
  get: jest.fn(),
  set: jest.fn(),
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: ReturnType<typeof mockPrisma>;
  let cache: ReturnType<typeof mockCache>;

  beforeEach(async () => {
    prisma = mockPrisma();
    cache = mockCache();
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('cache-hit path', () => {
    it('returns the cached value without calling prisma', async () => {
      const cached = { granularity: 'month', data: [], totals: {} };
      cache.get.mockResolvedValue(cached);

      const result = await service.getSalesTrend('2024-01-01', '2024-02-28');

      expect(result).toBe(cached);
      expect(prisma.salesInvoice.findMany).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });
  });

  describe('getSalesTrend', () => {
    it('aggregates invoice totals and tax by month', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        { invoiceDate: new Date('2024-01-05'), total: 100, taxAmount: 10 },
        { invoiceDate: new Date('2024-01-20'), total: 200, taxAmount: 20 },
        { invoiceDate: new Date('2024-02-10'), total: 50, taxAmount: 5 },
      ]);

      const result = await service.getSalesTrend(
        '2024-01-01',
        '2024-02-28',
        'month',
      );

      expect(result.data).toEqual([
        { period: '2024-01', revenue: 300, tax: 30, count: 2 },
        { period: '2024-02', revenue: 50, tax: 5, count: 1 },
      ]);
      expect(result.totals).toEqual({ revenue: 350, tax: 35, count: 3 });
      expect(cache.set).toHaveBeenCalledWith(
        'analytics:sales-trend:2024-01-01:2024-02-28:month',
        result,
        120,
      );
    });

    it('buckets by day when granularity is day', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        { invoiceDate: new Date('2024-01-05'), total: 100, taxAmount: 10 },
        { invoiceDate: new Date('2024-01-05'), total: 20, taxAmount: 2 },
      ]);

      const result = await service.getSalesTrend(
        '2024-01-01',
        '2024-01-31',
        'day',
      );

      expect(result.data).toEqual([
        { period: '2024-01-05', revenue: 120, tax: 12, count: 2 },
      ]);
    });
  });

  describe('getExpenseTrend', () => {
    it('nets debit minus credit for expense accounts by month, sorted ascending', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        { debit: 50, credit: 0, journalEntry: { entryDate: new Date('2024-02-01') } },
        { debit: 100, credit: 0, journalEntry: { entryDate: new Date('2024-01-05') } },
        { debit: 0, credit: 30, journalEntry: { entryDate: new Date('2024-01-15') } },
      ]);

      const result = await service.getExpenseTrend(
        '2024-01-01',
        '2024-02-28',
        'month',
      );

      expect(result.data).toEqual([
        { period: '2024-01', amount: 70 },
        { period: '2024-02', amount: 50 },
      ]);
      expect(result.total).toBe(120);
    });
  });

  describe('getProfitTrend', () => {
    it('computes revenue, expense and profit per period with margin', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        { debit: 0, credit: 500, account: { type: 'REVENUE' }, journalEntry: { entryDate: new Date('2024-01-10') } },
        { debit: 200, credit: 0, account: { type: 'EXPENSE' }, journalEntry: { entryDate: new Date('2024-01-15') } },
        { debit: 0, credit: 300, account: { type: 'REVENUE' }, journalEntry: { entryDate: new Date('2024-02-01') } },
        { debit: 100, credit: 0, account: { type: 'EXPENSE' }, journalEntry: { entryDate: new Date('2024-02-05') } },
      ]);

      const result = await service.getProfitTrend(
        '2024-01-01',
        '2024-02-28',
        'month',
      );

      expect(result.data).toEqual([
        { period: '2024-01', revenue: 500, expense: 200, profit: 300 },
        { period: '2024-02', revenue: 300, expense: 100, profit: 200 },
      ]);
      expect(result.totals).toEqual({
        revenue: 800,
        expense: 300,
        profit: 500,
        margin: 62.5,
      });
    });

    it('returns zero margin when total revenue is zero', async () => {
      prisma.journalLine.findMany.mockResolvedValue([
        { debit: 100, credit: 0, account: { type: 'EXPENSE' }, journalEntry: { entryDate: new Date('2024-01-15') } },
      ]);

      const result = await service.getProfitTrend('2024-01-01', '2024-01-31');

      expect(result.totals.margin).toBe(0);
    });
  });

  describe('getTopProducts', () => {
    it('ranks products by revenue descending and respects the limit', async () => {
      prisma.salesInvoiceItem.findMany.mockResolvedValue([
        { productId: 'p1', lineTotal: 100, quantity: 2, product: { id: 'p1', code: 'A', name: 'Prod A' } },
        { productId: 'p2', lineTotal: 300, quantity: 1, product: { id: 'p2', code: 'B', name: 'Prod B' } },
        { productId: 'p1', lineTotal: 50, quantity: 1, product: { id: 'p1', code: 'A', name: 'Prod A' } },
      ]);

      const result = await service.getTopProducts(
        '2024-01-01',
        '2024-01-31',
        1,
      );

      expect(result.data).toEqual([
        { productId: 'p2', code: 'B', name: 'Prod B', revenue: 300, quantitySold: 1 },
      ]);
    });

    it('defaults the limit to 10 and merges quantity across invoices', async () => {
      prisma.salesInvoiceItem.findMany.mockResolvedValue([
        { productId: 'p1', lineTotal: 100, quantity: 2, product: { id: 'p1', code: 'A', name: 'Prod A' } },
        { productId: 'p1', lineTotal: 50, quantity: 1, product: { id: 'p1', code: 'A', name: 'Prod A' } },
      ]);

      const result = await service.getTopProducts('2024-01-01', '2024-01-31');

      expect(result.limit).toBe(10);
      expect(result.data).toEqual([
        { productId: 'p1', code: 'A', name: 'Prod A', revenue: 150, quantitySold: 3 },
      ]);
    });
  });

  describe('getTopCustomers', () => {
    it('ranks customers by revenue descending and respects the limit', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        { customerId: 'c1', total: 100, customer: { id: 'c1', name: 'Alice', email: 'a@x.com' } },
        { customerId: 'c2', total: 400, customer: { id: 'c2', name: 'Bob', email: 'b@x.com' } },
        { customerId: 'c1', total: 50, customer: { id: 'c1', name: 'Alice', email: 'a@x.com' } },
      ]);

      const result = await service.getTopCustomers(
        '2024-01-01',
        '2024-01-31',
        1,
      );

      expect(result.data).toEqual([
        { customerId: 'c2', name: 'Bob', email: 'b@x.com', revenue: 400, invoiceCount: 1 },
      ]);
    });

    it('accumulates revenue and invoice count per customer', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        { customerId: 'c1', total: 100, customer: { id: 'c1', name: 'Alice', email: 'a@x.com' } },
        { customerId: 'c1', total: 50, customer: { id: 'c1', name: 'Alice', email: 'a@x.com' } },
      ]);

      const result = await service.getTopCustomers('2024-01-01', '2024-01-31');

      expect(result.data).toEqual([
        { customerId: 'c1', name: 'Alice', email: 'a@x.com', revenue: 150, invoiceCount: 2 },
      ]);
    });
  });

  describe('getSalesByPaymentMethod', () => {
    it('groups paid invoice totals by payment method', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        { paymentMethod: 'CASH', total: 100 },
        { paymentMethod: 'CARD', total: 200 },
        { paymentMethod: 'CASH', total: 50 },
      ]);

      const result = await service.getSalesByPaymentMethod(
        '2024-01-01',
        '2024-01-31',
      );

      expect(result.data).toEqual([
        { paymentMethod: 'CASH', count: 2, amount: 150 },
        { paymentMethod: 'CARD', count: 1, amount: 200 },
      ]);
      expect(result.total).toBe(350);
    });
  });

  describe('getInventorySummary', () => {
    it('summarizes stock value and low-stock counts by category', async () => {
      prisma.product.findMany.mockResolvedValue([
        { stockQuantity: 5, unitPrice: 10, reorderLevel: 10, category: { name: 'Cat A' } },
        { stockQuantity: 20, unitPrice: 5, reorderLevel: 10, category: { name: 'Cat A' } },
        { stockQuantity: 2, unitPrice: 50, reorderLevel: 5, category: null },
      ]);

      const result = await service.getInventorySummary();

      expect(result.totalProducts).toBe(3);
      expect(result.totalValue).toBe(250);
      expect(result.totalLowStock).toBe(2);
      expect(result.byCategory).toEqual([
        { category: 'Cat A', count: 2, totalValue: 150, lowStockCount: 1 },
        { category: 'Uncategorized', count: 1, totalValue: 100, lowStockCount: 1 },
      ]);
      expect(cache.set).toHaveBeenCalledWith(
        'analytics:inventory-summary',
        result,
        120,
      );
    });
  });
});
