import type { ExecutiveDashboardUiData } from "../../services/executive-ui.server";
import { WORKSPACE_ROUTES } from "../../intelligence-ui/constants";
import { ClickableIntelligenceCard } from "../../intelligence-ui/components/ClickableIntelligenceCard";
import { PremiumSection } from "../../components/dashboard/PremiumSection";
import { IconExecutive } from "../../components/dashboard/DashboardIcons";
import { DailyOperatingPlanCard } from "./DailyOperatingPlanCard";
import { ExecutiveBriefingCard } from "./ExecutiveBriefingCard";
import { ExecutivePriorityList } from "./ExecutivePriorityList";
import { OperationalReadinessGauge } from "./OperationalReadinessGauge";

type ExecutiveDashboardCardsProps = {
  executive: ExecutiveDashboardUiData;
};

export function ExecutiveDashboardCards({ executive }: ExecutiveDashboardCardsProps) {
  return (
    <PremiumSection
      title="Executive Intelligence"
      subtitle="Decision-first operating intelligence"
      icon={<IconExecutive size={20} />}
      href={WORKSPACE_ROUTES.executive}
      linkLabel="Open workspace"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ClickableIntelligenceCard href={WORKSPACE_ROUTES.executive} ariaLabel="Open executive workspace">
          <OperationalReadinessGauge score={executive.operationalReadinessScore} />
        </ClickableIntelligenceCard>
        {executive.briefing ? (
          <ClickableIntelligenceCard href={WORKSPACE_ROUTES.executive} ariaLabel="View executive briefing">
            <ExecutiveBriefingCard briefing={executive.briefing} />
          </ClickableIntelligenceCard>
        ) : null}
        {executive.operatingPlan ? (
          <ClickableIntelligenceCard href={WORKSPACE_ROUTES.executive} ariaLabel="View operating plan">
            <DailyOperatingPlanCard
              plan={executive.operatingPlan}
              currency={executive.currency}
            />
          </ClickableIntelligenceCard>
        ) : null}
        <ClickableIntelligenceCard href={WORKSPACE_ROUTES.executive} ariaLabel="View decision queue">
          <ExecutivePriorityList cards={executive.decisionCards} currency={executive.currency} />
        </ClickableIntelligenceCard>
      </div>
    </PremiumSection>
  );
}
