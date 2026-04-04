import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

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

    await this.prisma.notification.create({
      data: { type, title, message, productId },
    });
  }
}
