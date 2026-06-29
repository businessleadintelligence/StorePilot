import "./billing-config-validator";
import "./billing-config-validator";
import prisma from "../db.server";
import { terminateSubscriptionOnUninstall } from "../services/billing.server";
import { cancelStoreJobsOnUninstall } from "../services/job.server";
import { appendBillingAuditEvent, recordBillingLifecycleEvent } from "./billing-audit";
import { buildBillingDashboard, serializeBillingDashboardForLoader } from "./billing-dashboard";
import { resolveStoreCommercialPlan, mapDbPlanSlugToCommercial } from "./billing-entitlements";
import { resolveDowngradeTarget, resolveUpgradeTarget } from "./billing-limits";
import {
  cancelShopifySubscription,
  createShopifySubscriptionCharge,
  listActiveShopifySubscriptions,
  syncInternalPlanFromShopify,
  type ShopifyBillingAdminClient,
} from "./shopify-billing.server";
import { validateBillingIntent, validateBillingPlanSlug } from "./billing-validator";
import { clearBillingUsage } from "./billing-usage";
import type { BillingActionResult, BillingDashboardData, BillingPlanSlug } from "./billing-types";

const CACHE_TTL_MS = 45_000;
const dashboardCache = new Map<string, { expiresAt: number; dashboard: BillingDashboardData }>();

export async function getBillingDashboard(
  storeId: string,
  options: { forceRefresh?: boolean } = {},
): Promise<BillingDashboardData> {
  const cached = dashboardCache.get(storeId);
  if (!options.forceRefresh && cached && Date.now() < cached.expiresAt) {
    return cached.dashboard;
  }

  const dashboard = await buildBillingDashboard(storeId);
  dashboardCache.set(storeId, { expiresAt: Date.now() + CACHE_TTL_MS, dashboard });
  return dashboard;
}

export function serializeBillingDashboardForRoute(
  dashboard: BillingDashboardData,
): BillingDashboardData {
  return serializeBillingDashboardForLoader(dashboard);
}

export function clearBillingServiceCache(storeId?: string): void {
  if (storeId) {
    dashboardCache.delete(storeId);
    clearBillingUsage(storeId);
    return;
  }
  dashboardCache.clear();
  clearBillingUsage();
}

export async function handleBillingAction(input: {
  storeId: string;
  shop: string;
  intent: string;
  planSlug?: string;
  admin: ShopifyBillingAdminClient;
  returnUrl: string;
}): Promise<BillingActionResult> {
  const validation = validateBillingIntent(input.intent);
  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "invalid_intent" };
  }

  const commercial = await resolveStoreCommercialPlan(input.storeId);

  switch (input.intent) {
    case "upgrade-plan": {
      if (!input.planSlug || !validateBillingPlanSlug(input.planSlug)) {
        const target = resolveUpgradeTarget(commercial.plan.slug);
        if (!target) {
          return { ok: false, error: "no_upgrade_available" };
        }
        return startShopifyCharge(input, target);
      }
      return startShopifyCharge(input, input.planSlug);
    }

    case "downgrade-plan": {
      const target = resolveDowngradeTarget(commercial.plan.slug);
      if (!target) {
        return { ok: false, error: "no_downgrade_available" };
      }
      return startShopifyCharge(input, target);
    }

    case "approve-subscription": {
      if (!input.planSlug || !validateBillingPlanSlug(input.planSlug)) {
        return { ok: false, error: "missing_plan" };
      }
      return startShopifyCharge(input, input.planSlug);
    }

    case "cancel-subscription": {
      const active = await listActiveShopifySubscriptions(input.admin);
      const subscription = active[0];
      if (!subscription) {
        await syncInternalPlanFromShopify({
          storeId: input.storeId,
          planSlug: commercial.plan.slug,
          status: "cancelled",
        });
        recordBillingLifecycleEvent(input.storeId, "subscription_cancelled", "Subscription marked cancelled");
        clearBillingServiceCache(input.storeId);
        return { ok: true, message: "Subscription cancelled." };
      }

      return cancelShopifySubscription({
        admin: input.admin,
        storeId: input.storeId,
        subscriptionGid: subscription.id,
      });
    }

    case "refresh-usage":
      clearBillingServiceCache(input.storeId);
      return { ok: true, message: "Usage refreshed." };

    default:
      return { ok: false, error: "unknown_intent" };
  }
}

async function startShopifyCharge(
  input: {
    storeId: string;
    shop: string;
    admin: ShopifyBillingAdminClient;
    returnUrl: string;
  },
  planSlug: BillingPlanSlug,
): Promise<BillingActionResult> {
  const result = await createShopifySubscriptionCharge({
    admin: input.admin,
    storeId: input.storeId,
    shop: input.shop,
    planSlug,
    returnUrl: input.returnUrl,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, message: result.merchantMessage };
  }

  return { ok: true, redirectTo: result.confirmationUrl };
}

export async function handleBillingSubscriptionWebhook(input: {
  storeId: string;
  planName: string;
  status: string;
}): Promise<void> {
  const slug = mapPlanNameToSlug(input.planName);
  const status = mapShopifyStatus(input.status);
  await syncInternalPlanFromShopify({ storeId: input.storeId, planSlug: slug, status });
  clearBillingServiceCache(input.storeId);
  appendBillingAuditEvent({
    storeId: input.storeId,
    eventType: "shopify_subscription_webhook",
    message: `Shopify subscription updated (${slug}, ${status})`,
  });
}

function mapPlanNameToSlug(name: string): BillingPlanSlug {
  const normalized = name.toLowerCase();
  if (normalized.includes("agency")) return "agency";
  if (normalized.includes("pro")) return "pro";
  if (normalized.includes("growth")) return "growth";
  return "starter";
}

function mapShopifyStatus(status: string): "active" | "trialing" | "cancelled" | "past_due" {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "PENDING":
      return "trialing";
    case "FROZEN":
    case "DECLINED":
      return "past_due";
    default:
      return "cancelled";
  }
}

export async function runCommercialUninstallCleanup(storeId: string): Promise<void> {
  await terminateSubscriptionOnUninstall(storeId);
  await cancelStoreJobsOnUninstall(storeId);
  await prisma.store.update({
    where: { id: storeId },
    data: { active: false },
  });
  recordBillingLifecycleEvent(storeId, "uninstall_cleanup", "Stopped jobs, disabled sync eligibility, preserved audit logs");
  clearBillingServiceCache(storeId);
}
