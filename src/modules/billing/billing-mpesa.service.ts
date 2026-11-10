import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import axios, { AxiosInstance } from 'axios';
import { Prisma } from '@prisma/client';

@Injectable()
export class BillingMpesaService {
  private readonly logger = new Logger(BillingMpesaService.name);
  private readonly http: AxiosInstance;
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private readonly shortcode: string;
  private readonly passkey: string;
  private readonly callbackUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const baseUrl = this.config.get('MPESA_BASE_URL') ?? 'https://sandbox.safaricom.co.ke';
    this.consumerKey = this.config.get('MPESA_CONSUMER_KEY') ?? '';
    this.consumerSecret = this.config.get('MPESA_CONSUMER_SECRET') ?? '';
    this.shortcode = this.config.get('MPESA_SHORTCODE') ?? '';
    this.passkey = this.config.get('MPESA_PASSKEY') ?? '';
    // Build the billing-specific callback URL from BACKEND_URL (the NestJS server host)
    const backendUrl = this.config.get('BACKEND_URL') ?? 'http://localhost:3000';
    this.callbackUrl = `${backendUrl}/api/v1/billing/mpesa/callback`;
    this.http = axios.create({ baseURL: baseUrl, timeout: 30_000 });
  }

  /** Kick off STK Push for a subscription payment */
  async initiateStkPush(paymentId: string, phone: string, amount: number): Promise<{
    checkoutRequestId: string;
    customerMessage: string;
  }> {
    if (!this.consumerKey || !this.shortcode || !this.passkey) {
      throw new BadRequestException('M-Pesa not configured. Set MPESA_CONSUMER_KEY, MPESA_SHORTCODE, MPESA_PASSKEY.');
    }

    const token = await this.getToken();
    const timestamp = this.timestamp();
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
    const normalised = this.normalisePhone(phone);

    const { data } = await this.http.post('/mpesa/stkpush/v1/processrequest', {
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: normalised,
      PartyB: this.shortcode,
      PhoneNumber: normalised,
      CallBackURL: this.callbackUrl,
      AccountReference: `SUB-${paymentId.slice(0, 8).toUpperCase()}`,
      TransactionDesc: 'Nexus ERP Subscription',
    }, { headers: { Authorization: `Bearer ${token}` } });

    if (data.ResponseCode !== '0' || !data.CheckoutRequestID) {
      throw new BadRequestException(data.ResponseDescription ?? 'STK push failed');
    }

    // Store the request ID so the callback can find this payment
    await this.prisma.subscriptionPayment.update({
      where: { id: paymentId },
      data: { mpesaRequestId: data.CheckoutRequestID },
    });

    this.logger.log(`STK Push sent for payment ${paymentId}, checkoutRequestId=${data.CheckoutRequestID}`);
    return { checkoutRequestId: data.CheckoutRequestID, customerMessage: data.CustomerMessage ?? 'Check your phone for the M-Pesa prompt' };
  }

  /** Called by M-Pesa IPN — matches payment, activates subscription */
  async handleCallback(payload: unknown): Promise<{ ok: boolean }> {
    const callback = (payload as any)?.Body?.stkCallback;
    if (!callback) {
      this.logger.warn('Invalid billing M-Pesa callback payload');
      return { ok: true }; // always 200 to Safaricom
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;
    const items: { Name: string; Value?: string | number }[] = CallbackMetadata?.Item ?? [];
    const get = (key: string) => items.find(i => i.Name === key)?.Value;

    const isSuccess = Number(ResultCode) === 0;
    const receiptNo = isSuccess ? String(get('MpesaReceiptNumber') ?? '') : null;
    const amount = isSuccess ? Number(get('Amount') ?? 0) : 0;

    // Find the payment record by mpesaRequestId
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: { mpesaRequestId: CheckoutRequestID },
      include: { subscription: { include: { plan: true } } },
    });

    if (!payment) {
      this.logger.warn(`No subscription payment found for CheckoutRequestID ${CheckoutRequestID}`);
      return { ok: true };
    }

    if (!isSuccess) {
      await this.prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', reference: ResultDesc },
      });
      this.logger.log(`Subscription payment ${payment.id} FAILED: ${ResultDesc}`);
      return { ok: true };
    }

    // Activate subscription
    const sub = payment.subscription;
    const now = new Date();
    const billingCycle = (payment.newBillingCycle ?? sub.billingCycle) as string;
    const periodEnd = new Date(now);
    if (billingCycle === 'ANNUAL') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await this.prisma.$transaction([
      this.prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          mpesaReceiptNo: receiptNo,
          paidAt: now,
          amount: new Prisma.Decimal(amount.toFixed(2)),
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

    this.logger.log(`Subscription ${sub.id} ACTIVATED via M-Pesa. Plan: ${payment.planId}, Receipt: ${receiptNo}`);
    return { ok: true };
  }

  /** Poll STK push status (useful for frontend to confirm without waiting for webhook) */
  async queryStkStatus(checkoutRequestId: string): Promise<{ resultCode: number; resultDesc: string; paid: boolean }> {
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: { mpesaRequestId: checkoutRequestId },
    });
    if (!payment) throw new BadRequestException('Payment not found');
    if (payment.status === 'PAID') return { resultCode: 0, resultDesc: 'Success', paid: true };
    if (payment.status === 'FAILED') return { resultCode: 1, resultDesc: payment.reference ?? 'Failed', paid: false };

    // Query Daraja for live status
    try {
      const token = await this.getToken();
      const timestamp = this.timestamp();
      const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
      const { data } = await this.http.post('/mpesa/stkpushquery/v1/query', {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }, { headers: { Authorization: `Bearer ${token}` } });
      return {
        resultCode: Number(data.ResultCode ?? -1),
        resultDesc: data.ResultDesc ?? '',
        paid: Number(data.ResultCode) === 0,
      };
    } catch {
      return { resultCode: -1, resultDesc: 'Pending', paid: false };
    }
  }

  private async getToken(): Promise<string> {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    const { data } = await this.http.get('/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!data.access_token) throw new BadRequestException('Failed to get M-Pesa token');
    return data.access_token as string;
  }

  private timestamp(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  }

  private normalisePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('254') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
    throw new BadRequestException('Use format 07XXXXXXXX or 2547XXXXXXXX');
  }
}
