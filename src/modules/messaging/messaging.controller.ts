import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MessagingService } from './messaging.service';
import { InboxService } from './inbox.service';
import { SegmentationService } from './segmentation.service';
import {
  UpdateMessagingSettingsDto,
  CreateCampaignDto,
  SendQuickMessageDto,
  SendRemindersDto,
} from './dto/messaging.dto';
import { PrismaService } from '../../prisma.service';

// ── Webhook controller (no auth — called by Africa's Talking) ───────────────
@Controller('messaging/webhook')
export class MessagingWebhookController {
  private readonly logger = new Logger(MessagingWebhookController.name);

  constructor(
    private readonly inbox: InboxService,
    private readonly prisma: PrismaService,
  ) {}

  // Africa's Talking posts to this URL when a message is received.
  // Register this URL in the AT dashboard: https://account.africastalking.com/apps/<appname>/settings
  // URL: https://your-domain.com/api/v1/messaging/webhook/inbound
  @Post('inbound')
  @HttpCode(HttpStatus.OK)
  async handleInbound(@Body() payload: any) {
    this.logger.log('Inbound webhook', JSON.stringify(payload));
    try {
      // Africa's Talking SMS payload: { from, to, text, id, linkId, date }
      // Africa's Talking WhatsApp payload: { from, to, message: { text: { body } }, id }
      const from: string = payload.from ?? payload.From ?? '';
      const isWhatsapp = !!(payload.message?.text?.body);
      const text: string = isWhatsapp
        ? payload.message.text.body
        : (payload.text ?? payload.Text ?? '');
      const channel = isWhatsapp ? 'WHATSAPP' : 'SMS';
      const providerRef: string = payload.id ?? payload.Id ?? '';

      if (!from || !text) return { ok: true };

      // Find tenant by the destination number
      const to: string = payload.to ?? payload.To ?? '';
      const settings = await this.prisma.messagingSettings.findFirst({
        where: {
          OR: [
            { senderId: to },
            { whatsappNumber: to },
          ],
        },
      });

      if (!settings) {
        this.logger.warn(`No tenant found for inbound number: ${to}`);
        return { ok: true };
      }

      await this.inbox.handleInbound({
        tenantId: settings.tenantId,
        from,
        message: text,
        channel,
        providerRef,
      });
    } catch (err) {
      this.logger.error('Webhook processing error', err);
    }
    return { ok: true };
  }
}

// ── Authenticated controller ────────────────────────────────────────────────
@Controller('messaging')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagingController {
  constructor(
    private readonly service: MessagingService,
    private readonly inbox: InboxService,
    private readonly segmentation: SegmentationService,
  ) {}

  // Settings
  @Get('settings')
  @Roles('ADMIN')
  getSettings() { return this.service.getSettings(); }

  @Put('settings')
  @Roles('ADMIN')
  updateSettings(@Body() dto: UpdateMessagingSettingsDto) {
    return this.service.updateSettings(dto);
  }

  // Campaigns
  @Get('campaigns')
  listCampaigns(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) { return this.service.listCampaigns(page, limit); }

  @Post('campaigns')
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.service.createCampaign(dto);
  }

  @Get('campaigns/:id')
  getCampaign(@Param('id') id: string) { return this.service.getCampaign(id); }

  @Post('campaigns/:id/send')
  sendCampaign(@Param('id') id: string) { return this.service.sendCampaign(id); }

  // Quick send
  @Post('send')
  sendQuick(@Body() dto: SendQuickMessageDto) { return this.service.sendQuick(dto); }

  // Payment reminders
  @Post('reminders')
  sendReminders(@Body() dto: SendRemindersDto) { return this.service.sendReminders(dto); }

  // Message history
  @Get('messages')
  listMessages(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) { return this.service.listMessages(page, limit); }

  // ── Inbox ──────────────────────────────────────────────────────────────
  @Get('inbox')
  listThreads(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
  ) { return this.inbox.listThreads(page, limit); }

  @Get('inbox/unread')
  unreadCount() { return this.inbox.unreadCount(); }

  @Get('inbox/:id')
  getThread(@Param('id') id: string) { return this.inbox.getThread(id); }

  @Post('inbox/:id/reply')
  reply(@Param('id') id: string, @Body() body: { content: string }) {
    return this.inbox.reply(id, body.content);
  }

  // ── Campaign analytics ─────────────────────────────────────────────────
  @Get('campaigns/:id/analytics')
  getCampaignAnalytics(@Param('id') id: string) {
    return this.segmentation.getCampaignAnalytics(id);
  }

  // ── Segments ───────────────────────────────────────────────────────────
  @Get('segments')
  listSegments() { return this.segmentation.listSegments(); }

  @Post('segments/preview')
  previewSegment(
    @Body() body: { filters: any; page?: number; limit?: number },
  ) { return this.segmentation.previewSegment(body.filters, body.page, body.limit); }

  @Post('segments')
  createSegment(@Body() dto: { name: string; description?: string; filters: any }) {
    return this.segmentation.createSegment(dto);
  }

  @Patch('segments/:id')
  updateSegment(@Param('id') id: string, @Body() dto: any) {
    return this.segmentation.updateSegment(id, dto);
  }

  @Delete('segments/:id')
  deleteSegment(@Param('id') id: string) { return this.segmentation.deleteSegment(id); }

  // ── Templates ──────────────────────────────────────────────────────────
  @Get('templates')
  listTemplates() { return this.inbox.listTemplates(); }

  @Post('templates')
  createTemplate(@Body() dto: { name: string; content: string; category?: string; language?: string }) {
    return this.inbox.createTemplate(dto);
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() dto: any) {
    return this.inbox.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) { return this.inbox.deleteTemplate(id); }
}
