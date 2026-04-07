import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
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

@UseGuards(JwtAuthGuard)
@Controller('sales/invoices')
export class InvoicesController {
  constructor(
    private invoicesService: InvoicesService,
    private mpesaService: MpesaService,
  ) {}

  // POST /sales/invoices
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(dto);
  }

  // GET /sales/invoices
  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status: string,
  ) {
    return this.invoicesService.findAll(+page || 1, +limit || 20, status);
  }

  // GET /sales/invoices/summary
  @Get('summary')
  getSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.invoicesService.getSalesSummary(startDate, endDate);
  }

  // GET /sales/invoices/monthly?year=2026
  @Get('monthly')
  getMonthly(@Query('year') year: string) {
    return this.invoicesService.getMonthlySales(
      Number(year) || new Date().getFullYear(),
    );
  }

  // GET /sales/invoices/daily-summary?date=2026-04-02
  @Get('daily-summary')
  getDailySummary(@Query('date') date: string) {
    return this.invoicesService.getDailySummary(
      date || new Date().toISOString().split('T')[0],
    );
  }

  @Get('mpesa/pending')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  @AllowPosUser()
  getPendingMpesaTransactions(
    @Query('status') status?: MpesaTransactionStatus,
  ) {
    return this.mpesaService.getPendingTransactions(status);
  }

  @Post('mpesa/transactions/:transactionId/retry')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  @AllowPosUser()
  retryMpesaTransaction(@Param('transactionId') transactionId: string) {
    return this.mpesaService.retryTransaction(transactionId);
  }

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

  // GET /sales/invoices/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  // PATCH /sales/invoices/:id/approve
  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @AllowPosUser()
  approve(
    @Param('id') id: string,
    @Body('warehouseId') warehouseId?: string,
    @Body('paymentMethod') paymentMethod?: PaymentMethod,
  ) {
    return this.invoicesService.approve(id, warehouseId, paymentMethod);
  }

  // PATCH /sales/invoices/:id/paid
  @Patch(':id/paid')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  markAsPaid(
    @Param('id') id: string,
    @Body('paymentMethod') paymentMethod?: PaymentMethod,
  ) {
    return this.invoicesService.markAsPaid(id, paymentMethod);
  }

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

  @Get(':id/mpesa/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  @AllowPosUser()
  getMpesaStatus(@Param('id') id: string) {
    return this.mpesaService.getInvoicePaymentStatus(id);
  }

  // PATCH /sales/invoices/:id/void
  @Patch(':id/void')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  void(@Param('id') id: string, @Body('reason') reason: string) {
    return this.invoicesService.void(id, reason);
  }
}
