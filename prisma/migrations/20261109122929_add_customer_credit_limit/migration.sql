-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "creditAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creditLimit" DECIMAL(14,2);
