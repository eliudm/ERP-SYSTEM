-- CreateTable
CREATE TABLE "etims_submission_logs" (
    "id" TEXT NOT NULL,
    "etimsId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "requestData" JSONB NOT NULL,
    "responseData" JSONB,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etims_submission_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "etims_submission_logs" ADD CONSTRAINT "etims_submission_logs_etimsId_fkey" FOREIGN KEY ("etimsId") REFERENCES "etims_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
