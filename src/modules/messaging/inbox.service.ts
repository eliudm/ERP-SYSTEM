import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { getCurrentTenantId } from '../../tenant-context';
import { AfricasTalkingService } from './africastalking.service';
import { MessagingService } from './messaging.service';

@Injectable()
export class InboxService {
  constructor(
    private prisma: PrismaService,
    private at: AfricasTalkingService,
    private messaging: MessagingService,
  ) {}

  // ─── Called by webhook (no tenant context — tenantId passed explicitly) ───
  async handleInbound(opts: {
    tenantId: string;
    from: string;
    message: string;
    channel: 'SMS' | 'WHATSAPP';
    providerRef?: string;
    senderName?: string;
  }) {
    // Upsert the conversation thread
    const thread = await this.prisma.messageThread.upsert({
      where: {
        tenantId_customerPhone_channel: {
          tenantId: opts.tenantId,
          customerPhone: opts.from,
          channel: opts.channel,
        },
      },
      create: {
        tenantId: opts.tenantId,
        customerPhone: opts.from,
        customerName: opts.senderName ?? null,
        channel: opts.channel,
        lastMessageAt: new Date(),
        unreadCount: 1,
      },
      update: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
        ...(opts.senderName ? { customerName: opts.senderName } : {}),
      },
    });

    await this.prisma.threadMessage.create({
      data: {
        threadId: thread.id,
        direction: 'INBOUND',
        content: opts.message,
        status: 'RECEIVED',
        providerRef: opts.providerRef ?? null,
      },
    });

    return thread;
  }

  // ─── List threads ─────────────────────────────────────────────────────────
  async listThreads(page = 1, limit = 30) {
    const tenantId = getCurrentTenantId()!;
    const [data, total] = await Promise.all([
      this.prisma.messageThread.findMany({
        where: { tenantId },
        orderBy: { lastMessageAt: 'desc' },
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.messageThread.count({ where: { tenantId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Get thread with all messages ────────────────────────────────────────
  async getThread(id: string) {
    const tenantId = getCurrentTenantId()!;
    const thread = await this.prisma.messageThread.findFirst({
      where: { id, tenantId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    // Mark as read
    await this.prisma.messageThread.update({ where: { id }, data: { unreadCount: 0 } });
    return thread;
  }

  // ─── Reply to a thread ───────────────────────────────────────────────────
  async reply(id: string, content: string) {
    const tenantId = getCurrentTenantId()!;
    const thread = await this.prisma.messageThread.findFirst({ where: { id, tenantId } });
    if (!thread) throw new NotFoundException('Thread not found');

    const settings = await this.prisma.messagingSettings.findUnique({ where: { tenantId } });
    if (!settings?.apiKey || !settings?.username) {
      throw new Error('Messaging credentials not configured');
    }

    const isSms = thread.channel === 'SMS';
    const results = isSms
      ? await this.at.sendSms({ apiKey: settings.apiKey, username: settings.username, senderId: settings.senderId ?? undefined, to: [thread.customerPhone], message: content })
      : await this.at.sendWhatsApp({ apiKey: settings.apiKey, username: settings.username, from: settings.whatsappNumber!, to: [thread.customerPhone], message: content });

    const r = results[0];
    const msg = await this.prisma.threadMessage.create({
      data: {
        threadId: thread.id,
        direction: 'OUTBOUND',
        content,
        status: r.status === 'SENT' ? 'SENT' : 'FAILED',
        providerRef: r.messageId ?? null,
      },
    });

    await this.prisma.messageThread.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });

    return msg;
  }

  // ─── Unread count across all threads ─────────────────────────────────────
  async unreadCount() {
    const tenantId = getCurrentTenantId()!;
    const result = await this.prisma.messageThread.aggregate({
      where: { tenantId },
      _sum: { unreadCount: true },
    });
    return { count: result._sum.unreadCount ?? 0 };
  }

  // ─── Templates ───────────────────────────────────────────────────────────
  async listTemplates() {
    const tenantId = getCurrentTenantId()!;
    return this.prisma.messageTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(dto: { name: string; content: string; category?: string; language?: string }) {
    const tenantId = getCurrentTenantId()!;
    return this.prisma.messageTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        content: dto.content,
        category: dto.category ?? 'UTILITY',
        language: dto.language ?? 'en',
        status: 'DRAFT',
      },
    });
  }

  async updateTemplate(id: string, dto: Partial<{ name: string; content: string; category: string; status: string }>) {
    const tenantId = getCurrentTenantId()!;
    const tmpl = await this.prisma.messageTemplate.findFirst({ where: { id, tenantId } });
    if (!tmpl) throw new NotFoundException('Template not found');
    return this.prisma.messageTemplate.update({ where: { id }, data: dto });
  }

  async deleteTemplate(id: string) {
    const tenantId = getCurrentTenantId()!;
    const tmpl = await this.prisma.messageTemplate.findFirst({ where: { id, tenantId } });
    if (!tmpl) throw new NotFoundException('Template not found');
    return this.prisma.messageTemplate.delete({ where: { id } });
  }
}
