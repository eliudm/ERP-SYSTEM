import { Test, TestingModule } from '@nestjs/testing';
import { JournalEntriesController } from './journal-entries.controller';

describe('JournalEntriesController', () => {
  let controller: JournalEntriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JournalEntriesController],
    }).compile();

    controller = module.get<JournalEntriesController>(JournalEntriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
