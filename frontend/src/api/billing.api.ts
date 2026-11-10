import { apiClient } from './client';

export type PlanTier = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';

export interface SubscriptionPlan {
  id: string;
  tier: PlanTier;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  maxUsers: number;
  maxInvoicesMonth: number;
  maxProducts: number;
  features: string[];
}

export interface TenantSubscription {
  id: string;
  planId: string;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  payments: SubscriptionPayment[];
}

export interface SubscriptionPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  reference: string | null;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  createdAt: string;
}

export interface StkPushResult {
  paymentId: string;
  checkoutRequestId: string;
  customerMessage: string;
  amount: number;
  plan: { name: string; tier: PlanTier };
}

export interface StkStatusResult {
  resultCode: number;
  resultDesc: string;
  paid: boolean;
}

export interface StripeSessionResult {
  url: string;
  sessionId: string;
}

export interface StripeVerifyResult {
  paid: boolean;
  paymentId?: string;
}

export interface PaypalOrderResult {
  orderId: string;
}

export interface PaypalCaptureResult {
  success: boolean;
  captureId?: string;
}

export const billingApi = {
  listPlans: () => apiClient.get<SubscriptionPlan[]>('/billing/plans').then(r => r.data),
  getSubscription: () => apiClient.get<TenantSubscription>('/billing/subscription').then(r => r.data),
  listPayments: () => apiClient.get<{ data: SubscriptionPayment[] }>('/billing/payments').then(r => r.data),
  requestUpgrade: (data: { planTier: string; billingCycle: string; notes?: string }) =>
    apiClient.post<{ payment: SubscriptionPayment; plan: SubscriptionPlan; instructions: string }>(
      '/billing/upgrade', data
    ).then(r => r.data),
  initiateStkPush: (data: { planTier: string; billingCycle: string; phone: string }) =>
    apiClient.post<StkPushResult>('/billing/mpesa/stk-push', data).then(r => r.data),
  checkStkStatus: (checkoutRequestId: string) =>
    apiClient.get<StkStatusResult>(`/billing/mpesa/status/${checkoutRequestId}`).then(r => r.data),
  // Stripe
  createStripeSession: (data: { planTier: string; billingCycle: string }) =>
    apiClient.post<StripeSessionResult>('/billing/stripe/checkout', data).then(r => r.data),
  verifyStripeSession: (sessionId: string) =>
    apiClient.get<StripeVerifyResult>(`/billing/stripe/verify/${sessionId}`).then(r => r.data),
  // PayPal
  createPaypalOrder: (data: { planTier: string; billingCycle: string }) =>
    apiClient.post<PaypalOrderResult>('/billing/paypal/create-order', data).then(r => r.data),
  capturePaypalOrder: (orderId: string) =>
    apiClient.post<PaypalCaptureResult>('/billing/paypal/capture-order', { orderId }).then(r => r.data),
};
