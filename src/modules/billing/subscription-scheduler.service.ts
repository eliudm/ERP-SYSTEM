import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { MailService } from '../../mail.service';

const GRACE_DAYS = 14;

@Injectable()
export class SubscriptionSchedulerService {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Runs every day at 8 AM EAT */
  @Cron('0 5 * * *') // 05:00 UTC = 08:00 EAT
  async checkSubscriptions() {
    this.logger.log('Running subscription expiry check...');
    const now = new Date();

    // 1. Subscriptions that just expired — transition to PAST_DUE + start grace
    const justExpired = await this.prisma.tenantSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] },
        currentPeriodEnd: { lt: now },
      },
      include: { tenant: { include: { users: { where: { role: 'ADMIN' }, take: 1 } } }, plan: true },
    });

    for (const sub of justExpired) {
      const gracePeriodEndsAt = new Date(now);
      gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + GRACE_DAYS);

      await this.prisma.tenantSubscription.update({
        where: { id: sub.id },
        data: { status: 'PAST_DUE', gracePeriodEndsAt, remindersSent: 0 },
      });

      this.logger.warn(`Subscription ${sub.id} (tenant: ${sub.tenant.name}) moved to PAST_DUE. Grace until ${gracePeriodEndsAt.toDateString()}`);
      await this.sendReminder(sub, 0, gracePeriodEndsAt);
    }

    // 2. PAST_DUE within grace — send daily reminder if not sent today
    const inGrace = await this.prisma.tenantSubscription.findMany({
      where: {
        status: 'PAST_DUE',
        gracePeriodEndsAt: { gte: now },
        OR: [
          { lastReminderAt: null },
          { lastReminderAt: { lt: new Date(now.getTime() - 23 * 60 * 60 * 1000) } }, // >23h ago
        ],
      },
      include: { tenant: { include: { users: { where: { role: 'ADMIN' }, take: 1 } } }, plan: true },
    });

    for (const sub of inGrace) {
      const daysLeft = sub.gracePeriodEndsAt
        ? Math.ceil((sub.gracePeriodEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      await this.prisma.tenantSubscription.update({
        where: { id: sub.id },
        data: { remindersSent: { increment: 1 }, lastReminderAt: now },
      });
      await this.sendReminder(sub, daysLeft, sub.gracePeriodEndsAt!);
      this.logger.log(`Reminder sent to ${sub.tenant.name} — ${daysLeft} days left in grace period`);
    }

    // 3. PAST_DUE past grace → EXPIRED (but DO NOT delete data or block access)
    const expired = await this.prisma.tenantSubscription.findMany({
      where: {
        status: 'PAST_DUE',
        gracePeriodEndsAt: { lt: now },
      },
      include: { tenant: { include: { users: { where: { role: 'ADMIN' }, take: 1 } } } },
    });

    for (const sub of expired) {
      await this.prisma.tenantSubscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED' },
      });
      this.logger.warn(`Subscription ${sub.id} (${sub.tenant.name}) EXPIRED — grace period elapsed. Data retained.`);
      const adminEmail = sub.tenant.users[0]?.email;
      if (adminEmail) {
        await this.mail.sendMail({
          to: adminEmail,
          subject: 'Your Nexus ERP subscription has expired',
          html: `
            <p>Hi ${sub.tenant.users[0]?.firstName ?? 'Admin'},</p>
            <p>Your Nexus ERP subscription for <strong>${sub.tenant.name}</strong> has expired.</p>
            <p><strong>Your data is safe</strong> — we have not deleted anything. You can renew at any time to restore full access.</p>
            <p><a href="${process.env.APP_URL ?? 'http://localhost:5173'}/subscription" style="background:#1677ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Renew Subscription</a></p>
            <p>Need help? Contact us at billing@nexus-erp.co.ke or +254 700 000 000.</p>
          `,
        }).catch(() => {/* mail failure should not crash scheduler */});
      }
    }

    this.logger.log(`Subscription check done. Expired: ${justExpired.length}, Reminded: ${inGrace.length}, Lapsed: ${expired.length}`);
  }

  private async sendReminder(sub: any, daysLeft: number, graceEnd: Date) {
    const admin = sub.tenant?.users?.[0];
    if (!admin?.email) return;

    const isFirst = daysLeft === GRACE_DAYS;
    const subject = isFirst
      ? `Your Nexus ERP subscription has expired — ${GRACE_DAYS} days to renew`
      : `Reminder: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left to renew your Nexus ERP subscription`;

    const urgencyColor = daysLeft <= 3 ? '#ff4d4f' : daysLeft <= 7 ? '#fa8c16' : '#1677ff';
    const graceStr = graceEnd.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

    await this.mail.sendMail({
      to: admin.email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto;">
          <div style="background:${urgencyColor};padding:16px 24px;border-radius:8px 8px 0 0;">
            <h2 style="color:#fff;margin:0;">⚠ Subscription Renewal Required</h2>
          </div>
          <div style="border:1px solid #e8e8e8;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
            <p>Hi ${admin.firstName ?? 'Admin'},</p>
            <p>Your <strong>Nexus ERP</strong> subscription for <strong>${sub.tenant.name}</strong> has expired.</p>
            ${daysLeft > 0 ? `
            <div style="background:#fff7e6;border:1px solid #ffd591;border-radius:8px;padding:16px;margin:16px 0;">
              <strong>Grace period: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining (until ${graceStr})</strong><br>
              <small>Your data and access are intact. After ${graceStr}, your account will be marked expired — your data will NOT be deleted.</small>
            </div>` : ''}
            <p>To continue using all features, please renew your subscription:</p>
            <p style="text-align:center;margin:24px 0;">
              <a href="${process.env.APP_URL ?? 'http://localhost:5173'}/subscription"
                 style="background:${urgencyColor};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
                Renew Now
              </a>
            </p>
            <p><strong>Current plan:</strong> ${sub.plan?.name ?? 'Unknown'}<br>
               <strong>Renewal amount:</strong> KES ${Number(sub.plan?.monthlyPrice ?? 0).toLocaleString()}/month</p>
            <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0;">
            <p style="color:#888;font-size:12px;">
              Need help? Email <a href="mailto:billing@nexus-erp.co.ke">billing@nexus-erp.co.ke</a> or WhatsApp +254 700 000 000.
            </p>
          </div>
        </div>
      `,
    }).catch(err => this.logger.error(`Failed to send reminder email to ${admin.email}`, err));

    // Also try SMS via messaging service if phone available
    if (admin.phone) {
      try {
        await this.prisma.smsMessage.create({
          data: {
            tenantId: sub.tenantId,
            recipient: admin.phone,
            message: `Nexus ERP: Your subscription expired. ${daysLeft > 0 ? `${daysLeft} days grace period remaining.` : ''} Renew at ${process.env.APP_URL ?? ''}/subscription or call +254700000000.`,
            status: 'PENDING',
          },
        }).catch(() => {/* ignore */});
      } catch { /* ignore */ }
    }
  }
}
