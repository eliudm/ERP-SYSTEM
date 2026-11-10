-- AlterTable
ALTER TABLE "subscription_payments" ADD COLUMN     "paypalCaptureId" TEXT,
ADD COLUMN     "paypalOrderId" TEXT,
ADD COLUMN     "stripePaymentIntent" TEXT,
ADD COLUMN     "stripeSessionId" TEXT;
