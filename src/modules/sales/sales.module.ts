import { Module } from '@nestjs/common';
import { CustomersController } from './controllers/customers.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { CustomersService } from './services/customers.service';
import { InvoicesService } from './services/invoices.service';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [CustomersController, InvoicesController],
  providers: [CustomersService, InvoicesService],
  exports: [InvoicesService],
})
export class SalesModule {}
