import { Module } from '@nestjs/common';
import { AccountsController } from './controllers/accounts.controller';
import { JournalEntriesController } from './controllers/journal-entries.controller';
import { AccountsService } from './services/accounts.service';
import { JournalEntriesService } from './services/journal-entries.service';
import { PostingEngineService } from './services/posting-engine.service';

@Module({
  controllers: [AccountsController, JournalEntriesController],
  providers: [AccountsService, JournalEntriesService, PostingEngineService],
  exports: [PostingEngineService, AccountsService],
})
export class AccountingModule {}
