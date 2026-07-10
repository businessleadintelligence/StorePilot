-- Privacy hardening: export TTL, order redaction flags

ALTER TABLE "orders"
ADD COLUMN "privacyRedacted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "order_line_items"
ADD COLUMN "privacyRedacted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "customer_data_exports"
ADD COLUMN "expiresAt" TIMESTAMPTZ;

UPDATE "customer_data_exports"
SET "expiresAt" = "createdAt" + INTERVAL '30 days'
WHERE "expiresAt" IS NULL;

CREATE INDEX "orders_store_privacy_redacted_idx"
ON "orders" ("storeId", "privacyRedacted");

CREATE INDEX "customer_data_exports_expires_at_idx"
ON "customer_data_exports" ("expiresAt");
