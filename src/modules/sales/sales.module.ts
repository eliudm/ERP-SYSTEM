import { Module } from '@nestjs/common';
import { MailService } from '../../mail.service';
import { CustomersController } from './controllers/customers.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { RecurringInvoicesController } from './controllers/recurring-invoices.controller';
import { MpesaController } from './controllers/mpesa.controller';
import { QuotesController } from './controllers/quotes.controller';
import { CreditNotesController } from './controllers/credit-notes.controller';
import { PriceListsController } from './controllers/price-lists.controller';
import { CustomersService } from './services/customers.service';
import { InvoicesService } from './services/invoices.service';
import { RecurringInvoicesService } from './services/recurring-invoices.service';
import { MpesaService } from './services/mpesa.service';
import { QuotesService } from './services/quotes.service';
import { CreditNotesService } from './services/credit-notes.service';
import { PriceListsService } from './services/price-lists.service';
import { AccountingModule } from '../accounting/accounting.module';
import { EtimsModule } from '../etims/etims.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [
    AccountingModule,
    EtimsModule,
    NotificationsModule,
    AuditModule,
    WorkflowModule,
  ],
  controllers: [
    CustomersController,
    InvoicesController,
    RecurringInvoicesController,
    MpesaController,
    QuotesController,
    CreditNotesController,
    PriceListsController,
  ],
  providers: [
    CustomersService,
    InvoicesService,
    RecurringInvoicesService,
    MpesaService,
    QuotesService,
    CreditNotesService,
    PriceListsService,
    MailService,
  ],
  exports: [InvoicesService, PriceListsService],
})
export class SalesModule {}
