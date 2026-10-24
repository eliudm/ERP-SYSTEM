import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

const mockSettingsService = () => ({
  getSystemSettings: jest.fn(),
  updateSystemSettings: jest.fn(),
});

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: ReturnType<typeof mockSettingsService>;

  beforeEach(async () => {
    service = mockSettingsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: SettingsService, useValue: service }],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  describe('getSystemSettings', () => {
    it('should call settingsService.getSystemSettings', async () => {
      const expected = { companyName: 'Nexora ERP' };
      service.getSystemSettings.mockResolvedValue(expected);

      const result = await controller.getSystemSettings();

      expect(service.getSystemSettings).toHaveBeenCalledWith();
      expect(result).toEqual(expected);
    });
  });

  describe('updateSystemSettings', () => {
    it('should call settingsService.updateSystemSettings with the dto', async () => {
      const dto = { companyName: 'New Co' };
      const expected = { companyName: 'New Co' };
      service.updateSystemSettings.mockResolvedValue(expected);

      const result = await controller.updateSystemSettings(dto as any);

      expect(service.updateSystemSettings).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });
});
