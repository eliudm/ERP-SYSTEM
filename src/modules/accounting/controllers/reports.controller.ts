import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from '../services/reports.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PaymentMethod } from '@prisma/client';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Get the balance sheet as of a given date' })
  @Get('balance-sheet')
  getBalanceSheet(@Query('asOf') asOf: string) {
    return this.reportsService.getBalanceSheet(asOf);
  }

  @ApiOperation({ summary: 'Get the cash flow report for a date range' })
  @Get('cash-flow')
  getCashFlow(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getCashFlow(startDate, endDate);
  }

  @ApiOperation({ summary: 'Get the aged receivables report' })
  @Get('aged-receivables')
  getAgedReceivables() {
    return this.reportsService.getAgedReceivables();
  }

  @ApiOperation({ summary: 'Get the aged payables report' })
  @Get('aged-payables')
  getAgedPayables() {
    return this.reportsService.getAgedPayables();
  }

  @ApiOperation({ summary: 'Get the general ledger for an account over a date range' })
  @Get('general-ledger')
  getGeneralLedger(
    @Query('accountId') accountId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getGeneralLedger(accountId, startDate, endDate);
  }

  @ApiOperation({ summary: 'Get the VAT return report for a date range' })
  @Get('vat-return')
  getVatReturn(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getVatReturn(startDate, endDate);
  }

  @ApiOperation({ summary: 'Get the payment modes report for a date range, optionally filtered by payment method' })
  @Get('payment-modes')
  getPaymentModesReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('paymentMethod') paymentMethod?: PaymentMethod,
  ) {
    return this.reportsService.getPaymentModeReport(
      startDate,
      endDate,
      paymentMethod,
    );
  }

  @ApiOperation({ summary: 'Get the profit and loss report for a date range' })
  @Get('profit-and-loss')
  getProfitAndLoss(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getProfitAndLoss(startDate, endDate);
  }

  @ApiOperation({ summary: 'Get the trial balance report, optionally as of a given date' })
  @Get('trial-balance')
  getTrialBalance(@Query('asOf') asOf?: string) {
    return this.reportsService.getTrialBalance(asOf);
  }
}
