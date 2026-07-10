import type { PredictionDashboardUiData } from "../../services/prediction-ui.server";
import { WORKSPACE_ROUTES } from "../../intelligence-ui/constants";
import { ClickableIntelligenceCard } from "../../intelligence-ui/components/ClickableIntelligenceCard";
import { PremiumSection } from "../../components/dashboard/PremiumSection";
import { IconPulse } from "../../components/dashboard/DashboardIcons";
import styles from "../../components/dashboard/premium-dashboard.module.css";
import { BusinessStabilityGauge } from "./BusinessStabilityGauge";
import { PredictionCard } from "./PredictionCard";

type PredictionDashboardCardsProps = {
  prediction: PredictionDashboardUiData;
  currency: string;
};

export function PredictionDashboardCards({
  prediction,
  currency,
}: PredictionDashboardCardsProps) {
  const cards =
    prediction.topRisks.length > 0 ? prediction.topRisks : prediction.items.slice(0, 3);

  return (
    <PremiumSection
      title="Predictions & Prevention"
      subtitle="Forecasts with prevention actions"
      icon={<IconPulse size={20} />}
      href={WORKSPACE_ROUTES.predictions}
      linkLabel="Open workspace"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ClickableIntelligenceCard href={WORKSPACE_ROUTES.predictions} ariaLabel="View business stability">
          <BusinessStabilityGauge score={prediction.businessStabilityScore} />
        </ClickableIntelligenceCard>
        <p className={styles.sectionSubtitle}>
          {prediction.items.length} deterministic forecasts with prevention actions
        </p>
        <div className={styles.insightList}>
          {cards.map((item) => (
            <ClickableIntelligenceCard
              key={item.predictionId}
              href={WORKSPACE_ROUTES.predictions}
              ariaLabel={`Explore prediction ${item.title}`}
            >
              <PredictionCard item={item} currency={currency} />
            </ClickableIntelligenceCard>
          ))}
        </div>
      </div>
    </PremiumSection>
  );
}
