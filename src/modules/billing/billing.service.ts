import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { getCurrentTenantId } from '../../tenant-context';
import { BillingMpesaService } from './billing-mpesa.service';
import { BillingStripeService } from './billing-stripe.service';
import { BillingPaypalService } from './billing-paypal.service';

// USD prices for PayPal (PayPal doesn't support KES directly)
const USD_PRICES: Record<string, { monthly: number; annual: number }> = {
  STARTER:      { monthly: 19,  annual: 190  },
  PROFESSIONAL: { monthly: 57,  annual: 570  },
  ENTERPRISE:   { monthly: 190, annual: 1900 },
};

const DEFAULT_PLANS = [
  {
    tier: 'FREE',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    maxUsers: 2,
    maxInvoicesMonth: 50,
    maxProducts: 100,
    features: ['Sales invoicing', 'Basic inventory', 'POS', '1 branch'],
  },
  {
    tier: 'STARTER',
    name: 'Starter',
    monthlyPrice: 2500,
    annualPrice: 25000,
    maxUsers: 5,
    maxInvoicesMonth: 500,
    maxProducts: 500,
    features: ['Everything in Free', 'SMS messaging', 'Customer segmentation', '3 branches', 'Basic analytics', 'Email support'],
  },
  {
    tier: 'PROFESSIONAL',
    name: 'Professional',
    monthlyPrice: 7500,
    annualPrice: 75000,
    maxUsers: 20,
    maxInvoicesMonth: 5000,
    maxProducts: 5000,
    features: ['Everything in Starter', 'WhatsApp messaging', 'HR & Payroll', 'Multi-warehouse', 'Advanced analytics', 'Campaign ROI tracking', 'Priority support', 'Unlimited branches'],
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    monthlyPrice: 25000,
    annualPrice: 250000,
    maxUsers: -1,
    maxInvoicesMonth: -1,
    maxProducts: -1,
    features: ['Everything in Professional', 'Custom integrations', 'Dedicated support', 'SLA guarantee', 'Custom onboarding', 'Multi-company management'],
  },
];

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private mpesa: BillingMpesaService,
    private stripe: BillingStripeService,
    private paypal: BillingPaypalService,
  ) {}

  async seedPlans() {
    for (const plan of DEFAULT_PLANS) {
      await this.prisma.subscriptionPlan.upsert({
        where: { tier: plan.tier as any },
        create: plan as any,
        update: { name: plan.name, monthlyPrice: plan.monthlyPrice, annualPrice: plan.annualPrice, features: plan.features },
      });
    }
  }

  async listPlans() {
    return this.prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: 'asc' } });
  }

  async getSubscription() {
    const tenantId = getCurrentTenantId()!;
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true, payments: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!sub) return this.provisionFreeTrial(tenantId);
    return sub;
  }

  private async provisionFreeTrial(tenantId: string) {
    const freePlan = await this.prisma.subscriptionPlan.findUnique({ where: { tier: 'FREE' } });
    if (!freePlan) await this.seedPlans();
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { tier: 'FREE' } });
    if (!plan) throw new Error('Plans not seeded');

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 14);
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.tenantSubscription.create({
      data: {
        tenantId, planId: plan.id, status: 'TRIAL', billingCycle: 'MONTHLY',
        trialEndsAt: trialEnd, currentPeriodStart: now, currentPeriodEnd: periodEnd,
      },
      include: { plan: true, payments: true },
    });
  }

  /** Create a pending payment and initiate M-Pesa STK Push */
  async initiateMpesaPayment(dto: { planTier: string; billingCycle: string; phone: string }) {
    const tenantId = getCurrentTenantId()!;
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { tier: dto.planTier as any } });
    if (!plan) throw new NotFoundException('Plan not found');

    const sub = await this.getSubscription() as any;
    const amount = dto.billingCycle === 'ANNUAL' ? Number(plan.annualPrice) : Number(plan.monthlyPrice);
    if (amount === 0) throw new NotFoundException('Cannot initiate payment for a free plan');

    const now = new Date();
    const periodEnd = new Date(now);
    if (dto.billingCycle === 'ANNUAL') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Create PENDING payment record first
    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id,
        planId: plan.id,
        newBillingCycle: dto.billingCycle,
        amount,
        currency: 'KES',
        status: 'PENDING',
        method: 'MPESA',
        periodStart: now,
        periodEnd,
      },
    });

    // Fire STK push — stores checkoutRequestId in the payment record
    const result = await this.mpesa.initiateStkPush(payment.id, dto.phone, amount);

    return {
      paymentId: payment.id,
      checkoutRequestId: result.checkoutRequestId,
      customerMessage: result.customerMessage,
      amount,
      plan: { name: plan.name, tier: plan.tier },
    };
  }

  /** Manual upgrade request (fallback when M-Pesa not configured) */
  async requestUpgrade(dto: { planTier: string; billingCycle: string; notes?: string }) {
    const tenantId = getCurrentTenantId()!;
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { tier: dto.planTier as any } });
    if (!plan) throw new NotFoundException('Plan not found');

    const sub = await this.getSubscription() as any;
    const amount = dto.billingCycle === 'ANNUAL' ? Number(plan.annualPrice) : Number(plan.monthlyPrice);
    const now = new Date();
    const periodEnd = new Date(now);
    if (dto.billingCycle === 'ANNUAL') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id, planId: plan.id, newBillingCycle: dto.billingCycle,
        amount, currency: 'KES', status: 'PENDING', method: 'MANUAL', periodStart: now, periodEnd,
      },
    });

    return {
      payment, plan,
      instructions: `Pay KES ${amount.toLocaleString()} via M-Pesa Paybill or bank transfer.\nSend proof to billing@nexus-erp.co.ke with reference: PAY-${payment.id.slice(0, 8).toUpperCase()}`,
    };
  }

  async listPayments() {
    const tenantId = getCurrentTenantId()!;
    const sub = await this.prisma.tenantSubscription.findUnique({ where: { tenantId } });
    if (!sub) return { data: [] };
    const payments = await this.prisma.subscriptionPayment.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: 'desc' },
    });
    return { data: payments };
  }

  /** Check M-Pesa STK Push status by checkoutRequestId */
  async checkPaymentStatus(checkoutRequestId: string) {
    return this.mpesa.queryStkStatus(checkoutRequestId);
  }

  /** Handle M-Pesa callback — delegated to mpesa service */
  async handleMpesaCallback(payload: unknown) {
    return this.mpesa.handleCallback(payload);
  }

  // ── Stripe ──────────────────────────────────────────────────────────

  async createStripeSession(dto: { planTier: string; billingCycle: string }) {
    const tenantId = getCurrentTenantId()!;
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { tier: dto.planTier as any } });
    if (!plan) throw new NotFoundException('Plan not found');

    const sub = await this.getSubscription() as any;
    const amount = dto.billingCycle === 'ANNUAL' ? Number(plan.annualPrice) : Number(plan.monthlyPrice);
    if (amount === 0) throw new NotFoundException('Cannot pay for a free plan');

    const now = new Date();
    const periodEnd = new Date(now);
    if (dto.billingCycle === 'ANNUAL') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id, planId: plan.id, newBillingCycle: dto.billingCycle,
        amount, currency: 'KES', status: 'PENDING', method: 'CARD', periodStart: now, periodEnd,
      },
    });

    return this.stripe.createCheckoutSession(payment.id, amount, 'KES', plan.name);
  }

  async verifyStripeSession(sessionId: string) {
    return this.stripe.verifySession(sessionId);
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    return this.stripe.handleWebhook(rawBody, signature);
  }

  // ── PayPal ──────────────────────────────────────────────────────────

  async createPaypalOrder(dto: { planTier: string; billingCycle: string }) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { tier: dto.planTier as any } });
    if (!plan) throw new NotFoundException('Plan not found');

    const sub = await this.getSubscription() as any;
    const kesAmount = dto.billingCycle === 'ANNUAL' ? Number(plan.annualPrice) : Number(plan.monthlyPrice);
    if (kesAmount === 0) throw new NotFoundException('Cannot pay for a free plan');

    // PayPal processes in USD — use defined USD prices or fallback to KES/130 rate
    const usdPrices = USD_PRICES[dto.planTier];
    const usdAmount = usdPrices
      ? (dto.billingCycle === 'ANNUAL' ? usdPrices.annual : usdPrices.monthly)
      : Math.round((kesAmount / 130) * 100) / 100;

    const now = new Date();
    const periodEnd = new Date(now);
    if (dto.billingCycle === 'ANNUAL') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id, planId: plan.id, newBillingCycle: dto.billingCycle,
        amount: usdAmount, currency: 'USD', status: 'PENDING', method: 'PAYPAL', periodStart: now, periodEnd,
      },
    });

    return this.paypal.createOrder(payment.id, usdAmount, 'USD', plan.name);
  }

  async capturePaypalOrder(orderId: string) {
    return this.paypal.captureOrder(orderId);
  }

  async handlePaypalWebhook(payload: unknown, headers: Record<string, string>) {
    return this.paypal.handleWebhook(payload, headers);
  }
}
