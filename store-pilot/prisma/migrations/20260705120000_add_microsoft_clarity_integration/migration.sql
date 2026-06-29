CREATE TABLE "microsoft_clarity_integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "projectId" VARCHAR(100) NOT NULL,
    "projectName" VARCHAR(255),
    "apiToken" TEXT NOT NULL,
    "connectedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "microsoft_clarity_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "microsoft_clarity_integrations_storeId_key" ON "microsoft_clarity_integrations"("storeId");

CREATE INDEX "microsoft_clarity_integrations_active_sync_idx" ON "microsoft_clarity_integrations"("isActive", "lastSyncAt");

ALTER TABLE "microsoft_clarity_integrations" ADD CONSTRAINT "microsoft_clarity_integrations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
