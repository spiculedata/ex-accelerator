import { writable, derived } from 'svelte/store';

export interface InvestigationSelection {
  timeRange: { start: string; end: string } | null;
  sentiment: string[] | null;
  sources: string[] | null;
  selectedIds: Set<string>;
  keywords: string[] | null;
  hoveredId: string | null;
}

export const investigationSelection = writable<InvestigationSelection>({
  timeRange: null,
  sentiment: null,
  sources: null,
  selectedIds: new Set(),
  keywords: null,
  hoveredId: null
});

/**
 * Set the active time range filter
 */
export function setTimeRange(start: string, end: string): void {
  investigationSelection.update(s => ({ ...s, timeRange: { start, end } }));
}

/**
 * Set the active sentiment filter (e.g. ['positive', 'negative'])
 */
export function setSentimentFilter(sentiments: string[]): void {
  investigationSelection.update(s => ({
    ...s,
    sentiment: sentiments.length > 0 ? sentiments : null
  }));
}

/**
 * Set the hovered item ID (for cross-panel highlighting)
 */
export function setHoveredId(id: string | null): void {
  investigationSelection.update(s => ({ ...s, hoveredId: id }));
}

/**
 * Toggle an item in the selected IDs set
 */
export function toggleSelectedId(id: string): void {
  investigationSelection.update(s => {
    const next = new Set(s.selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return { ...s, selectedIds: next };
  });
}

/**
 * Set the active source filter (e.g. ['gdelt', 'radio', 'social'])
 */
export function setSourceFilter(sources: string[]): void {
  investigationSelection.update(s => ({
    ...s,
    sources: sources.length > 0 ? sources : null
  }));
}

/**
 * Set the active keyword filter
 */
export function setKeywords(keywords: string[]): void {
  investigationSelection.update(s => ({
    ...s,
    keywords: keywords.length > 0 ? keywords : null
  }));
}

/**
 * Reset all filters and selections to their defaults
 */
export function clearSelection(): void {
  investigationSelection.set({
    timeRange: null,
    sentiment: null,
    sources: null,
    selectedIds: new Set(),
    keywords: null,
    hoveredId: null
  });
}

/**
 * Derived store: count of currently active filters
 */
export const activeFilterCount = derived(investigationSelection, ($s) => {
  let count = 0;
  if ($s.timeRange) count++;
  if ($s.sentiment && $s.sentiment.length > 0) count++;
  if ($s.sources && $s.sources.length > 0) count++;
  if ($s.selectedIds.size > 0) count++;
  if ($s.keywords && $s.keywords.length > 0) count++;
  return count;
});

// ---- Portal Preferences (localStorage persisted) ----

const PORTAL_VIEWS_KEY = 'investigation-portal-views';
const PORTAL_LAYOUT_KEY = 'investigation-portal-layout';

function loadJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveJson(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getPortalView(portalId: string, defaultView: string): string {
  const views = loadJson<Record<string, string>>(PORTAL_VIEWS_KEY, {});
  return views[portalId] || defaultView;
}

export function setPortalView(portalId: string, viewId: string): void {
  const views = loadJson<Record<string, string>>(PORTAL_VIEWS_KEY, {});
  views[portalId] = viewId;
  saveJson(PORTAL_VIEWS_KEY, views);
}

const DEFAULT_PORTALS = ['sentiment', 'volume', 'correlation', 'topics'];

export function getPortalLayout(): { visible: string[]; order: string[] } {
  return loadJson(PORTAL_LAYOUT_KEY, { visible: DEFAULT_PORTALS, order: DEFAULT_PORTALS });
}

export function setPortalLayout(layout: { visible: string[]; order: string[] }): void {
  saveJson(PORTAL_LAYOUT_KEY, layout);
}
