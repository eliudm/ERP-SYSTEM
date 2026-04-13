-- Add SLA tracking and escalation metadata for approval workflows
ALTER TABLE "approval_requests"
ADD COLUMN "dueAt" TIMESTAMP(3),
ADD COLUMN "escalationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastEscalatedAt" TIMESTAMP(3);

CREATE INDEX "approval_requests_status_dueAt_idx"
ON "approval_requests"("status", "dueAt");
