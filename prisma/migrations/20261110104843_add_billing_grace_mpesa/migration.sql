-- AlterTable
ALTER TABLE "subscription_payments" ADD COLUMN     "mpesaReceiptNo" TEXT,
ADD COLUMN     "mpesaRequestId" TEXT;

-- AlterTable
ALTER TABLE "tenant_subscriptions" ADD COLUMN     "gracePeriodEndsAt" TIMESTAMP(3),
ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "remindersSent" INTEGER NOT NULL DEFAULT 0;
