import {
  Controller, Get, Post, Body, Param, UseGuards, Req, Headers,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  // ── Public (authenticated) endpoints ───────────────────────────────

  @Get('plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  listPlans() { return this.service.listPlans(); }

  @Get('subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getSubscription() { return this.service.getSubscription(); }

  @Get('payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  listPayments() { return this.service.listPayments(); }

  // ── M-Pesa ──────────────────────────────────────────────────────────

  @Post('mpesa/stk-push')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  initiateMpesaPayment(@Body() dto: { planTier: string; billingCycle: string; phone: string }) {
    return this.service.initiateMpesaPayment(dto);
  }

  @Get('mpesa/status/:requestId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  checkPaymentStatus(@Param('requestId') requestId: string) {
    return this.service.checkPaymentStatus(requestId);
  }

  // M-Pesa IPN — no auth guard, Safaricom calls this directly
  @Post('mpesa/callback')
  async mpesaCallback(@Body() payload: unknown) {
    try { return await this.service.handleMpesaCallback(payload); } catch { return { ok: true }; }
  }

  // ── Stripe Card Payment ─────────────────────────────────────────────

  @Post('stripe/checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createStripeSession(@Body() dto: { planTier: string; billingCycle: string }) {
    return this.service.createStripeSession(dto);
  }

  @Get('stripe/verify/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  verifyStripeSession(@Param('sessionId') sessionId: string) {
    return this.service.verifyStripeSession(sessionId);
  }

  // Stripe webhook — raw body needed for signature verification, no auth
  @Post('stripe/webhook')
  async stripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') sig: string,
  ) {
    try {
      // express.raw() middleware sets req.body to a Buffer for this route
      const rawBody: Buffer = Buffer.isBuffer(req.body)
        ? req.body
        : (req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})));
      return await this.service.handleStripeWebhook(rawBody, sig);
    } catch { return { ok: true }; }
  }

  // ── PayPal ──────────────────────────────────────────────────────────

  @Post('paypal/create-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createPaypalOrder(@Body() dto: { planTier: string; billingCycle: string }) {
    return this.service.createPaypalOrder(dto);
  }

  @Post('paypal/capture-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  capturePaypalOrder(@Body() dto: { orderId: string }) {
    return this.service.capturePaypalOrder(dto.orderId);
  }

  // PayPal IPN webhook — no auth guard
  @Post('paypal/webhook')
  async paypalWebhook(@Body() payload: unknown, @Headers() headers: Record<string, string>) {
    try { return await this.service.handlePaypalWebhook(payload, headers); } catch { return { ok: true }; }
  }

  // ── Manual upgrade fallback ─────────────────────────────────────────

  @Post('upgrade')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  requestUpgrade(@Body() dto: { planTier: string; billingCycle: string; notes?: string }) {
    return this.service.requestUpgrade(dto);
  }
}
