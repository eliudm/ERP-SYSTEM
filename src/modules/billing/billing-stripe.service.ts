import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';

@Injectable()
export class BillingStripeService {
  private readonly logger = new Logger(BillingStripeService.name);
  private stripe: Stripe | null = null;
  private readonly webhookSecret: string;
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    this.appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    // Only initialise if the key looks like a real Stripe key (sk_test_... or sk_live_...)
    if (key && (key.startsWith('sk_test_') || key.startsWith('sk_live_')) && key.length > 20) {
      this.stripe = new Stripe(key, { apiVersion: '2026-10-28.endive' });
    }
  }

  private ensureConfigured(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Card payments are not configured yet. Please contact your administrator.');
    }
    return this.stripe;
  }

  /** Create a Stripe Checkout Session and return the redirect URL */
  async createCheckoutSession(paymentId: string, amount: number, currency: string, planName: string): Promise<{ url: string; sessionId: string }> {
    const stripe = this.ensureConfigured();

    const sessionParams: any = {
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: Math.round(amount * 100), // Stripe uses cents
          product_data: {
            name: `Nexus ERP — ${planName}`,
            description: 'Subscription payment',
          },
        },
        quantity: 1,
      }],
      success_url: `${this.appUrl}/subscription?stripe_session={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${this.appUrl}/subscription?status=cancelled`,
      metadata: { paymentId },
    };
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to create Stripe checkout session';
      this.logger.error(`Stripe session error: ${msg}`);
      throw new BadRequestException(msg);
    }

    if (!session.url) throw new BadRequestException('Failed to create Stripe session');

    // Store session ID on the payment record
    await this.prisma.subscriptionPayment.update({
      where: { id: paymentId },
      data: { stripeSessionId: session.id, method: 'CARD' },
    });

    this.logger.log(`Stripe Checkout session ${session.id} created for payment ${paymentId}`);
    return { url: session.url, sessionId: session.id };
  }

  /** Verify a completed Stripe session and activate subscription */
  async verifySession(sessionId: string): Promise<{ paid: boolean; paymentId?: string }> {
    const stripe = this.ensureConfigured();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { paid: false };
    }

    const paymentId = session.metadata?.paymentId;
    if (!paymentId) return { paid: false };

    await this.activatePayment(paymentId, session.payment_intent as string | null, Number(session.amount_total) / 100);
    return { paid: true, paymentId };
  }

  /** Handle Stripe webhook (checkout.session.completed) */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ ok: boolean }> {
    const stripe = this.ensureConfigured();
    if (!this.webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
      return { ok: true };
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (err: any) {
      this.logger.error(`Stripe webhook signature failed: ${err.message}`);
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid' && session.metadata?.paymentId) {
        await this.activatePayment(
          session.metadata.paymentId,
          session.payment_intent as string | null,
          Number(session.amount_total) / 100,
        );
      }
    }

    return { ok: true };
  }

  private async activatePayment(paymentId: string, paymentIntentId: string | null, amount: number) {
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
          stripePaymentIntent: paymentIntentId,
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

    this.logger.log(`Subscription ${sub.id} ACTIVATED via Stripe. Plan: ${payment.planId}, Cycle: ${billingCycle}`);
  }
}
