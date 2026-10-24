import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../prisma.service';

const mockPrisma = () => ({
  systemSetting: {
    upsert: jest.fn(),
    update: jest.fn(),
  },
});

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SettingsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe('getSystemSettings', () => {
    it('should upsert and return the system settings using the compound key', async () => {
      const expected = { key: 'system', companyName: 'Nexora ERP' };
      prisma.systemSetting.upsert.mockResolvedValue(expected);

      const result = await service.getSystemSettings();

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_key: expect.objectContaining({ key: 'system' }),
          },
          update: {},
          create: expect.objectContaining({
            key: 'system',
            companyName: 'Nexora ERP',
            companyPin: 'P051234567X',
            defaultCurrency: 'KES',
            timezone: 'Africa/Nairobi',
            lowStockThreshold: 5,
          }),
        }),
      );
      expect(result).toEqual(expected);
    });
  });

  describe('updateSystemSettings', () => {
    it('should ensure settings exist then update with the compound key', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({ key: 'system' });
      const dto = { companyName: 'New Co', lowStockThreshold: 10 };
      const expected = { key: 'system', ...dto };
      prisma.systemSetting.update.mockResolvedValue(expected);

      const result = await service.updateSystemSettings(dto);

      expect(prisma.systemSetting.upsert).toHaveBeenCalled();
      expect(prisma.systemSetting.update).toHaveBeenCalledWith({
        where: {
          tenantId_key: expect.objectContaining({ key: 'system' }),
        },
        data: dto,
      });
      expect(result).toEqual(expected);
    });
  });
});
