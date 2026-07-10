import type { ReactNode } from "react";

import styles from "../intelligence-workspace.module.css";

type SplitViewLayoutProps = {
  main: ReactNode;
  aside?: ReactNode;
};

export function SplitViewLayout({ main, aside }: SplitViewLayoutProps) {
  if (!aside) {
    return <div className={styles.mainPanel}>{main}</div>;
  }

  return (
    <div className={styles.splitLayout}>
      <div className={styles.mainPanel}>{main}</div>
      <aside className={styles.asidePanel}>{aside}</aside>
    </div>
  );
}
