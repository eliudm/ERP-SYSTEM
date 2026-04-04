import { Module } from '@nestjs/common';
import { AccountsController } from './controllers/accounts.controller';
import { JournalEntriesController } from './controllers/journal-entries.controller';
import { ReportsController } from './controllers/reports.controller';
import { BankAccountsController } from './controllers/bank-accounts.controller';
import { AccountsService } from './services/accounts.service';
import { JournalEntriesService } from './services/journal-entries.service';
import { PostingEngineService } from './services/posting-engine.service';
import { ReportsService } from './services/reports.service';
import { BankReconciliationService } from './services/bank-reconciliation.service';

@Module({
  controllers: [
    AccountsController,
    JournalEntriesController,
    ReportsController,
    BankAccountsController,
  ],
  providers: [
    AccountsService,
    JournalEntriesService,
    PostingEngineService,
    ReportsService,
    BankReconciliationService,
  ],
  exports: [PostingEngineService, AccountsService],
})
export class AccountingModule {}
