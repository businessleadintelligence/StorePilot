import { Link } from "react-router";

import type { CrossLinkView } from "../types";
import styles from "../intelligence-workspace.module.css";

type CrossLinksProps = {
  links: CrossLinkView[];
};

export function CrossLinks({ links }: CrossLinksProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Related intelligence" className={styles.crossLinks}>
      {links.map((link) => (
        <Link key={link.href} to={link.href} className={styles.crossLink} title={link.description}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
