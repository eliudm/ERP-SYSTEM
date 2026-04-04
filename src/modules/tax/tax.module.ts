import { Module } from '@nestjs/common';
import { TaxController } from './tax.controller';
import { TaxRatesService } from './services/tax-rates.service';
import { TaxGroupsService } from './services/tax-groups.service';
import { TaxReportService } from './services/tax-report.service';

@Module({
  controllers: [TaxController],
  providers: [TaxRatesService, TaxGroupsService, TaxReportService],
  exports: [TaxRatesService, TaxGroupsService],
})
export class TaxModule {}
