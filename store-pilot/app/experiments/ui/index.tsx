import type { ExperimentDashboardUiData } from "../../services/experiment-ui.server";
import { WORKSPACE_ROUTES } from "../../intelligence-ui/constants";
import { ClickableIntelligenceCard } from "../../intelligence-ui/components/ClickableIntelligenceCard";
import { PremiumSection } from "../../components/dashboard/PremiumSection";
import { IconSpark } from "../../components/dashboard/DashboardIcons";
import styles from "../../components/dashboard/premium-dashboard.module.css";
import { SuggestedExperimentCard } from "./SuggestedExperimentCard";

type ExperimentDashboardCardsProps = {
  experiments: ExperimentDashboardUiData;
  currency: string;
};

export function ExperimentDashboardCards({
  experiments,
  currency,
}: ExperimentDashboardCardsProps) {
  return (
    <PremiumSection
      title="Suggested Experiments"
      subtitle="Shadow-mode previews — no store changes until you approve"
      icon={<IconSpark size={20} />}
      href={WORKSPACE_ROUTES.experiments}
      linkLabel="Open workspace"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p className={styles.sectionSubtitle}>
          {experiments.recommendationCount} recommendations from evidence.
        </p>
        <div className={styles.insightList}>
          {experiments.items.slice(0, 3).map((item) => (
            <ClickableIntelligenceCard
              key={item.experimentId}
              href={WORKSPACE_ROUTES.experiments}
              ariaLabel={`Explore experiment ${item.title}`}
            >
              <SuggestedExperimentCard item={item} currency={currency} />
            </ClickableIntelligenceCard>
          ))}
        </div>
      </div>
    </PremiumSection>
  );
}
