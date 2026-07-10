import type { RootCauseDashboardUiData } from "../../services/root-cause-ui.server";
import { WORKSPACE_ROUTES } from "../../intelligence-ui/constants";
import { ClickableIntelligenceCard } from "../../intelligence-ui/components/ClickableIntelligenceCard";
import { PremiumSection } from "../../components/dashboard/PremiumSection";
import { IconInsights } from "../../components/dashboard/DashboardIcons";
import styles from "../../components/dashboard/premium-dashboard.module.css";
import { PrimaryCauseCard } from "./PrimaryCauseCard";
import { RootCauseCard } from "./RootCauseCard";

type RootCauseDashboardCardsProps = {
  rootCause: RootCauseDashboardUiData;
  currency: string;
};

export function RootCauseDashboardCards({
  rootCause,
  currency,
}: RootCauseDashboardCardsProps) {
  const top = rootCause.items[0];
  if (!top) {
    return null;
  }

  return (
    <PremiumSection
      title="Root Cause Analysis"
      subtitle="Drill from outcomes to evidence and actions"
      icon={<IconInsights size={20} />}
      href={WORKSPACE_ROUTES.rootCauses}
      linkLabel="Open workspace"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ClickableIntelligenceCard href={WORKSPACE_ROUTES.rootCauses} ariaLabel="Explore primary root cause">
          <PrimaryCauseCard item={top} />
        </ClickableIntelligenceCard>
        <p className={styles.sectionSubtitle}>
          {rootCause.timelineEventCount} timeline events across {rootCause.items.length} detected
          causes
        </p>
        <div className={styles.insightList}>
          {rootCause.items.slice(1, 5).map((item) => (
            <ClickableIntelligenceCard
              key={item.id}
              href={WORKSPACE_ROUTES.rootCauses}
              ariaLabel={`Explore root cause ${item.primaryCause}`}
            >
              <RootCauseCard item={item} currency={currency} />
            </ClickableIntelligenceCard>
          ))}
        </div>
      </div>
    </PremiumSection>
  );
}
