import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InvoicesService } from '../services/invoices.service';
import { CreateInvoiceDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AllowPosUser } from '../../auth/decorators/allow-pos-user.decorator';
import { Role, PaymentMethod, MpesaTransactionStatus } from '@prisma/client';
import { InitiateMpesaPaymentDto } from '../dto/initiate-mpesa-payment.dto';
import { MpesaService } from '../services/mpesa.service';
import { ReconcileMpesaTransactionDto } from '../dto/reconcile-mpesa-transaction.dto';
import { MatchTillPaymentDto } from '../dto/match-till-payment.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales/invoices')
export class InvoicesController {
  constructor(
    private invoicesService: InvoicesService,
    private mpesaService: MpesaService,
  ) {}

  // POST /sales/invoices
  @ApiOperation({ summary: 'Create a draft sales invoice' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  create(@Body() dto: CreateInvoiceDto, @Req() req: any) {
    return this.invoicesService.create(dto, req.user?.id);
  }

  // GET /sales/invoices
  @ApiOperation({
    summary:
      'List sales invoices with pagination, optionally filtered by status',
  })
  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status: string,
  ) {
    return this.invoicesService.findAll(+page || 1, +limit || 20, status);
  }

  // GET /sales/invoices/summary
  @ApiOperation({ summary: 'Get sales summary totals for a date range' })
  @Get('summary')
  getSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.invoicesService.getSalesSummary(startDate, endDate);
  }

  // GET /sales/invoices/monthly?year=2026
  @ApiOperation({ summary: 'Get monthly sales totals for a given year' })
  @Get('monthly')
  getMonthly(@Query('year') year: string) {
    return this.invoicesService.getMonthlySales(
      Number(year) || new Date().getFullYear(),
    );
  }

  // GET /sales/invoices/daily-summary?date=2026-04-02&fromTime=14:00&toTime=18:00
  @ApiOperation({
    summary:
      'Get sales summary totals (incl. gross profit) for a given day, optionally narrowed to a time-of-day window',
  })
  @Get('daily-summary')
  getDailySummary(
    @Query('date') date: string,
    @Query('fromTime') fromTime?: string,
    @Query('toTime') toTime?: string,
  ) {
    return this.invoicesService.getDailySummary(
      date || new Date().toISOString().split('T')[0],
      fromTime,
      toTime,
    );
  }

  @ApiOperation({
    summary: 'List pending M-Pesa transactions, optionally filtered by status',
  })
  @Get('mpesa/pending')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  @AllowPosUser()
  getPendingMpesaTransactions(
    @Query('status') status?: MpesaTransactionStatus,
  ) {
    return this.mpesaService.getPendingTransactions(status);
  }

  @ApiOperation({ summary: 'Retry a failed or stuck M-Pesa transaction' })
  @Post('mpesa/transactions/:transactionId/retry')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  @AllowPosUser()
  retryMpesaTransaction(@Param('transactionId') transactionId: string) {
    return this.mpesaService.retryTransaction(transactionId);
  }

  @ApiOperation({ summary: 'Manually reconcile an M-Pesa transaction' })
  @Patch('mpesa/transactions/:transactionId/reconcile')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  @AllowPosUser()
  reconcileMpesaTransaction(
    @Param('transactionId') transactionId: string,
    @Body() dto: ReconcileMpesaTransactionDto,
  ) {
    return this.mpesaService.reconcileTransaction(transactionId, dto);
  }

  @ApiOperation({
    summary:
      'List recent, unmatched M-Pesa Till Number (Buy Goods) payments awaiting a cashier to claim them for a sale',
  })
  @Get('mpesa/till/pending')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  @AllowPosUser()
  getPendingTillPayments(@Query('sinceMinutes') sinceMinutes?: string) {
    return this.mpesaService.getUnmatchedTillPayments(
      sinceMinutes ? +sinceMinutes : undefined,
    );
  }

  @ApiOperation({
    summary:
      'Match an unmatched Till Number payment to an invoice, marking it paid',
  })
  @Post('mpesa/till/:tillPaymentId/match')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  @AllowPosUser()
  matchTillPayment(
    @Param('tillPaymentId') tillPaymentId: string,
    @Body() dto: MatchTillPaymentDto,
    @Req() req: any,
  ) {
    return this.mpesaService.matchTillPayment(
      tillPaymentId,
      dto.invoiceId,
      req.user?.id,
    );
  }

  @ApiOperation({
    summary:
      'Undo a wrong Till Number match (frees the payment only — does not reverse the invoice it was wrongly matched to; use a Credit Note for that)',
  })
  @Patch('mpesa/till/:tillPaymentId/unmatch')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  unmatchTillPayment(@Param('tillPaymentId') tillPaymentId: string) {
    return this.mpesaService.unmatchTillPayment(tillPaymentId);
  }

  // GET /sales/invoices/:id
  @ApiOperation({ summary: 'Get a sales invoice by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  // PATCH /sales/invoices/:id/approve
  @ApiOperation({
    summary: 'Approve a sales invoice, deducting stock and recording payment',
  })
  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @AllowPosUser()
  approve(
    @Param('id') id: string,
    @Body('warehouseId') warehouseId?: string,
    @Body('paymentMethod') paymentMethod?: PaymentMethod,
    @Req() req?: any,
  ) {
    return this.invoicesService.approve(
      id,
      warehouseId,
      paymentMethod,
      req?.user?.id,
    );
  }

  // PATCH /sales/invoices/:id/paid
  @ApiOperation({ summary: 'Mark a sales invoice as paid' })
  @Patch(':id/paid')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  markAsPaid(
    @Param('id') id: string,
    @Body('paymentMethod') paymentMethod?: PaymentMethod,
    @Req() req?: any,
  ) {
    return this.invoicesService.markAsPaid(id, paymentMethod, req?.user?.id);
  }

  @ApiOperation({
    summary: 'Initiate an M-Pesa STK push payment for an invoice',
  })
  @Post(':id/mpesa/stk-push')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  @AllowPosUser()
  initiateMpesaStkPush(
    @Param('id') id: string,
    @Body() dto: InitiateMpesaPaymentDto,
  ) {
    return this.mpesaService.initiateStkPush(id, dto);
  }

  @ApiOperation({ summary: "Get an invoice's M-Pesa payment status" })
  @Get(':id/mpesa/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  @AllowPosUser()
  getMpesaStatus(@Param('id') id: string) {
    return this.mpesaService.getInvoicePaymentStatus(id);
  }

  // PATCH /sales/invoices/:id/void
  @ApiOperation({ summary: 'Void a sales invoice' })
  @Patch(':id/void')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  void(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    return this.invoicesService.void(id, reason, req.user?.id);
  }
}
