import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from '../services/reports.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('accounting/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('balance-sheet')
  getBalanceSheet(@Query('asOf') asOf: string) {
    return this.reportsService.getBalanceSheet(asOf);
  }

  @Get('cash-flow')
  getCashFlow(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getCashFlow(startDate, endDate);
  }

  @Get('aged-receivables')
  getAgedReceivables() {
    return this.reportsService.getAgedReceivables();
  }

  @Get('aged-payables')
  getAgedPayables() {
    return this.reportsService.getAgedPayables();
  }

  @Get('general-ledger')
  getGeneralLedger(
    @Query('accountId') accountId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getGeneralLedger(accountId, startDate, endDate);
  }

  @Get('vat-return')
  getVatReturn(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getVatReturn(startDate, endDate);
  }
}
