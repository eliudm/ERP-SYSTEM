import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

const mockAnalyticsService = () => ({
  getSalesTrend: jest.fn(),
  getExpenseTrend: jest.fn(),
  getProfitTrend: jest.fn(),
  getTopProducts: jest.fn(),
  getTopCustomers: jest.fn(),
  getSalesByPaymentMethod: jest.fn(),
  getInventorySummary: jest.fn(),
});

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: ReturnType<typeof mockAnalyticsService>;

  beforeEach(async () => {
    service = mockAnalyticsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: service }],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  describe('getSalesTrend', () => {
    it('delegates to the service with month granularity by default', async () => {
      const expected = { data: [] };
      service.getSalesTrend.mockResolvedValue(expected);

      const result = await controller.getSalesTrend(
        '2024-01-01',
        '2024-01-31',
      );

      expect(service.getSalesTrend).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
        'month',
      );
      expect(result).toBe(expected);
    });

    it('passes day granularity through when requested', async () => {
      service.getSalesTrend.mockResolvedValue({ data: [] });

      await controller.getSalesTrend('2024-01-01', '2024-01-31', 'day');

      expect(service.getSalesTrend).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
        'day',
      );
    });

    it('throws BadRequestException when startDate or endDate is missing', () => {
      expect(() => controller.getSalesTrend('', '2024-01-31')).toThrow(
        BadRequestException,
      );
      expect(service.getSalesTrend).not.toHaveBeenCalled();
    });

    it('throws BadRequestException on an invalid date format', () => {
      expect(() =>
        controller.getSalesTrend('not-a-date', '2024-01-31'),
      ).toThrow(BadRequestException);
    });
  });

  describe('getExpenseTrend', () => {
    it('delegates to the service', async () => {
      const expected = { total: 0 };
      service.getExpenseTrend.mockResolvedValue(expected);

      const result = await controller.getExpenseTrend(
        '2024-01-01',
        '2024-01-31',
        'day',
      );

      expect(service.getExpenseTrend).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
        'day',
      );
      expect(result).toBe(expected);
    });
  });

  describe('getProfitTrend', () => {
    it('delegates to the service', async () => {
      const expected = { totals: {} };
      service.getProfitTrend.mockResolvedValue(expected);

      const result = await controller.getProfitTrend(
        '2024-01-01',
        '2024-01-31',
      );

      expect(service.getProfitTrend).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
        'month',
      );
      expect(result).toBe(expected);
    });
  });

  describe('getTopProducts', () => {
    it('defaults the limit to 10 when not provided', async () => {
      service.getTopProducts.mockResolvedValue({ data: [] });

      await controller.getTopProducts('2024-01-01', '2024-01-31');

      expect(service.getTopProducts).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
        10,
      );
    });

    it('parses a provided limit from the query string', async () => {
      service.getTopProducts.mockResolvedValue({ data: [] });

      await controller.getTopProducts('2024-01-01', '2024-01-31', '5');

      expect(service.getTopProducts).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
        5,
      );
    });
  });

  describe('getTopCustomers', () => {
    it('defaults the limit to 10 when not provided', async () => {
      service.getTopCustomers.mockResolvedValue({ data: [] });

      await controller.getTopCustomers('2024-01-01', '2024-01-31');

      expect(service.getTopCustomers).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
        10,
      );
    });

    it('parses a provided limit from the query string', async () => {
      service.getTopCustomers.mockResolvedValue({ data: [] });

      await controller.getTopCustomers('2024-01-01', '2024-01-31', '3');

      expect(service.getTopCustomers).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
        3,
      );
    });
  });

  describe('getSalesByPaymentMethod', () => {
    it('delegates to the service', async () => {
      const expected = { data: [] };
      service.getSalesByPaymentMethod.mockResolvedValue(expected);

      const result = await controller.getSalesByPaymentMethod(
        '2024-01-01',
        '2024-01-31',
      );

      expect(service.getSalesByPaymentMethod).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
      );
      expect(result).toBe(expected);
    });

    it('throws BadRequestException when a date is missing', () => {
      expect(() =>
        controller.getSalesByPaymentMethod('2024-01-01', ''),
      ).toThrow(BadRequestException);
    });
  });

  describe('getInventorySummary', () => {
    it('delegates to the service with no arguments', async () => {
      const expected = { totalProducts: 0 };
      service.getInventorySummary.mockResolvedValue(expected);

      const result = await controller.getInventorySummary();

      expect(service.getInventorySummary).toHaveBeenCalledWith();
      expect(result).toBe(expected);
    });
  });
});
