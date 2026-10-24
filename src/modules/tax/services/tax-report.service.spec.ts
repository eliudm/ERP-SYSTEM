import { Test, TestingModule } from '@nestjs/testing';
import { TaxReportService } from './tax-report.service';
import { PrismaService } from '../../../prisma.service';

const mockPrisma = () => ({
  salesInvoice: {
    findMany: jest.fn(),
  },
  vendorBill: {
    findMany: jest.fn(),
  },
  payroll: {
    findMany: jest.fn(),
  },
});

describe('TaxReportService', () => {
  let service: TaxReportService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [TaxReportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TaxReportService>(TaxReportService);
  });

  describe('getVatReturn', () => {
    it('should compute output/input VAT and a payable balance when output exceeds input', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        { subtotal: 1000, taxAmount: 160 },
        { subtotal: 500, taxAmount: 80 },
      ]);
      prisma.vendorBill.findMany.mockResolvedValue([
        { subtotal: 300, taxAmount: 48 },
      ]);

      const result = await service.getVatReturn('2025-01-01', '2025-01-31');

      expect(prisma.salesInvoice.findMany).toHaveBeenCalledWith({
        where: {
          invoiceDate: {
            gte: new Date('2025-01-01'),
            lte: new Date('2025-01-31'),
          },
          status: { in: ['APPROVED', 'PAID'] },
        },
        include: { items: true },
      });
      expect(prisma.vendorBill.findMany).toHaveBeenCalledWith({
        where: {
          billDate: {
            gte: new Date('2025-01-01'),
            lte: new Date('2025-01-31'),
          },
          status: { in: ['APPROVED', 'PAID'] },
        },
        include: { items: true },
      });

      expect(result.outputTax).toEqual({
        numberOfSupplies: 2,
        taxableSales: 1500,
        vatCollected: 240,
      });
      expect(result.inputTax).toEqual({
        numberOfPurchases: 1,
        taxablePurchases: 300,
        vatPaid: 48,
      });
      expect(result.vatPayable).toBe(192);
      expect(result.vatRefundable).toBe(0);
      expect(result.netVat).toBe(192);
      expect(result.period).toEqual({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });
    });

    it('should report a refundable balance when input VAT exceeds output VAT', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([
        { subtotal: 100, taxAmount: 16 },
      ]);
      prisma.vendorBill.findMany.mockResolvedValue([
        { subtotal: 1000, taxAmount: 160 },
      ]);

      const result = await service.getVatReturn('2025-02-01', '2025-02-28');

      expect(result.vatPayable).toBe(0);
      expect(result.vatRefundable).toBe(144);
      expect(result.netVat).toBe(-144);
    });

    it('should return zeroed totals when there are no invoices or bills', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([]);
      prisma.vendorBill.findMany.mockResolvedValue([]);

      const result = await service.getVatReturn('2025-03-01', '2025-03-31');

      expect(result.outputTax).toEqual({
        numberOfSupplies: 0,
        taxableSales: 0,
        vatCollected: 0,
      });
      expect(result.inputTax).toEqual({
        numberOfPurchases: 0,
        taxablePurchases: 0,
        vatPaid: 0,
      });
      expect(result.vatPayable).toBe(0);
      expect(result.vatRefundable).toBe(0);
      expect(result.netVat).toBe(0);
    });
  });

  describe('getWhtReport', () => {
    it('should aggregate PAYE, NHIF and NSSF totals from payrolls in the period', async () => {
      prisma.payroll.findMany.mockResolvedValue([
        { totalGross: 100000, totalPaye: 20000, totalNhif: 1700, totalNssf: 2160 },
        { totalGross: 50000, totalPaye: 8000, totalNhif: 850, totalNssf: 1080 },
      ]);

      const result = await service.getWhtReport('2025-01-01', '2025-01-31');

      expect(prisma.payroll.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date('2025-01-01'),
            lte: new Date('2025-01-31'),
          },
          status: { in: ['APPROVED', 'PAID'] },
        },
        include: { lines: true },
      });

      expect(result.paye).toEqual({
        payrolls: 2,
        totalGross: 150000,
        totalPaye: 28000,
      });
      expect(result.statutory).toEqual({ nhif: 2550, nssf: 3240 });
      expect(result.totalWithholding).toBe(28000 + 2550 + 3240);
      expect(result.period).toEqual({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });
    });

    it('should return zeroed totals when there are no payrolls', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);

      const result = await service.getWhtReport('2025-04-01', '2025-04-30');

      expect(result.paye).toEqual({ payrolls: 0, totalGross: 0, totalPaye: 0 });
      expect(result.statutory).toEqual({ nhif: 0, nssf: 0 });
      expect(result.totalWithholding).toBe(0);
    });
  });

  describe('getTaxSummary', () => {
    it('should build a 12-month summary and sum annual totals', async () => {
      // Every call to getVatReturn (one per month) hits salesInvoice/vendorBill.findMany
      prisma.salesInvoice.findMany.mockResolvedValue([
        { subtotal: 1000, taxAmount: 160 },
      ]);
      prisma.vendorBill.findMany.mockResolvedValue([
        { subtotal: 500, taxAmount: 80 },
      ]);

      const result = await service.getTaxSummary(2025);

      expect(result.year).toBe(2025);
      expect(result.months).toHaveLength(12);
      expect(result.months[0]).toEqual({
        month: 1,
        name: 'January',
        outputVat: 160,
        inputVat: 80,
        vatPayable: 80,
      });
      expect(result.months[11].name).toBe('December');

      // 12 months * 160 output / 80 input / 80 payable each
      expect(result.annualTotals).toEqual({
        outputVat: 160 * 12,
        inputVat: 80 * 12,
        vatPayable: 80 * 12,
      });
      expect(prisma.salesInvoice.findMany).toHaveBeenCalledTimes(12);
      expect(prisma.vendorBill.findMany).toHaveBeenCalledTimes(12);
    });

    it('should return zeroed annual totals when there is no activity all year', async () => {
      prisma.salesInvoice.findMany.mockResolvedValue([]);
      prisma.vendorBill.findMany.mockResolvedValue([]);

      const result = await service.getTaxSummary(2024);

      expect(result.annualTotals).toEqual({
        outputVat: 0,
        inputVat: 0,
        vatPayable: 0,
      });
    });
  });
});
