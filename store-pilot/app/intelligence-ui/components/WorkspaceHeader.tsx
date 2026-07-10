import type { ReactNode } from "react";

import { BreadcrumbNavigator } from "./BreadcrumbNavigator";
import { IntelligenceFlowNav } from "./IntelligenceFlowNav";
import styles from "../intelligence-workspace.module.css";

type WorkspaceHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
};

export function WorkspaceHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: WorkspaceHeaderProps) {
  return (
    <header className={styles.header}>
      <BreadcrumbNavigator items={breadcrumbs} />
      <div className={styles.headerTop}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <IntelligenceFlowNav />
    </header>
  );
}
