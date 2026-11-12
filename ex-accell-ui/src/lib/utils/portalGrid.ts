// Layout rules for the analytical portals grid: which are shown, in what order, how big.

import type { PortalGridItem } from '$lib/stores/investigationStore';

export interface PortalLayout {
  visible: string[];
  order: string[];
}

export const ALL_PORTALS = [
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'volume', label: 'Volume' },
  { id: 'correlation', label: 'Correlation' },
  { id: 'topics', label: 'Topics' },
  { id: 'geography', label: 'Geography' },
  { id: 'actors', label: 'Actors' }
];

export const GRID_COLUMNS = 12;
export const ROW_HEIGHT = 140;
const FALLBACK_CELL_WIDTH = 80;
const MIN_WIDTH = 3;
const MIN_HEIGHT = 2;
const MAX_HEIGHT = 8;
const DEFAULT_WIDTH = 6;
const DEFAULT_HEIGHT = 2;

export const defaultLayout = (): PortalLayout => ({
  visible: ALL_PORTALS.map((p) => p.id),
  order: ALL_PORTALS.map((p) => p.id)
});

export function visiblePortalIds(layout: PortalLayout): string[] {
  return layout.order.filter((id) => layout.visible.includes(id));
}

export function togglePortalVisibility(layout: PortalLayout, portalId: string): PortalLayout {
  const visible = layout.visible.includes(portalId)
    ? layout.visible.filter((id) => id !== portalId)
    : [...layout.visible, portalId];
  return { ...layout, visible };
}

/** Swaps two portals in the order; null when the drop changes nothing (same portal or an unknown one). */
export function swapPortals(layout: PortalLayout, sourceId: string, targetId: string): PortalLayout | null {
  const order = [...layout.order];
  const srcIdx = order.indexOf(sourceId);
  const tgtIdx = order.indexOf(targetId);
  if (srcIdx < 0 || tgtIdx < 0) return null;
  [order[srcIdx], order[tgtIdx]] = [order[tgtIdx], order[srcIdx]];
  return { ...layout, order };
}

/** Saved sizes for the shown portals; any without one get the default size. */
export function resolveGridItems(visibleIds: string[], grid: PortalGridItem[]): PortalGridItem[] {
  return visibleIds.map((id) => grid.find((g) => g.id === id) || { id, x: 0, y: 0, w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
}

export const portalHeight = (item: PortalGridItem): number => item.h * ROW_HEIGHT;

/** The size after a corner drag of dx/dy pixels, kept inside the grid and rounded to whole cells. */
export function resizedSize(start: { w: number; h: number }, dx: number, dy: number, parentWidth: number | undefined): { w: number; h: number } {
  const cellW = parentWidth ? parentWidth / GRID_COLUMNS : FALLBACK_CELL_WIDTH;
  return {
    w: Math.max(MIN_WIDTH, Math.min(GRID_COLUMNS, Math.round(start.w + dx / cellW))),
    h: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(start.h + dy / ROW_HEIGHT)))
  };
}
