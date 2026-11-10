import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { getCurrentTenantId } from '../../tenant-context';
import { AfricasTalkingService } from './africastalking.service';
import {
  UpdateMessagingSettingsDto,
  CreateCampaignDto,
  SendQuickMessageDto,
  SendRemindersDto,
  MessageChannelDto,
} from './dto/messaging.dto';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private prisma: PrismaService,
    private at: AfricasTalkingService,
  ) {}

  // ─── SETTINGS ──────────────────────────────────────────
  async getSettings() {
    const tenantId = getCurrentTenantId()!;
    const settings = await this.prisma.messagingSettings.findUnique({ where: { tenantId } });
    if (!settings) return { tenantId, smsEnabled: false, whatsappEnabled: false };
    // Never expose the raw API key to the frontend
    return { ...settings, apiKey: settings.apiKey ? '••••••••' : null };
  }

  async updateSettings(dto: UpdateMessagingSettingsDto) {
    const tenantId = getCurrentTenantId()!;
    const data: Record<string, unknown> = { ...dto };
    // Don't overwrite the stored key when the client sends back the masked value
    if (dto.apiKey === '••••••••') delete data.apiKey;
    return this.prisma.messagingSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
  }

  // ─── CAMPAIGNS ─────────────────────────────────────────
  async listCampaigns(page = 1, limit = 20) {
    const tenantId = getCurrentTenantId()!;
    const [data, total] = await Promise.all([
      this.prisma.smsCampaign.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.smsCampaign.count({ where: { tenantId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getCampaign(id: string) {
    const tenantId = getCurrentTenantId()!;
    const campaign = await this.prisma.smsCampaign.findFirst({
      where: { id, tenantId },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async createCampaign(dto: CreateCampaignDto) {
    const tenantId = getCurrentTenantId()!;

    // Resolve recipients: either from a segment or from the provided list
    let recipients: Array<{ phone: string; customerId?: string }> = [];

    if (dto.segmentId) {
      const segment = await this.prisma.customerSegment.findFirst({
        where: { id: dto.segmentId, tenantId },
      });
      if (!segment) throw new BadRequestException('Segment not found');
      const customers = await this.prisma.customer.findMany({
        where: { tenantId },
        select: { id: true, phone: true },
      });
      recipients = customers
        .filter((c) => c.phone)
        .map((c) => ({ phone: c.phone!, customerId: c.id }));
    } else if (dto.recipients && dto.recipients.length > 0) {
      recipients = dto.recipients.map((r) => ({ phone: r }));
    } else {
      throw new BadRequestException('Provide either segmentId or recipients');
    }

    return this.prisma.smsCampaign.create({
      data: {
        tenantId,
        name: dto.name,
        message: dto.message,
        channel: dto.channel as any,
        segmentId: dto.segmentId ?? null,
        recipientCount: recipients.length,
        messages: {
          create: recipients.map((r) => ({
            tenantId,
            recipient: r.phone,
            customerId: r.customerId ?? null,
            message: dto.message,
            channel: dto.channel as any,
          })),
        },
      },
    });
  }

  async sendCampaign(id: string) {
    const tenantId = getCurrentTenantId()!;
    const campaign = await this.prisma.smsCampaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === 'SENT') throw new BadRequestException('Campaign already sent');

    const settings = await this.prisma.messagingSettings.findUnique({ where: { tenantId } });
    if (!settings?.apiKey || !settings?.username) {
      throw new BadRequestException('Messaging API credentials not configured. Go to Settings → Messaging.');
    }

    // Mark sending
    await this.prisma.smsCampaign.update({ where: { id }, data: { status: 'SENDING' } });

    const pending = await this.prisma.smsMessage.findMany({
      where: { campaignId: id, status: 'PENDING' },
    });

    const phones = pending.map((m) => m.recipient);
    const isSms = campaign.channel === 'SMS';

    let results: Array<{ number: string; status: string; messageId?: string; error?: string }>;

    if (isSms) {
      results = await this.at.sendSms({
        apiKey: settings.apiKey,
        username: settings.username,
        senderId: settings.senderId ?? undefined,
        to: phones,
        message: campaign.message,
      });
    } else {
      if (!settings.whatsappNumber) throw new BadRequestException('WhatsApp number not configured');
      results = await this.at.sendWhatsApp({
        apiKey: settings.apiKey,
        username: settings.username,
        from: settings.whatsappNumber,
        to: phones,
        message: campaign.message,
      });
    }

    // Update individual message records
    let sentCount = 0;
    let failedCount = 0;
    for (const r of results) {
      const msg = pending.find((m) => m.recipient === r.number);
      if (!msg) continue;
      const isSent = r.status === 'SENT';
      if (isSent) sentCount++; else failedCount++;
      await this.prisma.smsMessage.update({
        where: { id: msg.id },
        data: {
          status: isSent ? 'SENT' : 'FAILED',
          providerRef: r.messageId ?? null,
          errorMessage: r.error ?? null,
          sentAt: isSent ? new Date() : null,
        },
      });
    }

    await this.prisma.smsCampaign.update({
      where: { id },
      data: {
        status: failedCount === results.length ? 'FAILED' : 'SENT',
        sentCount,
        failedCount,
        sentAt: new Date(),
      },
    });

    return this.getCampaign(id);
  }

  // ─── QUICK SEND ────────────────────────────────────────
  async sendQuick(dto: SendQuickMessageDto) {
    const tenantId = getCurrentTenantId()!;
    const settings = await this.prisma.messagingSettings.findUnique({ where: { tenantId } });
    if (!settings?.apiKey || !settings?.username) {
      throw new BadRequestException('Messaging API credentials not configured');
    }

    const isSms = dto.channel === MessageChannelDto.SMS;
    const results = isSms
      ? await this.at.sendSms({ apiKey: settings.apiKey, username: settings.username, senderId: settings.senderId ?? undefined, to: [dto.recipient], message: dto.message })
      : await this.at.sendWhatsApp({ apiKey: settings.apiKey, username: settings.username, from: settings.whatsappNumber!, to: [dto.recipient], message: dto.message });

    const r = results[0];
    return this.prisma.smsMessage.create({
      data: {
        tenantId,
        recipient: dto.recipient,
        message: dto.message,
        channel: dto.channel as any,
        status: r.status === 'SENT' ? 'SENT' : 'FAILED',
        providerRef: r.messageId ?? null,
        errorMessage: r.error ?? null,
        sentAt: r.status === 'SENT' ? new Date() : null,
      },
    });
  }

  // ─── PAYMENT REMINDERS ─────────────────────────────────
  async sendReminders(dto: SendRemindersDto) {
    const tenantId = getCurrentTenantId()!;
    const settings = await this.prisma.messagingSettings.findUnique({ where: { tenantId } });
    if (!settings?.apiKey || !settings?.username) {
      throw new BadRequestException('Messaging API credentials not configured');
    }

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: dto.customerIds }, tenantId },
      include: {
        invoices: {
          where: { status: 'APPROVED', paymentMethod: 'CREDIT' },
          select: { total: true, creditPayments: { select: { amount: true } } },
        },
      },
    });

    const results: Array<{ customerId: string; name: string; phone: string; status: string }> = [];

    for (const customer of customers) {
      if (!customer.phone) {
        results.push({ customerId: customer.id, name: customer.name, phone: '', status: 'NO_PHONE' });
        continue;
      }

      const outstanding = customer.invoices.reduce((sum, inv) => {
        const paid = inv.creditPayments.reduce((s, p) => s + Number(p.amount), 0);
        return sum + Number(inv.total) - paid;
      }, 0);

      const message = dto.customMessage
        || `Dear ${customer.name}, you have an outstanding balance of KES ${outstanding.toLocaleString('en-KE', { minimumFractionDigits: 2 })}. Please make payment at your earliest convenience.`;

      const r = dto.channel === MessageChannelDto.SMS
        ? (await this.at.sendSms({ apiKey: settings.apiKey, username: settings.username, senderId: settings.senderId ?? undefined, to: [customer.phone], message }))[0]
        : (await this.at.sendWhatsApp({ apiKey: settings.apiKey, username: settings.username, from: settings.whatsappNumber!, to: [customer.phone], message }))[0];

      await this.prisma.smsMessage.create({
        data: {
          tenantId,
          recipient: customer.phone,
          message,
          channel: dto.channel as any,
          status: r.status === 'SENT' ? 'SENT' : 'FAILED',
          providerRef: r.messageId ?? null,
          errorMessage: r.error ?? null,
          sentAt: r.status === 'SENT' ? new Date() : null,
        },
      });

      results.push({ customerId: customer.id, name: customer.name, phone: customer.phone, status: r.status });
    }

    return { results };
  }

  // ─── MESSAGE HISTORY ───────────────────────────────────
  async listMessages(page = 1, limit = 50) {
    const tenantId = getCurrentTenantId()!;
    const [data, total] = await Promise.all([
      this.prisma.smsMessage.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.smsMessage.count({ where: { tenantId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── TRANSACTIONAL (called from invoices service) ──────
  async sendTransactionalSms(opts: {
    tenantId: string;
    phone: string;
    message: string;
    channel?: 'SMS' | 'WHATSAPP';
  }) {
    try {
      const settings = await this.prisma.messagingSettings.findUnique({ where: { tenantId: opts.tenantId } });
      if (!settings?.apiKey || !settings?.username) return;
      const channel = opts.channel ?? 'SMS';
      const isSms = channel === 'SMS';
      if (isSms && !settings.smsEnabled) return;
      if (!isSms && !settings.whatsappEnabled) return;

      const results = isSms
        ? await this.at.sendSms({ apiKey: settings.apiKey, username: settings.username, senderId: settings.senderId ?? undefined, to: [opts.phone], message: opts.message })
        : await this.at.sendWhatsApp({ apiKey: settings.apiKey, username: settings.username, from: settings.whatsappNumber!, to: [opts.phone], message: opts.message });

      const r = results[0];
      await this.prisma.smsMessage.create({
        data: {
          tenantId: opts.tenantId,
          recipient: opts.phone,
          message: opts.message,
          channel: channel as any,
          status: r.status === 'SENT' ? 'SENT' : 'FAILED',
          providerRef: r.messageId ?? null,
          errorMessage: r.error ?? null,
          sentAt: r.status === 'SENT' ? new Date() : null,
        },
      });
    } catch (err) {
      this.logger.warn('Transactional SMS failed (non-fatal)', err);
    }
  }
}
