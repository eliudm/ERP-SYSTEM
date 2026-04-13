-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'APPROVAL_REQUIRED';
ALTER TYPE "NotificationType" ADD VALUE 'APPROVAL_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'APPROVAL_REJECTED';

-- AlterTable
ALTER TABLE "notifications"
ADD COLUMN "invoiceId" TEXT,
ADD COLUMN "recipientEmail" TEXT,
ADD COLUMN "sentViaEmail" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
