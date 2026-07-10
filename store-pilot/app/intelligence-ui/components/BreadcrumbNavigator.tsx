import { Link } from "react-router";

import styles from "../intelligence-workspace.module.css";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbNavigatorProps = {
  items: BreadcrumbItem[];
};

export function BreadcrumbNavigator({ items }: BreadcrumbNavigatorProps) {
  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 ? <span className={styles.breadcrumbSep} aria-hidden="true"> / </span> : null}
          {item.href ? (
            <Link to={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
