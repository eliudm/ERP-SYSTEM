-- Add approval assignment metadata for routing by amount/entity
ALTER TABLE "approval_requests"
ADD COLUMN "assignedRole" "Role",
ADD COLUMN "amountSnapshot" DECIMAL(18,2);

CREATE INDEX "approval_requests_assignedRole_status_idx"
ON "approval_requests"("assignedRole", "status");
