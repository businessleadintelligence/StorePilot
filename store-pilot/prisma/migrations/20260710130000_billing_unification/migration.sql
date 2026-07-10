-- Billing unification: Starter/Growth/Scale from plan registry; migrate Pro/Agency -> Scale

INSERT INTO "plans" (
  "name", "slug", "monthlyPrice", "annualPrice",
  "maxProducts", "maxOrders", "maxTeamMembers", "aiCreditsPerMonth", "active", "updatedAt"
)
VALUES
  ('Starter', 'starter', 29.00, 290.00, 5000, 5000, 1, 500, true, CURRENT_TIMESTAMP),
  ('Growth', 'growth', 79.00, 790.00, 50000, 50000, 5, 5000, true, CURRENT_TIMESTAMP),
  ('Scale', 'scale', 199.00, 1990.00, 2147483647, 2147483647, 2147483647, 2147483647, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthlyPrice" = EXCLUDED."monthlyPrice",
  "annualPrice" = EXCLUDED."annualPrice",
  "maxProducts" = EXCLUDED."maxProducts",
  "maxOrders" = EXCLUDED."maxOrders",
  "maxTeamMembers" = EXCLUDED."maxTeamMembers",
  "aiCreditsPerMonth" = EXCLUDED."aiCreditsPerMonth",
  "active" = EXCLUDED."active",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Migrate subscriptions from legacy pro/agency plans to scale
UPDATE "subscriptions" AS s
SET "planId" = scale_plan."id", "updatedAt" = CURRENT_TIMESTAMP
FROM "plans" AS scale_plan
WHERE scale_plan."slug" = 'scale'
  AND s."planId" IN (SELECT "id" FROM "plans" WHERE "slug" IN ('pro', 'agency'));

-- Deactivate legacy plans (preserve rows for audit compatibility)
UPDATE "plans"
SET "active" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" IN ('pro', 'agency');

-- Add scale to SubscriptionPlan enum if missing (Postgres)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SubscriptionPlan' AND e.enumlabel = 'scale'
  ) THEN
    ALTER TYPE "SubscriptionPlan" ADD VALUE 'scale';
  END IF;
END $$;
