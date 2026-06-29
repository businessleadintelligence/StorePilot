-- Align commercial plan catalog with App Store listing pricing
UPDATE "plans"
SET
  "monthlyPrice" = 29.00,
  "annualPrice" = 290.00,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'starter';

UPDATE "plans"
SET
  "monthlyPrice" = 79.00,
  "annualPrice" = 790.00,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'growth';

UPDATE "plans"
SET
  "monthlyPrice" = 399.00,
  "annualPrice" = 3990.00,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'agency';

INSERT INTO "plans" (
  "name",
  "slug",
  "monthlyPrice",
  "annualPrice",
  "maxProducts",
  "maxOrders",
  "maxTeamMembers",
  "aiCreditsPerMonth",
  "active",
  "updatedAt"
) VALUES
  ('Pro', 'pro', 199.00, 1990.00, 100000, 500000, 25, 2000, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "monthlyPrice" = EXCLUDED."monthlyPrice",
  "annualPrice" = EXCLUDED."annualPrice",
  "maxProducts" = EXCLUDED."maxProducts",
  "maxOrders" = EXCLUDED."maxOrders",
  "maxTeamMembers" = EXCLUDED."maxTeamMembers",
  "aiCreditsPerMonth" = EXCLUDED."aiCreditsPerMonth",
  "active" = EXCLUDED."active",
  "updatedAt" = CURRENT_TIMESTAMP;
