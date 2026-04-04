import { Test, TestingModule } from '@nestjs/testing';
import { EtimsController } from './etims.controller';

describe('EtimsController', () => {
  let controller: EtimsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EtimsController],
    }).compile();

    controller = module.get<EtimsController>(EtimsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
