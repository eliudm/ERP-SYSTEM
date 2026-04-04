import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { EtimsService } from './etims/etims.service';
import { EtimsQueueService } from './etims-queue/etims-queue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('etims')
export class EtimsController {
  constructor(
    private etimsService: EtimsService,
    private etimsQueueService: EtimsQueueService,
  ) {}

  // GET /etims/stats
  @Get('stats')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getStats() {
    return this.etimsService.getStats();
  }

  // GET /etims/failed
  @Get('failed')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getFailedSubmissions() {
    return this.etimsService.getFailedSubmissions();
  }

  // GET /etims/queue/status
  @Get('queue/status')
  @Roles(Role.ADMIN)
  getQueueStatus() {
    return this.etimsQueueService.getQueueStatus();
  }

  // POST /etims/queue/retry-all
  @Post('queue/retry-all')
  @Roles(Role.ADMIN)
  retryAllFailed() {
    return this.etimsQueueService.retryAllFailed();
  }

  // GET /etims/invoice/:invoiceId/status
  @Get('invoice/:invoiceId/status')
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  getStatus(@Param('invoiceId') invoiceId: string) {
    return this.etimsService.getStatus(invoiceId);
  }

  // GET /etims/invoice/:invoiceId/qr
  @Get('invoice/:invoiceId/qr')
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  getQRCode(@Param('invoiceId') invoiceId: string) {
    return this.etimsService.getQRCode(invoiceId);
  }

  // POST /etims/invoice/:invoiceId/submit
  @Post('invoice/:invoiceId/submit')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  manualSubmit(@Param('invoiceId') invoiceId: string) {
    return this.etimsQueueService.addSubmitJob(invoiceId);
  }

  // POST /etims/invoice/:invoiceId/retry
  @Post('invoice/:invoiceId/retry')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  retry(@Param('invoiceId') invoiceId: string) {
    return this.etimsService.retrySubmission(invoiceId);
  }
}
