import { Test, TestingModule } from '@nestjs/testing';
import { EtimsService } from './etims/etims.service';
import { PrismaService } from '../../prisma.service';
import { ConfigService } from '@nestjs/config';

describe('EtimsService', () => {
  let service: EtimsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtimsService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                ETIMS_ENV: 'sandbox',
                ETIMS_BASE_URL: 'https://etims-api.kra.go.ke/etims-api',
                ETIMS_SANDBOX_URL: 'https://etims-sbx-api.kra.go.ke/etims-api',
                ETIMS_SELLER_PIN: 'A000000000Z',
                ETIMS_DEVICE_SERIAL: 'TEST_SERIAL',
              };
              return values[key] ?? '';
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EtimsService>(EtimsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
