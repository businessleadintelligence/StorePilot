import { Link } from "react-router";

import {
  IconArrow,
  WORKSPACE_ICON_MAP,
} from "../../components/dashboard/DashboardIcons";
import styles from "../../components/dashboard/premium-dashboard.module.css";
import { WORKSPACE_ROUTES } from "../constants";
import intelligenceStyles from "../intelligence-workspace.module.css";

type ClickableIntelligenceCardProps = {
  href: string;
  children: React.ReactNode;
  ariaLabel: string;
};

export function ClickableIntelligenceCard({
  href,
  children,
  ariaLabel,
}: ClickableIntelligenceCardProps) {
  return (
    <Link to={href} className={intelligenceStyles.cardLink} aria-label={ariaLabel}>
      <div className={intelligenceStyles.executiveCard}>{children}</div>
    </Link>
  );
}

const WORKSPACE_ACCENTS: Record<string, string> = {
  Executive: "#5c6ac4",
  Inventory: "#008060",
  Pricing: "#f49342",
  "Knowledge Graph": "#7c3aed",
  "Business Memory": "#2c6ecb",
  Timeline: "#b98900",
};

const WORKSPACE_ICON_KEYS: Record<string, keyof typeof WORKSPACE_ICON_MAP> = {
  Executive: "executive",
  Inventory: "inventory",
  Pricing: "pricing",
  "Knowledge Graph": "knowledgeGraph",
  "Business Memory": "businessMemory",
  Timeline: "timeline",
};

export function WorkspaceLaunchCard({
  title,
  description,
  href,
  badge,
}: {
  title: string;
  description: string;
  href: string;
  badge?: string;
}) {
  const iconKey = WORKSPACE_ICON_KEYS[title] ?? "executive";
  const Icon = WORKSPACE_ICON_MAP[iconKey];
  const accent = WORKSPACE_ACCENTS[title] ?? "#5c6ac4";

  return (
    <Link
      to={href}
      className={styles.workspaceCard}
      style={{ ["--ws-accent" as string]: accent }}
      aria-label={`Open ${title} workspace`}
    >
      <span className={styles.workspaceCardAccent} aria-hidden="true" />
      <div className={styles.workspaceCardBody}>
        <div className={styles.workspaceCardTop}>
          <span className={styles.workspaceIcon}>
            <Icon size={22} />
          </span>
          {badge ? <s-badge tone="info">{badge}</s-badge> : null}
        </div>
        <h3 className={styles.workspaceTitle}>{title}</h3>
        <p className={styles.workspaceDescription}>{description}</p>
        <div className={styles.workspaceFooter}>
          <span>Explore workspace</span>
          <IconArrow size={16} />
        </div>
      </div>
    </Link>
  );
}

export function DashboardSectionLink({
  workspace,
  label = "Open workspace",
}: {
  workspace: keyof typeof WORKSPACE_ROUTES;
  label?: string;
}) {
  const href = WORKSPACE_ROUTES[workspace];
  if (typeof href !== "string") return null;
  return <s-link href={href}>{label}</s-link>;
}
