import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ACCOUNTANT)
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @ApiOperation({ summary: 'Get sales trend over time, grouped by day or month' })
  @Get('sales-trend')
  getSalesTrend(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('granularity') granularity?: string,
  ) {
    this.validateDateRange(startDate, endDate);
    const gran = granularity === 'day' ? 'day' : 'month';
    return this.analyticsService.getSalesTrend(startDate, endDate, gran);
  }

  @ApiOperation({ summary: 'Get expense trend over time, grouped by day or month' })
  @Get('expense-trend')
  getExpenseTrend(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('granularity') granularity?: string,
  ) {
    this.validateDateRange(startDate, endDate);
    const gran = granularity === 'day' ? 'day' : 'month';
    return this.analyticsService.getExpenseTrend(startDate, endDate, gran);
  }

  @ApiOperation({ summary: 'Get profit trend over time, grouped by day or month' })
  @Get('profit-trend')
  getProfitTrend(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('granularity') granularity?: string,
  ) {
    this.validateDateRange(startDate, endDate);
    const gran = granularity === 'day' ? 'day' : 'month';
    return this.analyticsService.getProfitTrend(startDate, endDate, gran);
  }

  @ApiOperation({ summary: 'Get the top-selling products within a date range' })
  @Get('top-products')
  getTopProducts(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: string,
  ) {
    this.validateDateRange(startDate, endDate);
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.analyticsService.getTopProducts(
      startDate,
      endDate,
      parsedLimit,
    );
  }

  @ApiOperation({ summary: 'Get the top customers by sales within a date range' })
  @Get('top-customers')
  getTopCustomers(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: string,
  ) {
    this.validateDateRange(startDate, endDate);
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.analyticsService.getTopCustomers(
      startDate,
      endDate,
      parsedLimit,
    );
  }

  @ApiOperation({ summary: 'Get a breakdown of sales by payment method within a date range' })
  @Get('sales-by-payment-method')
  getSalesByPaymentMethod(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    this.validateDateRange(startDate, endDate);
    return this.analyticsService.getSalesByPaymentMethod(startDate, endDate);
  }

  @ApiOperation({ summary: 'Get a summary of current inventory levels' })
  @Get('inventory-summary')
  getInventorySummary() {
    return this.analyticsService.getInventorySummary();
  }

  private validateDateRange(startDate: string, endDate: string) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
      throw new BadRequestException('Invalid date format');
    }
  }
}
