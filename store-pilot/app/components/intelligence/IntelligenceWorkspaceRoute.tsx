import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";

import { DeferredSectionSkeleton } from "../dashboard/DeferredSectionSkeleton";
import type { IntelligenceWorkspaceLoaderData } from "../../services/intelligence-workspace-types";
import type {
  SearchResultView,
  TimelineEventView,
} from "../../intelligence-ui/types";

const LazyIntelligenceWorkspace = lazy(async () => {
  const module = await import("../../services/intelligence-workspace-views");
  return {
    default: function IntelligenceWorkspaceView({
      data,
    }: {
      data: IntelligenceWorkspaceLoaderData;
    }) {
      return module.renderIntelligenceWorkspace(data);
    },
  };
});

type WorkspaceLoaderData = IntelligenceWorkspaceLoaderData & {
  deferWorkspaceLoad?: boolean;
};

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as Promise<T>).then === "function"
  );
}

function DeferredShellWorkspace({ data }: { data: WorkspaceLoaderData }) {
  const [shell, setShell] = useState<{
    searchResults: SearchResultView[];
    timeline: TimelineEventView[];
  }>({
    searchResults: Array.isArray(data.searchResults) ? data.searchResults : [],
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
  });

  useEffect(() => {
    const searchPromise = isPromise<SearchResultView[] | null>(data.searchResults)
      ? data.searchResults
      : null;
    const timelinePromise = isPromise<TimelineEventView[] | null>(data.timeline)
      ? data.timeline
      : null;

    if (!searchPromise && !timelinePromise) {
      return;
    }

    void Promise.all([
      searchPromise ?? Promise.resolve([]),
      timelinePromise ?? Promise.resolve([]),
    ]).then(([searchResults, timeline]) => {
      setShell({
        searchResults: searchResults ?? [],
        timeline: timeline ?? [],
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve deferred shell once per loader payload
  }, [data.searchResults, data.timeline]);

  return (
    <LazyIntelligenceWorkspace
      data={{
        ...data,
        searchResults: shell.searchResults,
        timeline: shell.timeline,
      }}
    />
  );
}

export function IntelligenceWorkspaceRoute() {
  const data = useLoaderData<WorkspaceLoaderData>();
  const { state, revalidate } = useRevalidator();
  const workspaceRevalidatedRef = useRef(false);

  useEffect(() => {
    if (
      !data.deferWorkspaceLoad ||
      workspaceRevalidatedRef.current ||
      state !== "idle"
    ) {
      return;
    }

    workspaceRevalidatedRef.current = true;
    revalidate();
  }, [data.deferWorkspaceLoad, state, revalidate]);

  if (data.deferWorkspaceLoad && !data.workspace) {
    return (
      <s-page heading="Loading workspace">
        <DeferredSectionSkeleton />
      </s-page>
    );
  }

  const hasDeferredShell =
    isPromise(data.searchResults) || isPromise(data.timeline);

  return (
    <Suspense fallback={<DeferredSectionSkeleton />}>
      {hasDeferredShell ? (
        <DeferredShellWorkspace data={data} />
      ) : (
        <LazyIntelligenceWorkspace data={data} />
      )}
    </Suspense>
  );
}
