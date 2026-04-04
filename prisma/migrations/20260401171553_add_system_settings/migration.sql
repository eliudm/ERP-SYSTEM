-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyPin" TEXT,
    "companyAddress" TEXT,
    "receiptSlogan" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'KES',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en-KE',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveDrafts" BOOLEAN NOT NULL DEFAULT false,
    "showLowStockAlerts" BOOLEAN NOT NULL DEFAULT true,
    "posReceiptBranding" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);
