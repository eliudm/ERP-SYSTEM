-- AlterTable
ALTER TABLE "subscription_payments" ADD COLUMN     "newBillingCycle" TEXT,
ADD COLUMN     "planId" TEXT;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
