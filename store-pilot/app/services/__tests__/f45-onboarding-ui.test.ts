import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import { getOrCreateStoreOnboarding } from "../onboarding.server";
import {
  getOnboardingPhaseDisplays,
  getOnboardingStatus,
  getOrdersBlockedDisplay,
  getPhaseIconCharacter,
  getPhaseLabel,
  isMerchantSafeMessage,
  isOrdersSyncBlocked,
  serializeOnboardingForLoader,
  shouldShowOnboardingCard,
} from "../onboarding-ui.server";

function seedRunningOnboarding() {
  const harness = testHarness();
  harness.dbState.storeOnboarding.set(STORE_ID, {
    id: "onboarding-running",
    storeId: STORE_ID,
    status: "running",
    onboardingRunId: "run-1",
    currentJobId: "job-orders-1",
    productSyncStatus: "completed",
    productSyncJobId: "job-products-1",
    productSyncCompletedAt: new Date(),
    inventorySyncStatus: "completed",
    inventorySyncJobId: "job-inventory-1",
    inventorySyncCompletedAt: new Date(),
    ordersSyncStatus: "running",
    ordersSyncJobId: "job-orders-1",
    ordersSyncCompletedAt: null,
    blockedReason: null,
    blockedMessage: null,
    degradedReason: null,
    progressPercent: 85,
    progressLabel: "Syncing orders",
    lastErrorCode: null,
    lastErrorMessage: null,
    attempts: 1,
    maxAttempts: 5,
    startedAt: new Date("2026-06-01T10:00:00Z"),
    coreCompletedAt: null,
    completedAt: null,
    fullCompletedAt: null,
    failedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function seedBlockedOnboarding() {
  const harness = testHarness();
  harness.dbState.storeOnboarding.set(STORE_ID, {
    id: "onboarding-blocked",
    storeId: STORE_ID,
    status: "running",
    onboardingRunId: "run-2",
    currentJobId: null,
    productSyncStatus: "completed",
    productSyncJobId: "job-products-1",
    productSyncCompletedAt: new Date(),
    inventorySyncStatus: "completed",
    inventorySyncJobId: "job-inventory-1",
    inventorySyncCompletedAt: new Date(),
    ordersSyncStatus: "blocked",
    ordersSyncJobId: "job-orders-1",
    ordersSyncCompletedAt: null,
    blockedReason: "access_denied",
    blockedMessage: "Waiting for Shopify order access approval",
    degradedReason: null,
    progressPercent: 90,
    progressLabel: "Syncing orders blocked",
    lastErrorCode: "access_denied",
    lastErrorMessage: "GraphQL error: Access denied for orders field",
    attempts: 1,
    maxAttempts: 5,
    startedAt: new Date("2026-06-01T10:00:00Z"),
    coreCompletedAt: null,
    completedAt: null,
    fullCompletedAt: null,
    failedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function seedCompletedOnboarding() {
  const harness = testHarness();
  harness.dbState.storeOnboarding.set(STORE_ID, {
    id: "onboarding-completed",
    storeId: STORE_ID,
    status: "completed",
    onboardingRunId: "run-3",
    currentJobId: null,
    productSyncStatus: "completed",
    productSyncJobId: "job-products-1",
    productSyncCompletedAt: new Date(),
    inventorySyncStatus: "completed",
    inventorySyncJobId: "job-inventory-1",
    inventorySyncCompletedAt: new Date(),
    ordersSyncStatus: "blocked",
    ordersSyncJobId: "job-orders-1",
    ordersSyncCompletedAt: null,
    blockedReason: "access_denied",
    blockedMessage: "Waiting for Shopify order access approval",
    degradedReason: null,
    progressPercent: 100,
    progressLabel: "Setup complete",
    lastErrorCode: null,
    lastErrorMessage: null,
    attempts: 1,
    maxAttempts: 5,
    startedAt: new Date("2026-06-01T10:00:00Z"),
    coreCompletedAt: new Date("2026-06-01T11:00:00Z"),
    completedAt: new Date("2026-06-01T11:00:00Z"),
    fullCompletedAt: null,
    failedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
});

describe("F.4.5 Onboarding UI Loader", () => {
  it("1. returns null when onboarding is missing", async () => {
    await expect(getOnboardingStatus(STORE_ID)).resolves.toBeNull();
  });

  it("2. returns running onboarding status fields", async () => {
    seedRunningOnboarding();
    const harness = testHarness();
    harness.seedSyncJob({
      id: "job-orders-1",
      jobType: "orders_historical",
      idempotencyKey: "orders-running-ui",
      status: "running",
      attempts: 1,
    });

    const status = await getOnboardingStatus(STORE_ID);

    expect(status).toEqual({
      status: "running",
      progressPercent: 66,
      progressLabel: "Syncing orders",
      productSyncStatus: "completed",
      inventorySyncStatus: "completed",
      ordersSyncStatus: "running",
      blockedReason: null,
      blockedMessage: null,
      currentJobId: "job-orders-1",
      currentJobStatus: "running",
      pipelineState: "running",
      startedAt: expect.any(Date),
      completedAt: null,
    });
    expect(shouldShowOnboardingCard(status)).toBe(true);
  });

  it("3. returns blocked onboarding status with merchant-safe blocked fields", async () => {
    seedBlockedOnboarding();

    const status = await getOnboardingStatus(STORE_ID);
    expect(status?.ordersSyncStatus).toBe("blocked");
    expect(status?.blockedReason).toBe("access_denied");
    expect(status?.blockedMessage).toBe(
      "Waiting for Shopify order access approval",
    );

    const blockedDisplay = getOrdersBlockedDisplay(status!);
    expect(blockedDisplay.heading).toBe("Orders Sync Waiting");
    expect(blockedDisplay.primary).toBe(
      "Waiting for Shopify order access approval",
    );
    expect(blockedDisplay.secondary).toContain(
      "Products and inventory are already synced",
    );
    expect(isOrdersSyncBlocked(status!)).toBe(true);
  });

  it("4. hides onboarding card when onboarding is completed", async () => {
    seedCompletedOnboarding();

    const status = await getOnboardingStatus(STORE_ID);

    expect(status?.status).toBe("completed");
    expect(shouldShowOnboardingCard(status)).toBe(false);
  });

  it("5. serializes onboarding dates for route loader output", async () => {
    seedRunningOnboarding();

    const status = await getOnboardingStatus(STORE_ID);
    const serialized = serializeOnboardingForLoader(status);

    expect(serialized?.startedAt).toMatch(/2026-06-01T10:00:00.000Z/);
    expect(serialized?.completedAt).toBeNull();
    expect(serialized).not.toHaveProperty("currentJobId");
    expect(serialized).not.toHaveProperty("blockedReason");
  });
});

describe("F.4.5 Onboarding UI Presentation", () => {
  it("6. builds phase labels for running onboarding", async () => {
    seedRunningOnboarding();
    const status = await getOnboardingStatus(STORE_ID);
    const phases = getOnboardingPhaseDisplays(status!);

    expect(phases).toEqual([
      { key: "products", label: "Products synced", icon: "complete" },
      { key: "inventory", label: "Inventory synced", icon: "complete" },
      { key: "orders", label: "Orders syncing", icon: "in_progress" },
    ]);
    expect(getPhaseIconCharacter(phases[0]!.icon)).toBe("✓");
    expect(getPhaseIconCharacter(phases[2]!.icon)).toBe("⏳");
  });

  it("7. builds blocked orders phase label and fallback copy", async () => {
    seedBlockedOnboarding();
    const status = await getOnboardingStatus(STORE_ID);

    expect(getPhaseLabel("orders", "blocked")).toBe(
      "Waiting for Shopify order access approval",
    );

    const blockedDisplay = getOrdersBlockedDisplay(status!);
    expect(blockedDisplay.primary).not.toContain("GraphQL");
  });

  it("8. rejects internal error messages for merchant display", () => {
    expect(
      isMerchantSafeMessage("GraphQL error: Access denied for orders field"),
    ).toBe(false);
    expect(
      isMerchantSafeMessage("Waiting for Shopify order access approval"),
    ).toBe(true);
  });

  it("9. shows onboarding card after getOrCreateStoreOnboarding", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);

    const status = await getOnboardingStatus(STORE_ID);

    expect(status?.status).toBe("not_started");
    expect(shouldShowOnboardingCard(status)).toBe(true);
  });
});
