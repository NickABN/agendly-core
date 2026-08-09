-- AlterTable
ALTER TABLE "StripeWebhookEvent" ADD COLUMN     "notification" JSONB,
ADD COLUMN     "notifiedAt" TIMESTAMP(3);
