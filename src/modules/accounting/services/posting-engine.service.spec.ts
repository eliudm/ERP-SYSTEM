import { Test, TestingModule } from '@nestjs/testing';
import { PostingEngineService } from './posting-engine.service';

describe('PostingEngineService', () => {
  let service: PostingEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostingEngineService],
    }).compile();

    service = module.get<PostingEngineService>(PostingEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
