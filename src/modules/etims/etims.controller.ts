import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EtimsService } from './etims/etims.service';
import { EtimsQueueService } from './etims-queue/etims-queue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('etims')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('etims')
export class EtimsController {
  constructor(
    private etimsService: EtimsService,
    private etimsQueueService: EtimsQueueService,
  ) {}

  // GET /etims/stats
  @ApiOperation({ summary: 'Get eTIMS submission statistics' })
  @Get('stats')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getStats() {
    return this.etimsService.getStats();
  }

  // GET /etims/failed
  @ApiOperation({ summary: 'List failed eTIMS submissions' })
  @Get('failed')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getFailedSubmissions() {
    return this.etimsService.getFailedSubmissions();
  }

  // GET /etims/queue/status
  @ApiOperation({ summary: 'Get the status of the eTIMS submission queue' })
  @Get('queue/status')
  @Roles(Role.ADMIN)
  getQueueStatus() {
    return this.etimsQueueService.getQueueStatus();
  }

  // POST /etims/queue/retry-all
  @ApiOperation({ summary: 'Retry all failed eTIMS submissions in the queue' })
  @Post('queue/retry-all')
  @Roles(Role.ADMIN)
  retryAllFailed() {
    return this.etimsQueueService.retryAllFailed();
  }

  // GET /etims/invoice/:invoiceId/status
  @ApiOperation({ summary: 'Get the eTIMS submission status for an invoice' })
  @Get('invoice/:invoiceId/status')
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  getStatus(@Param('invoiceId') invoiceId: string) {
    return this.etimsService.getStatus(invoiceId);
  }

  // GET /etims/invoice/:invoiceId/qr
  @ApiOperation({ summary: 'Get the eTIMS QR code for an invoice' })
  @Get('invoice/:invoiceId/qr')
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  getQRCode(@Param('invoiceId') invoiceId: string) {
    return this.etimsService.getQRCode(invoiceId);
  }

  // POST /etims/invoice/:invoiceId/submit
  @ApiOperation({ summary: 'Manually queue an invoice for eTIMS submission' })
  @Post('invoice/:invoiceId/submit')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  manualSubmit(@Param('invoiceId') invoiceId: string) {
    return this.etimsQueueService.addSubmitJob(invoiceId);
  }

  // POST /etims/invoice/:invoiceId/retry
  @ApiOperation({ summary: 'Retry a failed eTIMS submission for an invoice' })
  @Post('invoice/:invoiceId/retry')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  retry(@Param('invoiceId') invoiceId: string) {
    return this.etimsService.retrySubmission(invoiceId);
  }
}
