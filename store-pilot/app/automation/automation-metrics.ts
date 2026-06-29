import type {
  AutomationLearningProfile,
  AutomationMetrics,
  StoreAutomation,
} from "./automation-types";

export function calculateAutomationMetrics(automations: StoreAutomation[]): AutomationMetrics {
  const total = automations.length;
  const prepared = automations.filter((automation) =>
    ["prepared", "waiting_approval", "approved", "executing", "executed", "verifying", "verified"].includes(
      automation.status,
    ),
  ).length;
  const approved = automations.filter((automation) =>
    ["approved", "executing", "executed", "verifying", "verified"].includes(automation.status),
  ).length;
  const executed = automations.filter((automation) =>
    ["executed", "verifying", "verified"].includes(automation.status),
  ).length;
  const verified = automations.filter((automation) => automation.status === "verified").length;
  const waitingApproval = automations.filter((automation) => automation.status === "waiting_approval").length;
  const merchantApproved = automations.filter((automation) => automation.merchantApproved).length;

  return {
    automationsPrepared: prepared,
    automationsApproved: approved,
    approvalRate: prepared > 0 ? Number((approved / prepared).toFixed(2)) : 0,
    executionRate: approved > 0 ? Number((executed / approved).toFixed(2)) : 0,
    verificationRate: executed > 0 ? Number((verified / executed).toFixed(2)) : 0,
    merchantTimeSavedMinutes: automations
      .filter((automation) => ["verified", "executed"].includes(automation.status))
      .reduce((sum, automation) => sum + automation.estimatedTimeSavedMinutes, 0),
    revenueInfluenced: automations.reduce((sum, automation) => sum + automation.revenueInfluenced, 0),
    operationsAutomated: automations.filter((automation) => automation.operationId).length,
    merchantApprovalRate:
      waitingApproval + merchantApproved > 0
        ? Number((merchantApproved / (waitingApproval + merchantApproved)).toFixed(2))
        : 0,
  };
}

export function updateAutomationLearningProfile(input: {
  learning: AutomationLearningProfile;
  automation: StoreAutomation;
  action: "approved" | "rejected" | "delayed" | "verified";
}): AutomationLearningProfile {
  const category = input.automation.templateId;
  const approved = new Set(input.learning.approvedCategories);
  const rejected = new Set(input.learning.rejectedCategories);
  const delayed = new Set(input.learning.delayedCategories);
  const preferred = new Set(input.learning.preferredTemplates);

  if (input.action === "approved") {
    approved.add(category);
    rejected.delete(category);
    preferred.add(category);
  }
  if (input.action === "rejected") {
    rejected.add(category);
    approved.delete(category);
  }
  if (input.action === "delayed") {
    delayed.add(category);
  }
  if (input.action === "verified") {
    preferred.add(category);
  }

  const totalDecisions = approved.size + rejected.size;
  const approvalRate = totalDecisions > 0 ? Number((approved.size / totalDecisions).toFixed(2)) : 0;

  return {
    approvedCategories: [...approved],
    rejectedCategories: [...rejected],
    delayedCategories: [...delayed],
    preferredTemplates: [...preferred],
    approvalRate,
  };
}

export function suggestTemplateFromLearning(
  learning: AutomationLearningProfile,
  candidates: string[],
): string | null {
  const preferred = candidates.find((templateId) => learning.preferredTemplates.includes(templateId));
  if (preferred) return preferred;
  const notRejected = candidates.find((templateId) => !learning.rejectedCategories.includes(templateId));
  return notRejected ?? candidates[0] ?? null;
}

export function buildAutomationCharts(automations: StoreAutomation[], metrics: AutomationMetrics) {
  const successCount = automations.filter((automation) => automation.status === "verified").length;
  const failedCount = automations.filter((automation) => automation.status === "cancelled").length;

  return {
    successRate: [
      { label: "Verified", value: successCount },
      { label: "Cancelled", value: failedCount },
      { label: "Active", value: automations.filter((a) => !["verified", "archived", "cancelled"].includes(a.status)).length },
    ],
    approvalFunnel: [
      { label: "Draft", value: automations.filter((a) => a.status === "draft").length },
      { label: "Prepared", value: automations.filter((a) => a.status === "prepared").length },
      { label: "Waiting", value: automations.filter((a) => a.status === "waiting_approval").length },
      { label: "Approved", value: automations.filter((a) => a.status === "approved").length },
    ],
    executionTimeline: automations.slice(0, 7).map((automation, index) => ({
      label: `A${index + 1}`,
      value: automation.estimatedTimeSavedMinutes,
    })),
    riskDistribution: [
      { label: "Low", value: automations.filter((a) => a.riskLevel === "low").length },
      { label: "Medium", value: automations.filter((a) => a.riskLevel === "medium").length },
      { label: "High", value: automations.filter((a) => a.riskLevel === "high").length },
      { label: "Critical", value: automations.filter((a) => a.riskLevel === "critical").length },
    ],
    automationTypes: automations.reduce<Array<{ label: string; value: number }>>((acc, automation) => {
      const existing = acc.find((item) => item.label === automation.templateId);
      if (existing) existing.value += 1;
      else acc.push({ label: automation.templateId, value: 1 });
      return acc;
    }, []),
    verificationSuccess: [
      { label: "Passed", value: automations.filter((a) => a.status === "verified").length },
      { label: "Pending", value: automations.filter((a) => a.status === "verifying").length },
      { label: "Failed", value: 0 },
    ],
    automationHeatmap: automations.map((automation) => ({
      label: automation.title.slice(0, 10),
      value: automation.estimatedTimeSavedMinutes,
    })),
    timeSaved: automations.slice(0, 5).map((automation) => ({
      label: automation.templateId.slice(0, 10),
      value: automation.estimatedTimeSavedMinutes,
    })),
    roiDelivered: automations.map((automation) => ({
      label: automation.title.slice(0, 10),
      value: automation.revenueInfluenced,
    })),
    merchantApprovalRate: [
      { label: "Approved", value: Math.round(metrics.merchantApprovalRate * 100) },
      { label: "Pending", value: automations.filter((a) => a.status === "waiting_approval").length * 10 },
    ],
  };
}
