import { Test, TestingModule } from '@nestjs/testing';
import { EtimsService } from './etims.service';

describe('EtimsService', () => {
  let service: EtimsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EtimsService],
    }).compile();

    service = module.get<EtimsService>(EtimsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
