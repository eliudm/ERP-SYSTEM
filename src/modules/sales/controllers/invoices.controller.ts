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
import { Role, PaymentMethod } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('sales/invoices')
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

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

  // PATCH /sales/invoices/:id/void
  @Patch(':id/void')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  void(@Param('id') id: string, @Body('reason') reason: string) {
    return this.invoicesService.void(id, reason);
  }
}
