import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import axios, { AxiosInstance } from 'axios';
import { Prisma } from '@prisma/client';

@Injectable()
export class BillingPaypalService {
  private readonly logger = new Logger(BillingPaypalService.name);
  private readonly http: AxiosInstance;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const sandbox = this.config.get<string>('PAYPAL_ENV') !== 'production';
    this.clientId = this.config.get<string>('PAYPAL_CLIENT_ID') ?? '';
    this.clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET') ?? '';
    this.webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID') ?? '';
    this.http = axios.create({
      baseURL: sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com',
      timeout: 30_000,
    });
  }

  private ensureConfigured() {
    const invalid = (v: string) => !v || v === 'sb' || v === 'placeholder' || v.length < 10;
    if (invalid(this.clientId) || invalid(this.clientSecret)) {
      throw new BadRequestException('PayPal payments are not configured yet. Please contact your administrator.');
    }
  }

  private async getToken(): Promise<string> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    try {
      const { data } = await this.http.post('/v1/oauth2/token',
        'grant_type=client_credentials',
        { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      if (!data.access_token) throw new BadRequestException('PayPal did not return an access token');
      return data.access_token as string;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      const status = err?.response?.status;
      const msg = status === 401
        ? 'PayPal credentials are invalid. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.'
        : (err?.message ?? 'Failed to authenticate with PayPal');
      this.logger.error(`PayPal token error: ${msg}`);
      throw new BadRequestException(msg);
    }
  }

  /** Create a PayPal order and return the order ID */
  async createOrder(paymentId: string, amount: number, currency: string, planName: string): Promise<{ orderId: string }> {
    this.ensureConfigured();
    const token = await this.getToken();

    const { data } = await this.http.post('/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: paymentId,
        description: `Nexus ERP — ${planName} Subscription`,
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
      }],
      application_context: {
        brand_name: 'Nexus ERP',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
      },
    }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });

    if (!data.id) throw new BadRequestException('Failed to create PayPal order');

    // Store order ID on the payment record
    await this.prisma.subscriptionPayment.update({
      where: { id: paymentId },
      data: { paypalOrderId: data.id, method: 'PAYPAL' },
    });

    this.logger.log(`PayPal order ${data.id} created for payment ${paymentId}`);
    return { orderId: data.id };
  }

  /** Capture an approved PayPal order and activate subscription */
  async captureOrder(orderId: string): Promise<{ success: boolean; captureId?: string }> {
    this.ensureConfigured();
    const token = await this.getToken();

    let captureData: any;
    try {
      const { data } = await this.http.post(
        `/v2/checkout/orders/${orderId}/capture`,
        {},
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      captureData = data;
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err.message;
      throw new BadRequestException(`PayPal capture failed: ${msg}`);
    }

    if (captureData.status !== 'COMPLETED') {
      return { success: false };
    }

    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const paymentId = captureData.purchase_units?.[0]?.reference_id;
    const captureId = capture?.id;
    const amount = Number(capture?.amount?.value ?? 0);

    if (paymentId) {
      await this.activatePayment(paymentId, orderId, captureId, amount);
    }

    return { success: true, captureId };
  }

  /** Handle PayPal IPN webhook (PAYMENT.CAPTURE.COMPLETED) */
  async handleWebhook(payload: any, headers: Record<string, string>): Promise<{ ok: boolean }> {
    if (payload?.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const capture = payload.resource;
      const paymentId = capture?.custom_id ?? payload?.resource?.supplementary_data?.related_ids?.order_id;
      const orderId = payload?.resource?.supplementary_data?.related_ids?.order_id;
      const captureId = capture?.id;
      const amount = Number(capture?.amount?.value ?? 0);

      // Try to find the payment by paypalOrderId
      if (orderId) {
        const payment = await this.prisma.subscriptionPayment.findFirst({
          where: { paypalOrderId: orderId },
        });
        if (payment && payment.status !== 'PAID') {
          await this.activatePayment(payment.id, orderId, captureId, amount);
        }
      }
    }
    return { ok: true };
  }

  private async activatePayment(paymentId: string, orderId: string, captureId: string, amount: number) {
    const payment = await this.prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { subscription: true },
    });
    if (!payment || payment.status === 'PAID') return;

    const now = new Date();
    const sub = payment.subscription;
    const billingCycle = (payment.newBillingCycle ?? sub.billingCycle) as string;
    const periodEnd = new Date(now);
    if (billingCycle === 'ANNUAL') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await this.prisma.$transaction([
      this.prisma.subscriptionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          paypalCaptureId: captureId,
          paidAt: now,
          amount: amount > 0 ? new Prisma.Decimal(amount.toFixed(2)) : payment.amount,
        },
      }),
      this.prisma.tenantSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          planId: payment.planId ?? sub.planId,
          billingCycle: billingCycle as any,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          gracePeriodEndsAt: null,
          remindersSent: 0,
          lastReminderAt: null,
        },
      }),
    ]);

    this.logger.log(`Subscription ${sub.id} ACTIVATED via PayPal. Plan: ${payment.planId}, CaptureId: ${captureId}`);
  }
}
