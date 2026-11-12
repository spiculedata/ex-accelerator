import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  investigationSelection,
  activeFilterCount,
  setTimeRange,
  setSentimentFilter,
  setSourceFilter,
  setKeywords,
  setHoveredId,
  toggleSelectedId,
  setCrossFilter,
  clearCrossFilter,
  clearSelection,
  getPortalView,
  setPortalView,
  getPortalLayout,
  setPortalLayout,
  getPortalGrid,
  setPortalGrid,
  resetPortalGrid
} from './investigationStore';

beforeEach(() => {
  clearSelection();
  localStorage.clear();
});

describe('investigationStore selection', () => {
  it('sets a time range and hovered id', () => {
    setTimeRange('2024-01-01', '2024-01-31');
    setHoveredId('a');
    const s = get(investigationSelection);
    expect(s.timeRange).toEqual({ start: '2024-01-01', end: '2024-01-31' });
    expect(s.hoveredId).toBe('a');
  });

  it('stores non-empty list filters and nulls empty ones', () => {
    setSentimentFilter(['positive']);
    setSourceFilter(['gdelt']);
    setKeywords(['war']);
    expect(get(investigationSelection)).toMatchObject({ sentiment: ['positive'], sources: ['gdelt'], keywords: ['war'] });
    setSentimentFilter([]);
    setSourceFilter([]);
    setKeywords([]);
    expect(get(investigationSelection)).toMatchObject({ sentiment: null, sources: null, keywords: null });
  });

  it('toggles selected ids without mutating the previous set', () => {
    toggleSelectedId('x');
    const before = get(investigationSelection).selectedIds;
    toggleSelectedId('y');
    expect(before.has('y')).toBe(false);
    expect([...get(investigationSelection).selectedIds]).toEqual(['x', 'y']);
    toggleSelectedId('x');
    expect([...get(investigationSelection).selectedIds]).toEqual(['y']);
  });

  it('toggles a cross-filter off when the same dimension and value is set again', () => {
    setCrossFilter({ dimension: 'actor', value: 'A' });
    expect(get(investigationSelection).crossFilter).toEqual({ dimension: 'actor', value: 'A' });
    setCrossFilter({ dimension: 'actor', value: 'B' });
    expect(get(investigationSelection).crossFilter?.value).toBe('B');
    setCrossFilter({ dimension: 'actor', value: 'B' });
    expect(get(investigationSelection).crossFilter).toBeNull();
    setCrossFilter({ dimension: 'location', value: 'B' });
    clearCrossFilter();
    expect(get(investigationSelection).crossFilter).toBeNull();
  });

  it('counts active filters and resets on clearSelection', () => {
    expect(get(activeFilterCount)).toBe(0);
    setTimeRange('a', 'b');
    setSentimentFilter(['negative']);
    setSourceFilter(['radio']);
    toggleSelectedId('1');
    setKeywords(['k']);
    setCrossFilter({ dimension: 'date', value: '2024-01-01' });
    expect(get(activeFilterCount)).toBe(6);
    clearSelection();
    expect(get(activeFilterCount)).toBe(0);
  });
});

describe('investigationStore portal preferences', () => {
  it('returns the default view until one is saved, per portal', () => {
    expect(getPortalView('sentiment', 'chart')).toBe('chart');
    setPortalView('sentiment', 'table');
    setPortalView('volume', 'bar');
    expect(getPortalView('sentiment', 'chart')).toBe('table');
    expect(getPortalView('volume', 'chart')).toBe('bar');
  });

  it('falls back to defaults when stored JSON is corrupt', () => {
    localStorage.setItem('investigation-portal-views', '{not json');
    expect(getPortalView('sentiment', 'chart')).toBe('chart');
  });

  it('round-trips layout and grid, and resets the grid to the default', () => {
    expect(getPortalLayout().visible).toContain('sentiment');
    setPortalLayout({ visible: ['actors'], order: ['actors'] });
    expect(getPortalLayout()).toEqual({ visible: ['actors'], order: ['actors'] });

    const defaults = getPortalGrid();
    expect(defaults).toHaveLength(6);
    setPortalGrid([{ id: 'actors', x: 1, y: 2, w: 3, h: 4 }]);
    expect(getPortalGrid()).toEqual([{ id: 'actors', x: 1, y: 2, w: 3, h: 4 }]);
    resetPortalGrid();
    expect(getPortalGrid()).toEqual(defaults);
  });
});
