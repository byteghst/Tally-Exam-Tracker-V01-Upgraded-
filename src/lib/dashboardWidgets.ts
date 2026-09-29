import type { WidgetConfig } from '@/types';

// 'upcoming-exam' is no longer part of this list: the Next Exam card is now
// always shown, pinned above these customizable widgets (see Dashboard.tsx),
// so it can no longer be hidden or reordered.
export const DASHBOARD_WIDGET_IDS = ['todays-tasks', 'study-time'] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  'todays-tasks': "Today's tasks",
  'study-time': 'Study time today'
};

function isKnownWidgetId(id: string): id is DashboardWidgetId {
  return (DASHBOARD_WIDGET_IDS as readonly string[]).includes(id);
}

/**
 * Merges the user's saved layout with the current set of real widgets:
 * drops ids that no longer correspond to an implemented widget (e.g. a
 * previously-saved 'upcoming-exam' entry), and appends any implemented
 * widget the saved layout doesn't know about yet (e.g. 'study-time' for
 * anyone who saved a layout before it existed).
 */
export function normalizeLayout(layout: WidgetConfig[]): (WidgetConfig & { id: DashboardWidgetId })[] {
  const known = layout.filter((w): w is WidgetConfig & { id: DashboardWidgetId } => isKnownWidgetId(w.id));
  const present = new Set(known.map((w) => w.id));
  const missing = DASHBOARD_WIDGET_IDS.filter((id) => !present.has(id)).map((id, i) => ({
    id,
    visible: true,
    order: known.length + i
  }));
  return [...known, ...missing].sort((a, b) => a.order - b.order);
}

export function getVisibleOrderedIds(layout: WidgetConfig[]): DashboardWidgetId[] {
  return normalizeLayout(layout)
    .filter((w) => w.visible)
    .map((w) => w.id);
}
