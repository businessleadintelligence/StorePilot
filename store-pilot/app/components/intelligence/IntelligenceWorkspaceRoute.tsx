import { Suspense, lazy, useEffect, useState } from "react";
import { Await, useLoaderData } from "react-router";

import { DeferredSectionSkeleton } from "../dashboard/DeferredSectionSkeleton";
import type {
  IntelligenceWorkspaceLoaderData,
  IntelligenceWorkspacePayload,
} from "../../services/intelligence-workspace-types";
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

type WorkspaceLoaderData = IntelligenceWorkspaceLoaderData;

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

function ResolvedWorkspace({
  data,
  workspace,
}: {
  data: WorkspaceLoaderData;
  workspace: IntelligenceWorkspacePayload | null;
}) {
  const resolved: WorkspaceLoaderData = { ...data, workspace };
  const hasDeferredShell =
    isPromise(data.searchResults) || isPromise(data.timeline);

  return (
    <Suspense fallback={<DeferredSectionSkeleton />}>
      {hasDeferredShell ? (
        <DeferredShellWorkspace data={resolved} />
      ) : (
        <LazyIntelligenceWorkspace data={resolved} />
      )}
    </Suspense>
  );
}

/**
 * Phase 1 paints title + skeleton immediately.
 * Phase 2 streams workspace core via Await (no client revalidate round-trip).
 * Phase 3/4: charts / search / timeline resolve in DeferredShellWorkspace.
 */
export function IntelligenceWorkspaceRoute({
  title = "Intelligence Workspace",
}: {
  title?: string;
}) {
  const data = useLoaderData<WorkspaceLoaderData>();

  if (data.featureGate && !data.featureGate.available) {
    return (
      <Suspense fallback={<DeferredSectionSkeleton />}>
        <LazyIntelligenceWorkspace data={data} />
      </Suspense>
    );
  }

  if (isPromise(data.workspace)) {
    return (
      <Suspense
        fallback={
          <s-page heading={title}>
            <DeferredSectionSkeleton title={`Loading ${title}…`} />
          </s-page>
        }
      >
        <Await resolve={data.workspace}>
          {(workspace) => (
            <ResolvedWorkspace data={data} workspace={workspace} />
          )}
        </Await>
      </Suspense>
    );
  }

  return <ResolvedWorkspace data={data} workspace={data.workspace} />;
}
