import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MobileService } from './mobile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('mobile')
export class MobileController {
  constructor(private mobileService: MobileService) {}

  @Get('pos-data')
  getPosData(@Query('branchId') branchId?: string) {
    return this.mobileService.getPosData(branchId);
  }

  @Get('dashboard')
  getMobileDashboard() {
    return this.mobileService.getMobileDashboard();
  }

  @Get('search')
  quickSearch(@Query('q') query: string) {
    return this.mobileService.quickSearch(query);
  }

  @Get('recent-invoices')
  getRecentInvoices(@Query('limit') limit?: string) {
    return this.mobileService.getRecentInvoices(
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('sync-status')
  getSyncStatus() {
    return this.mobileService.getSyncStatus();
  }
}
