import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

const mockDashboardService = () => ({
  getOverview: jest.fn(),
});

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: ReturnType<typeof mockDashboardService>;

  beforeEach(async () => {
    service = mockDashboardService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  describe('getOverview', () => {
    it('delegates to the service with the given date range', async () => {
      const expected = { kpis: {} };
      service.getOverview.mockResolvedValue(expected);

      const result = await controller.getOverview('2024-01-01', '2024-01-31');

      expect(service.getOverview).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
      );
      expect(result).toBe(expected);
    });

    it('delegates to the service when no date range is given', async () => {
      const expected = { kpis: {} };
      service.getOverview.mockResolvedValue(expected);

      const result = await controller.getOverview();

      expect(service.getOverview).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toBe(expected);
    });
  });
});
