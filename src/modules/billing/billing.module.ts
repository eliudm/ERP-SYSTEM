import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingMpesaService } from './billing-mpesa.service';
import { BillingStripeService } from './billing-stripe.service';
import { BillingPaypalService } from './billing-paypal.service';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { MailService } from '../../mail.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingMpesaService,
    BillingStripeService,
    BillingPaypalService,
    SubscriptionSchedulerService,
    MailService,
  ],
  exports: [BillingService],
})
export class BillingModule {}
