-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "deletionScheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Tenant_deletionScheduledAt_idx" ON "Tenant"("deletionScheduledAt");
