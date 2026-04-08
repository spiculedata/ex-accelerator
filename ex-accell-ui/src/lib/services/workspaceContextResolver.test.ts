import { describe, it, expect } from 'vitest';
import {
  buildPlatformFilter,
  buildGdeltDateFilter,
  hasDataType,
  buildSocialFilters,
  type WorkspaceDataScope,
  type QueryFilters
} from './workspaceContextResolver';

// Helper to build a minimal WorkspaceDataScope
function makeScope(overrides: Partial<WorkspaceDataScope> = {}): WorkspaceDataScope {
  return {
    workspaceId: 1,
    workspaceName: 'Test Workspace',
    datasets: [],
    hasSocialMedia: false,
    hasGdeltEvents: false,
    hasGdeltGkg: false,
    socialPlatforms: [],
    datasetTypes: [],
    gdeltDateRange: null,
    ...overrides
  };
}

describe('workspaceContextResolver - pure filter builders', () => {
  describe('buildPlatformFilter', () => {
    it('returns null when scope is null', () => {
      expect(buildPlatformFilter(null, 1)).toBeNull();
    });

    it('returns null when scope has no social media', () => {
      const scope = makeScope({ hasSocialMedia: false, socialPlatforms: [] });
      expect(buildPlatformFilter(scope, 1)).toBeNull();
    });

    it('returns null when socialPlatforms is empty', () => {
      const scope = makeScope({ hasSocialMedia: true, socialPlatforms: [] });
      expect(buildPlatformFilter(scope, 1)).toBeNull();
    });

    it('builds filter for single platform', () => {
      const scope = makeScope({ hasSocialMedia: true, socialPlatforms: ['twitter'] });
      const result = buildPlatformFilter(scope, 1);

      expect(result).not.toBeNull();
      expect(result!.clause).toBe('LOWER(platform) IN ($1)');
      expect(result!.params).toEqual(['twitter']);
      expect(result!.nextIndex).toBe(2);
    });

    it('builds filter for multiple platforms', () => {
      const scope = makeScope({ hasSocialMedia: true, socialPlatforms: ['twitter', 'facebook', 'instagram'] });
      const result = buildPlatformFilter(scope, 3);

      expect(result!.clause).toBe('LOWER(platform) IN ($3, $4, $5)');
      expect(result!.params).toEqual(['twitter', 'facebook', 'instagram']);
      expect(result!.nextIndex).toBe(6);
    });

    it('respects paramIndex offset', () => {
      const scope = makeScope({ hasSocialMedia: true, socialPlatforms: ['reddit'] });
      const result = buildPlatformFilter(scope, 5);

      expect(result!.clause).toBe('LOWER(platform) IN ($5)');
      expect(result!.nextIndex).toBe(6);
    });
  });

  describe('buildGdeltDateFilter', () => {
    it('returns null when scope is null', () => {
      expect(buildGdeltDateFilter(null, 1)).toBeNull();
    });

    it('returns null when no gdeltDateRange', () => {
      const scope = makeScope({ gdeltDateRange: null });
      expect(buildGdeltDateFilter(scope, 1)).toBeNull();
    });

    it('builds BETWEEN filter with date range', () => {
      const scope = makeScope({ gdeltDateRange: { start: 20240101, end: 20240331 } });
      const result = buildGdeltDateFilter(scope, 1);

      expect(result).not.toBeNull();
      expect(result!.clause).toBe('sqldate BETWEEN $1 AND $2');
      expect(result!.params).toEqual([20240101, 20240331]);
      expect(result!.nextIndex).toBe(3);
    });

    it('respects paramIndex offset', () => {
      const scope = makeScope({ gdeltDateRange: { start: 20230601, end: 20230630 } });
      const result = buildGdeltDateFilter(scope, 4);

      expect(result!.clause).toBe('sqldate BETWEEN $4 AND $5');
      expect(result!.nextIndex).toBe(6);
    });
  });

  describe('hasDataType', () => {
    it('returns true when scope is null (global view)', () => {
      expect(hasDataType(null, 'social_media')).toBe(true);
      expect(hasDataType(null, 'gdelt_events')).toBe(true);
    });

    it('returns true when scope has the given data type', () => {
      const scope = makeScope({ datasetTypes: ['social_media', 'gdelt_events'] });
      expect(hasDataType(scope, 'social_media')).toBe(true);
    });

    it('returns false when scope does not have the given data type', () => {
      const scope = makeScope({ datasetTypes: ['social_media'] });
      expect(hasDataType(scope, 'gdelt_gkg')).toBe(false);
    });

    it('returns false for empty datasetTypes', () => {
      const scope = makeScope({ datasetTypes: [] });
      expect(hasDataType(scope, 'social_media')).toBe(false);
    });
  });

  describe('buildSocialFilters', () => {
    it('returns empty conditions when no filters apply', () => {
      const filters: QueryFilters = { scope: null, platforms: null, dateStart: null, dateEnd: null };
      const result = buildSocialFilters(filters, 1);

      expect(result.conditions).toEqual([]);
      expect(result.params).toEqual([]);
      expect(result.nextIndex).toBe(1);
    });

    it('uses explicit platforms over workspace scope', () => {
      const filters: QueryFilters = {
        scope: makeScope({ hasSocialMedia: true, socialPlatforms: ['twitter'] }),
        platforms: ['facebook', 'instagram'],
        dateStart: null,
        dateEnd: null
      };
      const result = buildSocialFilters(filters, 1);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('LOWER(');
      expect(result.params[0]).toEqual(['facebook', 'instagram']);
    });

    it('falls back to workspace scope platforms when no explicit platforms', () => {
      const filters: QueryFilters = {
        scope: makeScope({ hasSocialMedia: true, socialPlatforms: ['twitter', 'reddit'] }),
        platforms: null,
        dateStart: null,
        dateEnd: null
      };
      const result = buildSocialFilters(filters, 1);

      expect(result.conditions).toHaveLength(1);
      expect(result.params[0]).toEqual(['twitter', 'reddit']);
    });

    it('adds date start condition', () => {
      const filters: QueryFilters = {
        scope: null,
        platforms: null,
        dateStart: '2024-01-01',
        dateEnd: null
      };
      const result = buildSocialFilters(filters, 1);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('published_at >= $1');
      expect(result.params).toEqual(['2024-01-01']);
      expect(result.nextIndex).toBe(2);
    });

    it('adds date end condition', () => {
      const filters: QueryFilters = {
        scope: null,
        platforms: null,
        dateStart: null,
        dateEnd: '2024-12-31'
      };
      const result = buildSocialFilters(filters, 1);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('published_at <= $1');
      expect(result.params).toEqual(['2024-12-31']);
    });

    it('combines all filters with correct param indices', () => {
      const filters: QueryFilters = {
        scope: null,
        platforms: ['twitter'],
        dateStart: '2024-01-01',
        dateEnd: '2024-12-31'
      };
      const result = buildSocialFilters(filters, 1);

      expect(result.conditions).toHaveLength(3);
      expect(result.params).toEqual([['twitter'], '2024-01-01', '2024-12-31']);
      expect(result.nextIndex).toBe(4);
    });

    it('applies table alias prefix', () => {
      const filters: QueryFilters = {
        scope: null,
        platforms: ['twitter'],
        dateStart: '2024-01-01',
        dateEnd: null
      };
      const result = buildSocialFilters(filters, 1, 'p');

      expect(result.conditions[0]).toContain('p.platform');
      expect(result.conditions[1]).toContain('p.published_at');
    });

    it('lowercases explicit platform values', () => {
      const filters: QueryFilters = {
        scope: null,
        platforms: ['Twitter', 'FACEBOOK'],
        dateStart: null,
        dateEnd: null
      };
      const result = buildSocialFilters(filters, 1);
      expect(result.params[0]).toEqual(['twitter', 'facebook']);
    });
  });
});
