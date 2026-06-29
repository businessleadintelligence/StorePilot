-- F.6.14: subscription lifecycle audit + webhook single-flight processing
ALTER TABLE "subscriptions" ADD COLUMN "endedAt" TIMESTAMPTZ;

CREATE INDEX "subscriptions_ended_at_idx" ON "subscriptions"("endedAt");

ALTER TABLE "webhook_events" ADD COLUMN "processingOwner" VARCHAR(100);
ALTER TABLE "webhook_events" ADD COLUMN "processingExpiresAt" TIMESTAMPTZ;
ALTER TABLE "webhook_events" ALTER COLUMN "processedAt" DROP NOT NULL;
ALTER TABLE "webhook_events" ALTER COLUMN "processedAt" DROP DEFAULT;
