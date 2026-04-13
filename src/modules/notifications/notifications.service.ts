import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { NotificationType, Role } from '@prisma/client';
import { MailService } from '../../mail.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  // ─── GET UNREAD NOTIFICATIONS ─────────────────────────────
  async getUnread() {
    return this.prisma.notification.findMany({
      where: { isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── GET ALL NOTIFICATIONS (paginated) ───────────────────
  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count(),
    ]);
    return { data, meta: { total, page, limit } };
  }

  // ─── MARK ONE AS READ ────────────────────────────────────
  async markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  // ─── MARK ALL AS READ ────────────────────────────────────
  async markAllRead() {
    await this.prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    return { message: 'All notifications marked as read' };
  }

  // ─── UNREAD COUNT ─────────────────────────────────────────
  async unreadCount() {
    const count = await this.prisma.notification.count({
      where: { isRead: false },
    });
    return { count };
  }

  // ─── CHECK & CREATE LOW-STOCK ALERTS ─────────────────────
  // Called after every stock-deduction event (sale approval, manual OUT movement).
  // Creates a notification only if there isn't already an unread one for this product.
  async checkAndNotifyLowStock(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.isActive) return;

    const qty = Number(product.stockQuantity);
    const settings = await this.prisma.systemSetting.findUnique({
      where: { key: 'system' },
    });
    const threshold = settings?.lowStockThreshold ?? 5;

    if (qty > threshold) return; // still fine

    const type: NotificationType =
      qty <= 0 ? NotificationType.OUT_OF_STOCK : NotificationType.LOW_STOCK;

    // Avoid duplicate unread notifications for the same product + type
    const existing = await this.prisma.notification.findFirst({
      where: { productId, type, isRead: false },
    });

    if (existing) return;

    const title =
      qty <= 0 ? `Out of stock: ${product.name}` : `Low stock: ${product.name}`;

    const message =
      qty <= 0
        ? `${product.name} (${product.code}) is out of stock. Please reorder immediately.`
        : `${product.name} (${product.code}) has only ${qty} unit${qty === 1 ? '' : 's'} remaining. Reorder soon.`;

    const notification = await this.prisma.notification.create({
      data: { type, title, message, productId },
    });

    await this.sendToAdminAndAccountantEmails(
      notification.title,
      notification.message,
    );
  }

  async sendOverdueInvoiceReminders(daysOverdue = 0) {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - Math.max(0, daysOverdue));

    const overdue = await this.prisma.salesInvoice.findMany({
      where: {
        status: { in: ['APPROVED', 'SENT'] },
        dueDate: { not: null, lte: cutoff },
      },
      include: {
        customer: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    let created = 0;
    let emailed = 0;

    for (const invoice of overdue) {
      const exists = await this.prisma.notification.findFirst({
        where: {
          invoiceId: invoice.id,
          type: NotificationType.PAYMENT_REMINDER,
          isRead: false,
        },
      });
      if (exists) continue;

      const title = `Payment reminder: ${invoice.invoiceNo}`;
      const message = `Invoice ${invoice.invoiceNo} for ${invoice.customer.name} is overdue. Amount due: ${Number(invoice.total).toFixed(2)}.`;

      const notification = await this.prisma.notification.create({
        data: {
          type: NotificationType.PAYMENT_REMINDER,
          title,
          message,
          invoiceId: invoice.id,
          recipientEmail: invoice.customer.email ?? null,
          sentViaEmail: false,
        },
      });
      created += 1;

      if (invoice.customer.email) {
        await this.mailService.sendMail({
          to: invoice.customer.email,
          subject: `Payment Reminder: ${invoice.invoiceNo}`,
          html: `<p>Dear ${invoice.customer.name},</p><p>This is a reminder that invoice <strong>${invoice.invoiceNo}</strong> is overdue.</p><p>Outstanding amount: <strong>${Number(invoice.total).toFixed(2)}</strong></p>`,
        });

        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { sentViaEmail: true },
        });
        emailed += 1;
      }
    }

    return {
      scanned: overdue.length,
      created,
      emailed,
    };
  }

  async notifyApprovalRequired(
    entityType: string,
    entityId: string,
    assignedRole?: Role,
    dueAt?: Date,
  ) {
    const dueLabel = dueAt
      ? dueAt.toISOString().slice(0, 16).replace('T', ' ')
      : 'N/A';
    const roleLabel = assignedRole ?? Role.ADMIN;
    const title = `Approval required: ${entityType}`;
    const message = `A new ${entityType} document (${entityId}) is awaiting approval by ${roleLabel}. Due: ${dueLabel}.`;

    await this.prisma.notification.create({
      data: {
        type: NotificationType.APPROVAL_REQUIRED,
        title,
        message,
      },
    });

    await this.sendToAdminAndAccountantEmails(title, message);
  }

  async notifyApprovalDecision(
    status: 'APPROVED' | 'REJECTED',
    entityType: string,
    entityId: string,
    recipientEmail?: string,
    reason?: string,
  ) {
    const type =
      status === 'APPROVED'
        ? NotificationType.APPROVAL_APPROVED
        : NotificationType.APPROVAL_REJECTED;
    const title = `${status}: ${entityType}`;
    const message =
      status === 'APPROVED'
        ? `${entityType} ${entityId} has been approved.`
        : `${entityType} ${entityId} has been rejected.${reason ? ` Reason: ${reason}` : ''}`;

    const notification = await this.prisma.notification.create({
      data: {
        type,
        title,
        message,
        recipientEmail: recipientEmail ?? null,
        sentViaEmail: false,
      },
    });

    if (recipientEmail) {
      await this.mailService.sendMail({
        to: recipientEmail,
        subject: `${status}: ${entityType}`,
        html: `<p>${message}</p>`,
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { sentViaEmail: true },
      });
    }
  }

  async notifyApprovalOverdue(
    entityType: string,
    entityId: string,
    dueAt?: Date | null,
  ) {
    const dueLabel = dueAt ? dueAt.toISOString().slice(0, 10) : 'N/A';
    const title = `Overdue approval: ${entityType}`;
    const message = `${entityType} ${entityId} is overdue for approval (due ${dueLabel}).`;

    await this.prisma.notification.create({
      data: {
        type: NotificationType.SYSTEM,
        title,
        message,
      },
    });

    await this.sendToAdminAndAccountantEmails(title, message);
  }

  private async sendToAdminAndAccountantEmails(
    subject: string,
    message: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.ADMIN, Role.ACCOUNTANT] },
      },
      select: { email: true },
    });

    for (const user of users) {
      await this.mailService.sendMail({
        to: user.email,
        subject,
        html: `<p>${message}</p>`,
      });
    }
  }
}
