import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MobileService } from './mobile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('mobile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mobile')
export class MobileController {
  constructor(private mobileService: MobileService) {}

  @ApiOperation({ summary: 'Get point-of-sale data for the mobile app, optionally for a specific branch' })
  @Get('pos-data')
  getPosData(@Query('branchId') branchId?: string) {
    return this.mobileService.getPosData(branchId);
  }

  @ApiOperation({ summary: 'Get summarized dashboard data for the mobile app' })
  @Get('dashboard')
  getMobileDashboard() {
    return this.mobileService.getMobileDashboard();
  }

  @ApiOperation({ summary: 'Run a quick search across records for the mobile app' })
  @Get('search')
  quickSearch(@Query('q') query: string) {
    return this.mobileService.quickSearch(query);
  }

  @ApiOperation({ summary: 'Get the most recent invoices, limited by count' })
  @Get('recent-invoices')
  getRecentInvoices(@Query('limit') limit?: string) {
    return this.mobileService.getRecentInvoices(
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @ApiOperation({ summary: 'Get the current mobile sync status' })
  @Get('sync-status')
  getSyncStatus() {
    return this.mobileService.getSyncStatus();
  }
}
