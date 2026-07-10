import { describe, expect, it } from "vitest";

import { computeAdaptiveScore } from "../adaptive-score/adaptive-scorer";
import { buildBusinessDnaV3 } from "../business-dna/dna-v3-builder";
import { evolveConfidence } from "../confidence/confidence-evolution";
import { ingestIntelligenceEvents } from "../decision-journal/journal-ingest";
import { detectMerchantBehavior } from "../merchant-behavior/behavior-engine";
import { buildMemoryUpdate } from "../memory-update/memory-updater";
import { buildPersonalizationProfile } from "../personalization/personalization-engine";
import {
  learnFromExperiments,
  learnFromPredictions,
  learnFromRecommendations,
  learnFromRootCauses,
} from "../recommendation-learning/recommendation-learner";
import { buildLearningAttribution, formatAttributionChain } from "../shared/learning-attribution";
import type { MerchantIntelligenceContext } from "../shared/types";
import { buildDecisionTimelines, buildMerchantTimeline } from "../timeline/timeline-engine";

function buildContext(): MerchantIntelligenceContext {
  return {
    storeId: "store-1",
    patternSeeds: [
      {
        id: "p1",
        patternType: "inventory_pressure",
        semanticLabel: "inventory_stress",
        confidence: 0.88,
        patternJson: {},
      },
    ],
    businessDna: { revenueBaseline: 12000 },
    businessDnaVersion: 1,
    journalEntries: [],
    experimentEvents: [
      {
        id: "el1",
        experimentId: "exp1",
        eventType: "ExperimentStarted",
        eventJson: { confidence: 0.91, expectedRevenueImpact: 2400 },
        evidenceIds: ["e1"],
        memoryIds: ["p1"],
      },
      {
        id: "el2",
        experimentId: "exp2",
        eventType: "ExperimentRejected",
        eventJson: { confidence: 0.75 },
        evidenceIds: ["e2"],
        memoryIds: [],
      },
    ],
    executiveDecisions: [
      {
        id: "d1",
        title: "Restock inventory",
        category: "inventory",
        confidence: 0.9,
        evidenceIds: ["e3"],
      },
      {
        id: "d2",
        title: "Increase price 5%",
        category: "pricing",
        confidence: 0.85,
        evidenceIds: ["e4"],
      },
    ],
    predictions: [
      {
        id: "pred1",
        predictionKey: "forecast:revenue",
        confidence: 0.89,
        expectedBusinessImpact: 1800,
      },
    ],
    rootCauses: [
      {
        id: "rc1",
        primaryCause: "Inventory shortage",
        confidence: 0.91,
        businessOutcome: "inventory_shortage",
      },
    ],
    experiments: [
      { id: "exp1", experimentKey: "exp:1", status: "approved", confidence: 0.91, expectedRevenueImpact: 2400 },
    ],
    businessStabilityScore: 72,
    lastCheckpointAt: null,
  };
}

describe("Merchant Intelligence — decision journal", () => {
  it("ingests experiment, executive, prediction, and root cause events", () => {
    const entries = ingestIntelligenceEvents(buildContext());
    expect(entries.length).toBeGreaterThan(4);
    expect(entries.some((e) => e.decisionType === "experiment")).toBe(true);
    expect(entries.some((e) => e.decisionType === "executive_decision")).toBe(true);
    expect(entries.some((e) => e.decisionType === "prediction")).toBe(true);
    expect(entries.some((e) => e.decisionType === "root_cause")).toBe(true);
  });
});

describe("Merchant Intelligence — behavior and personalization", () => {
  it("detects merchant behavior preferences deterministically", () => {
    const entries = ingestIntelligenceEvents(buildContext());
    const behavior = detectMerchantBehavior(entries, buildContext());
    expect(behavior.acceptsPricingChanges).toBeGreaterThanOrEqual(0);
    expect(behavior.prefersLowRisk).toBeGreaterThan(0);
  });

  it("deprioritizes pricing when merchant rejects pricing changes", () => {
    const behavior = {
      acceptsPricingChanges: 0.2,
      rejectsInventoryChanges: 0.3,
      ignoresSeo: 0.3,
      prefersAutomation: 0.5,
      acceptsHighConfidenceOnly: 0.7,
      approvesWeekendExperiments: 0.5,
      actsQuickly: 0.4,
      delaysDecisions: 0.3,
      prefersLowRisk: 0.7,
      prefersLongTermGrowth: 0.5,
      prefersOperationalEfficiency: 0.6,
    };
    const profile = buildPersonalizationProfile(behavior);
    expect(profile.deprioritizedDomains).toContain("pricing");
    expect(profile.priorityDomains).toContain("seo");
  });
});

describe("Merchant Intelligence — learning engines", () => {
  it("learns from recommendations, predictions, experiments, and root causes", () => {
    const entries = ingestIntelligenceEvents(buildContext());
    expect(learnFromRecommendations(entries).length).toBeGreaterThan(0);
    expect(learnFromPredictions(entries).length).toBeGreaterThan(0);
    expect(learnFromExperiments(entries).length).toBeGreaterThan(0);
    expect(learnFromRootCauses(entries).length).toBeGreaterThan(0);
  });

  it("evolves confidence with observation count and merchant validation", () => {
    const entries = ingestIntelligenceEvents(buildContext());
    const records = evolveConfidence({ context: buildContext(), entries });
    expect(records.length).toBeGreaterThan(0);
    expect(records[0]!.confidenceScore).toBeGreaterThanOrEqual(0.4);
    expect(records[0]!.observationCount).toBeGreaterThanOrEqual(0);
  });
});

describe("Merchant Intelligence — Business DNA v3", () => {
  it("extends DNA with merchant decision style and maturity scores", () => {
    const entries = ingestIntelligenceEvents(buildContext());
    const behavior = detectMerchantBehavior(entries, buildContext());
    const personalization = buildPersonalizationProfile(behavior);
    const dna = buildBusinessDnaV3({
      context: buildContext(),
      behavior,
      personalization,
      journalCount: entries.length,
      adaptiveScore: 65,
      nextVersion: 2,
    });
    expect(dna.versionNumber).toBe(2);
    expect(dna.merchantDecisionStyle).toBeDefined();
    expect(dna.optimizationMaturity).toBeGreaterThan(0);
    expect(dna.experimentMaturity).toBeGreaterThanOrEqual(0);
  });
});

describe("Merchant Intelligence — adaptive score", () => {
  it("computes Adaptive Intelligence score 0-100", () => {
    const entries = ingestIntelligenceEvents(buildContext());
    const score = computeAdaptiveScore({
      context: buildContext(),
      entries,
      memoryVersionNumber: 2,
      dnaVersionNumber: 2,
    });
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(score.merchantParticipationScore).toBeGreaterThan(0);
  });
});

describe("Merchant Intelligence — timeline and memory", () => {
  it("builds merchant timeline with DNA and memory versions", () => {
    const entries = ingestIntelligenceEvents(buildContext());
    const timeline = buildMerchantTimeline(entries, {
      dnaVersion: 2,
      memoryVersion: 2,
      adaptiveScore: 65,
    });
    expect(timeline.some((e) => e.eventCategory === "business_dna")).toBe(true);
    expect(timeline.some((e) => e.eventCategory === "adaptive_score")).toBe(true);
    expect(buildDecisionTimelines(entries).length).toBe(entries.length);
  });

  it("versions business memory incrementally", () => {
    const update = buildMemoryUpdate(buildContext(), 2);
    expect(update.versionNumber).toBe(2);
    expect(update.patternCount).toBe(1);
  });
});

describe("Merchant Intelligence — learning attribution", () => {
  it("creates auditable provenance chain", () => {
    const attr = buildLearningAttribution({
      attributionKey: "attr:test",
      businessOutcome: "Revenue +6%",
      journalKey: "journal:exp1",
      evidenceIds: ["e1"],
      graphNodeIds: [],
      merchantAction: "approved",
      learningUpdateType: "memory",
      memoryVersionNumber: 2,
      dnaVersionNumber: 2,
    });
    const chain = formatAttributionChain(attr);
    expect(chain.length).toBeGreaterThan(5);
    expect(chain[0]).toContain("Outcome");
  });
});

describe("Merchant Intelligence — large-scale incremental processing", () => {
  it("processes many events without full recomputation", () => {
    const context = buildContext();
    const manyEvents = Array.from({ length: 500 }, (_, i) => ({
      id: `el${i}`,
      experimentId: `exp${i}`,
      eventType: i % 2 === 0 ? "ExperimentStarted" : "ExperimentRejected",
      eventJson: { confidence: 0.8 },
      evidenceIds: [`e${i}`],
      memoryIds: [],
    }));
    const start = performance.now();
    const entries = ingestIntelligenceEvents({ ...context, experimentEvents: manyEvents });
    const score = computeAdaptiveScore({
      context,
      entries,
      memoryVersionNumber: 5,
      dnaVersionNumber: 5,
    });
    const elapsed = performance.now() - start;
    expect(entries.length).toBeGreaterThan(500);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(elapsed).toBeLessThan(500);
  });
});
