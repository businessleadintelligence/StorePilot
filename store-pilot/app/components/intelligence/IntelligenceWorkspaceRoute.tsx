import { Suspense, lazy, useEffect, useRef } from "react";
import { useLoaderData, useRevalidator } from "react-router";

import { DeferredSectionSkeleton } from "../dashboard/DeferredSectionSkeleton";
import type { IntelligenceWorkspaceLoaderData } from "../../services/intelligence-workspace-types";

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

  return (
    <Suspense fallback={<DeferredSectionSkeleton />}>
      <LazyIntelligenceWorkspace data={data} />
    </Suspense>
  );
}
