-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "companyPhone" TEXT,
ADD COLUMN     "paymentInstructions" TEXT,
ADD COLUMN     "invoiceTemplate" TEXT NOT NULL DEFAULT 'modern';
