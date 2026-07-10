import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useIntelligenceWorkspace } from "../context/IntelligenceWorkspaceProvider";
import type { SearchResultView } from "../types";
import styles from "../intelligence-workspace.module.css";

type CommandBarProps = {
  results: SearchResultView[];
};

export function CommandBar({ results }: CommandBarProps) {
  const { commandOpen, setCommandOpen } = useIntelligenceWorkspace();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return results.slice(0, 12);
    return results
      .filter(
        (result) =>
          result.title.toLowerCase().includes(normalized) ||
          result.entityType.toLowerCase().includes(normalized) ||
          (result.snippet?.toLowerCase().includes(normalized) ?? false),
      )
      .slice(0, 12);
  }, [query, results]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandOpen]);

  useEffect(() => {
    if (commandOpen) {
      inputRef.current?.focus();
    }
  }, [commandOpen]);

  if (!commandOpen) {
    return (
      <s-button variant="tertiary" onClick={() => setCommandOpen(true)}>
        Search (Ctrl+K)
      </s-button>
    );
  }

  return (
    <div className={styles.commandOverlay} role="presentation">
      <div className={styles.commandPanel} role="dialog" aria-label="Global search">
        <input
          ref={inputRef}
          className={styles.commandInput}
          placeholder="Search products, predictions, experiments, evidence..."
          value={query}
          aria-label="Search query"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className={styles.commandResults}>
          {filtered.length === 0 ? (
            <p className={styles.emptyState}>No results found.</p>
          ) : (
            filtered.map((result) => (
              <button
                key={result.id}
                type="button"
                className={styles.commandResult}
                onClick={() => {
                  setCommandOpen(false);
                  navigate(result.href);
                }}
              >
                <s-text type="strong">{result.title}</s-text>
                <s-text color="subdued">
                  {result.entityType}
                  {result.snippet ? ` · ${result.snippet}` : ""}
                </s-text>
              </button>
            ))
          )}
        </div>
      </div>
      <button
        type="button"
        className={styles.drawerOverlay}
        aria-label="Close search"
        onClick={() => setCommandOpen(false)}
      />
    </div>
  );
}

export function SearchPanel({ results }: CommandBarProps) {
  return <CommandBar results={results} />;
}
