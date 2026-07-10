import { getRootCauseUiItems, getBusinessTimeline } from "../root-cause/api/root-cause-api";
import type { RootCauseUiItem } from "../root-cause/shared/types";

export type RootCauseDashboardUiData = {
  items: RootCauseUiItem[];
  timelineEventCount: number;
};

export async function getRootCauseDashboardForUi(
  storeId: string,
): Promise<RootCauseDashboardUiData | null> {
  const [items, timeline] = await Promise.all([
    getRootCauseUiItems(storeId),
    getBusinessTimeline(storeId),
  ]);

  if (items.length === 0) {
    return null;
  }

  return {
    items,
    timelineEventCount: timeline.events.length,
  };
}
