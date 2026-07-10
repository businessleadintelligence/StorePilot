import type { MerchantIntelligenceUiData } from "../../services/merchant-intelligence-ui.server";
import { WORKSPACE_ROUTES } from "../../intelligence-ui/constants";
import { ClickableIntelligenceCard } from "../../intelligence-ui/components/ClickableIntelligenceCard";
import { PremiumSection } from "../../components/dashboard/PremiumSection";
import { IconMemory } from "../../components/dashboard/DashboardIcons";
import styles from "../../components/dashboard/premium-dashboard.module.css";
import {
  AdaptiveScoreCard,
  LearningProgressCard,
  MerchantBehaviorCard,
  PersonalizationInsights,
  TimelineViewer,
} from "./MerchantIntelligenceCards";

type MerchantIntelligenceDashboardProps = {
  intelligence: MerchantIntelligenceUiData;
};

export function MerchantIntelligenceDashboard({
  intelligence,
}: MerchantIntelligenceDashboardProps) {
  return (
    <PremiumSection
      title="Merchant Intelligence"
      subtitle="Your business DNA and adaptive learning profile"
      icon={<IconMemory size={20} />}
      href={WORKSPACE_ROUTES.merchantIntelligence}
      linkLabel="Open profile"
    >
      <div className={styles.insightList}>
        <ClickableIntelligenceCard
          href={WORKSPACE_ROUTES.merchantIntelligence}
          ariaLabel="Open merchant intelligence workspace"
        >
          <AdaptiveScoreCard score={intelligence.adaptiveScore} />
        </ClickableIntelligenceCard>
        <ClickableIntelligenceCard href={WORKSPACE_ROUTES.merchantIntelligence} ariaLabel="View learning progress">
          <LearningProgressCard
            stage={intelligence.learningStage}
            dnaVersion={intelligence.dnaVersion}
            journalCount={intelligence.decisionJournalCount}
          />
        </ClickableIntelligenceCard>
        {intelligence.behaviorProfile ? (
          <ClickableIntelligenceCard href={WORKSPACE_ROUTES.merchantIntelligence} ariaLabel="View behavior profile">
            <MerchantBehaviorCard behavior={intelligence.behaviorProfile} />
          </ClickableIntelligenceCard>
        ) : null}
        {intelligence.personalization ? (
          <ClickableIntelligenceCard href={WORKSPACE_ROUTES.merchantIntelligence} ariaLabel="View personalization">
            <PersonalizationInsights personalization={intelligence.personalization} />
          </ClickableIntelligenceCard>
        ) : null}
        <ClickableIntelligenceCard href={WORKSPACE_ROUTES.timeline} ariaLabel="View merchant timeline">
          <TimelineViewer events={intelligence.recentTimeline} />
        </ClickableIntelligenceCard>
      </div>
    </PremiumSection>
  );
}
