-- F.6.14: subscription lifecycle audit + webhook single-flight processing
-- Dependency repair: ALTER statements moved to migrations that create the target tables.
--   subscriptions  -> 20260620220000_add_billing_foundation
--   webhook_events   -> 20260621103524_add_inventory_item_foundation
SELECT 1;
