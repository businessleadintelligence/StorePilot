import styles from "./premium-dashboard.module.css";

type PremiumAsideCardProps = {
  title: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
};

export function PremiumAsideCard({ title, badge, icon, children }: PremiumAsideCardProps) {
  return (
    <div className={styles.asideCard}>
      <div className={styles.asideCardHeader}>
        <div className={styles.sectionTitleWrap}>
          {icon ? <span className={styles.sectionIcon}>{icon}</span> : null}
          <strong>{title}</strong>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}
