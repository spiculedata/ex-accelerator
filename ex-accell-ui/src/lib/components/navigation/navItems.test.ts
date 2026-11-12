import { describe, expect, it } from 'vitest';
import {
  dataFlagsFromSummary,
  formatRecordCount,
  getDataAvailabilityIcon,
  getDataAvailabilityTooltip,
  getDatasetTypeBadges,
  hasRequiredData,
  navigationItems,
  navigationUrl,
  type DataFlags,
  type DropdownItem
} from './navItems';

const workspace = { id: 7, name: 'Ws' };
const noData: DataFlags = { gdelt: false, android: false, social: false };
const allData: DataFlags = { gdelt: true, android: true, social: true };
const item = (extra: Partial<DropdownItem> = {}): DropdownItem => ({ name: 'Thing', href: '/thing', requiresProject: false, ...extra });

describe('navigationItems', () => {
  it('has unique top-level names and every dropdown item has a path', () => {
    const names = navigationItems.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    for (const entry of navigationItems.filter((i) => i.hasDropdown)) {
      expect(entry.dropdownItems?.length).toBeGreaterThan(0);
      for (const child of entry.dropdownItems ?? []) expect(child.href.startsWith('/')).toBe(true);
    }
  });
});

describe('dataFlagsFromSummary', () => {
  it('reports no data for a missing summary', () => {
    expect(dataFlagsFromSummary(null)).toEqual(noData);
    expect(dataFlagsFromSummary(undefined)).toEqual(noData);
  });

  it('reads gdelt and android from types and social from platforms', () => {
    expect(dataFlagsFromSummary({ types: ['gdelt_events', 'android'], platforms: ['reddit'], recordCount: 0, datasetCount: 0 })).toEqual(allData);
    expect(dataFlagsFromSummary({ types: [], platforms: ['unknown'], recordCount: 0, datasetCount: 0 })).toEqual(noData);
  });
});

describe('hasRequiredData', () => {
  it('is true when nothing is required, no workspace is chosen, or the type is unknown', () => {
    expect(hasRequiredData(item(), workspace, noData)).toBe(true);
    expect(hasRequiredData(item({ requiresDataType: 'gdelt' }), null, noData)).toBe(true);
    expect(hasRequiredData(item({ requiresDataType: 'other' }), workspace, noData)).toBe(true);
  });

  it.each(['gdelt', 'android', 'social'])('follows the %s flag', (type) => {
    expect(hasRequiredData(item({ requiresDataType: type }), workspace, noData)).toBe(false);
    expect(hasRequiredData(item({ requiresDataType: type }), workspace, allData)).toBe(true);
  });
});

describe('data availability hints', () => {
  it('shows nothing without a requirement or workspace', () => {
    expect(getDataAvailabilityIcon(item(), workspace, noData)).toBe('');
    expect(getDataAvailabilityTooltip(item({ requiresDataType: 'gdelt' }), null, noData)).toBe('');
  });

  it('shows a tick and tooltip when the data is there, a warning when not', () => {
    const gdelt = item({ name: 'GDELT Page', requiresDataType: 'gdelt' });
    expect(getDataAvailabilityIcon(gdelt, workspace, allData)).toBe('✓');
    expect(getDataAvailabilityTooltip(gdelt, workspace, allData)).toBe('GDELT Page data available');
    expect(getDataAvailabilityIcon(gdelt, workspace, noData)).toBe('⚠');
    expect(getDataAvailabilityTooltip(gdelt, workspace, noData)).toBe('No GDELT datasets in this workspace');
    expect(getDataAvailabilityTooltip(item({ requiresDataType: 'android' }), workspace, noData)).toBe('No Android datasets in this workspace');
    expect(getDataAvailabilityTooltip(item({ requiresDataType: 'social' }), workspace, noData)).toBe('No Social Media datasets in this workspace');
  });
});

describe('navigationUrl', () => {
  it('returns the plain href by default', () => {
    expect(navigationUrl(item(), workspace, noData)).toBe('/thing');
  });

  it('adds the workspace as a query parameter for workspace-aware items, but only with a workspace', () => {
    expect(navigationUrl(item({ useWorkspace: true }), workspace, noData)).toBe('/thing?workspace=7');
    expect(navigationUrl(item({ useWorkspace: true }), null, noData)).toBe('/thing');
  });

  it('opens the workspace page directly for the workspaces overview', () => {
    expect(navigationUrl(item({ href: '/workspaces', useWorkspace: true }), workspace, noData)).toBe('/workspaces/7');
  });

  it('stays put when a required workspace or data type is missing', () => {
    expect(navigationUrl(item({ requiresWorkspace: true }), null, noData)).toBeNull();
    expect(navigationUrl(item({ requiresDataType: 'gdelt' }), workspace, noData)).toBeNull();
    expect(navigationUrl(item({ requiresDataType: 'gdelt' }), workspace, allData)).toBe('/thing');
  });
});

describe('getDatasetTypeBadges', () => {
  it('returns no badges without types', () => {
    expect(getDatasetTypeBadges(null)).toEqual([]);
    expect(getDatasetTypeBadges({ types: [], recordCount: 0, datasetCount: 0 })).toEqual([]);
  });

  it('labels known types, keeps unknown ones as they are and shows at most three', () => {
    const badges = getDatasetTypeBadges({ types: ['social_media', 'gdelt_events', 'custom', 'android'], recordCount: 1, datasetCount: 1 });
    expect(badges.map((b) => b.label)).toEqual(['Social', 'GDELT', 'custom']);
    for (const badge of badges) expect(typeof badge.color).toBe('string');
  });
});

describe('formatRecordCount', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1.0K'],
    [12500, '12.5K'],
    [1000000, '1.0M'],
    [2500000, '2.5M']
  ])('formats %d as %s', (count, text) => {
    expect(formatRecordCount(count)).toBe(text);
  });
});
