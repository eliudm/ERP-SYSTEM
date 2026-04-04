import { Test, TestingModule } from '@nestjs/testing';
import { EtimsQueueService } from './etims-queue.service';

describe('EtimsQueueService', () => {
  let service: EtimsQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EtimsQueueService],
    }).compile();

    service = module.get<EtimsQueueService>(EtimsQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
