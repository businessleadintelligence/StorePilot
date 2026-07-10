import { Link } from "react-router";

import styles from "./premium-dashboard.module.css";

type PremiumSectionProps = {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
};

export function PremiumSection({
  title,
  subtitle,
  icon,
  href,
  linkLabel = "Open",
  children,
  className,
}: PremiumSectionProps) {
  return (
    <section className={`${styles.section} ${className ?? ""}`.trim()}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleWrap}>
          <span className={styles.sectionIcon}>{icon}</span>
          <div>
            <h2 className={styles.sectionTitle}>{title}</h2>
            {subtitle ? <p className={styles.sectionSubtitle}>{subtitle}</p> : null}
          </div>
        </div>
        {href ? (
          <Link to={href} className={styles.sectionLink}>
            {linkLabel}
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
      <div className={styles.panel}>{children}</div>
    </section>
  );
}
