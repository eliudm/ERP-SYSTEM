import { Module } from '@nestjs/common';
import { MailService } from '../../mail.service';
import { CustomersController } from './controllers/customers.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { MpesaController } from './controllers/mpesa.controller';
import { QuotesController } from './controllers/quotes.controller';
import { CreditNotesController } from './controllers/credit-notes.controller';
import { PriceListsController } from './controllers/price-lists.controller';
import { CustomersService } from './services/customers.service';
import { InvoicesService } from './services/invoices.service';
import { MpesaService } from './services/mpesa.service';
import { QuotesService } from './services/quotes.service';
import { CreditNotesService } from './services/credit-notes.service';
import { PriceListsService } from './services/price-lists.service';
import { AccountingModule } from '../accounting/accounting.module';
import { EtimsModule } from '../etims/etims.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AccountingModule, EtimsModule, NotificationsModule],
  controllers: [
    CustomersController,
    InvoicesController,
    MpesaController,
    QuotesController,
    CreditNotesController,
    PriceListsController,
  ],
  providers: [
    CustomersService,
    InvoicesService,
    MpesaService,
    QuotesService,
    CreditNotesService,
    PriceListsService,
    MailService,
  ],
  exports: [InvoicesService, PriceListsService],
})
export class SalesModule {}
