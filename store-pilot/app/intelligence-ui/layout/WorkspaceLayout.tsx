import type { ReactNode } from "react";

import { EvidenceDrawer } from "../components/EvidenceDrawer";
import { CommandBar } from "../components/CommandBar";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { WorkspaceStepContent } from "../components/WorkspaceStepContent";
import { IntelligenceWorkspaceProvider } from "../context/IntelligenceWorkspaceProvider";
import { SplitViewLayout } from "../layout/SplitViewLayout";
import type {
  ActionCenterItem,
  EvidenceItemView,
  IntelligenceEntityView,
  SearchResultView,
  TimelineEventView,
} from "../types";
import styles from "../intelligence-workspace.module.css";

export type WorkspacePageData = {
  title: string;
  subtitle?: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  summary: ReactNode;
  details: ReactNode;
  evidence: EvidenceItemView[];
  timeline: TimelineEventView[];
  related: ReactNode;
  actions: ActionCenterItem[];
  learning: ReactNode;
  aside?: ReactNode;
  entities?: IntelligenceEntityView[];
  searchResults: SearchResultView[];
  currency: string;
};

type WorkspaceLayoutProps = {
  data: WorkspacePageData;
};

export function WorkspaceLayout({ data }: WorkspaceLayoutProps) {
  return (
    <IntelligenceWorkspaceProvider>
      <s-page heading={data.title}>
        <div className={styles.shell}>
          <WorkspaceHeader
            title={data.title}
            subtitle={data.subtitle}
            breadcrumbs={data.breadcrumbs}
            actions={<CommandBar results={data.searchResults} />}
          />
          <SplitViewLayout
            main={
              <WorkspaceStepContent
                summary={data.summary}
                details={data.details}
                evidence={data.evidence}
                timeline={data.timeline}
                related={data.related}
                actions={data.actions}
                learning={data.learning}
                currency={data.currency}
                entities={data.entities}
              />
            }
            aside={data.aside}
          />
        </div>
        <EvidenceDrawer evidence={data.evidence} timeline={data.timeline} />
      </s-page>
    </IntelligenceWorkspaceProvider>
  );
}
