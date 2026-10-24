import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma.service';
import { CacheService } from '../../cache.service';

const mockPrisma = () => ({
  salesInvoice: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  journalLine: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
});

const mockCache = () => ({
  get: jest.fn(),
  set: jest.fn(),
});

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof mockPrisma>;
  let cache: ReturnType<typeof mockCache>;

  beforeEach(async () => {
    prisma = mockPrisma();
    cache = mockCache();
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  const setupPrismaMocks = () => {
    prisma.salesInvoice.aggregate
      .mockResolvedValueOnce({ _sum: { total: 100 } }) // salesToday
      .mockResolvedValueOnce({ _sum: { total: 500 } }); // salesThisMonth
    prisma.salesInvoice.findMany.mockResolvedValue([
      { paymentMethod: 'CASH', total: 100 },
      { paymentMethod: 'CARD', total: 50 },
      { paymentMethod: 'CASH', total: 25 },
    ]);
    prisma.journalLine.findMany.mockResolvedValue([
      { debit: 60, credit: 0 },
      { debit: 0, credit: 10 },
    ]);
    prisma.salesInvoice.count.mockResolvedValue(3);
    prisma.product.findMany.mockResolvedValue([
      { id: '1', code: 'A', name: 'Prod A', stockQuantity: 2, reorderLevel: 5 },
      { id: '2', code: 'B', name: 'Prod B', stockQuantity: 20, reorderLevel: 5 },
    ]);
  };

  describe('getOverview (cache miss)', () => {
    it('computes kpis, payments by method, and low-stock alerts', async () => {
      setupPrismaMocks();

      const result: any = await service.getOverview(
        '2024-01-01',
        '2024-01-31',
      );

      expect(result.kpis).toEqual({
        salesToday: 100,
        salesThisMonth: 500,
        expenses: 50,
        pendingInvoices: 3,
      });
      expect(result.paymentsByMethod).toEqual({ CASH: 125, CARD: 50 });
      expect(result.alerts).toEqual({
        lowStockCount: 1,
        lowStock: [
          { id: '1', code: 'A', name: 'Prod A', stockQuantity: 2, reorderLevel: 5 },
        ],
      });
      expect(result.period).toEqual({
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      });
    });

    it('scopes paid invoices and expense lines to the requested range', async () => {
      setupPrismaMocks();

      await service.getOverview('2024-01-01', '2024-01-31');

      expect(prisma.salesInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paidAt: { gte: new Date('2024-01-01'), lte: new Date('2024-01-31') },
            status: 'PAID',
          }),
        }),
      );
      expect(prisma.journalLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            journalEntry: expect.objectContaining({
              entryDate: { gte: new Date('2024-01-01'), lte: new Date('2024-01-31') },
            }),
          }),
        }),
      );
    });

    it('stores the computed result in the cache with a 60s ttl', async () => {
      setupPrismaMocks();

      const result = await service.getOverview('2024-01-01', '2024-01-31');

      expect(cache.set).toHaveBeenCalledWith(
        'dashboard:overview:2024-01-01:2024-01-31',
        result,
        60,
      );
    });
  });

  describe('getOverview (cache hit)', () => {
    it('returns the cached value without touching prisma', async () => {
      const cached = { kpis: { salesToday: 0 } };
      cache.get.mockResolvedValue(cached);

      const result = await service.getOverview('2024-01-01', '2024-01-31');

      expect(result).toBe(cached);
      expect(prisma.salesInvoice.aggregate).not.toHaveBeenCalled();
      expect(prisma.salesInvoice.findMany).not.toHaveBeenCalled();
      expect(prisma.journalLine.findMany).not.toHaveBeenCalled();
      expect(prisma.salesInvoice.count).not.toHaveBeenCalled();
      expect(prisma.product.findMany).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });
  });
});
