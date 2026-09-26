import type { WidgetConfig } from '@/types';

export const DASHBOARD_WIDGET_IDS = ['todays-tasks', 'upcoming-exam'] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  'todays-tasks': "Today's tasks",
  'upcoming-exam': 'Next exam'
};

function isKnownWidgetId(id: string): id is DashboardWidgetId {
  return (DASHBOARD_WIDGET_IDS as readonly string[]).includes(id);
}

/**
 * Merges the user's saved layout with the current set of real widgets:
 * drops ids that no longer correspond to an implemented widget, and appends
 * any implemented widget the saved layout doesn't know about yet.
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
