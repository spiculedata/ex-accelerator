import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { androidAnalyticsDb } from './androidAnalyticsDb';
import { createFetchError } from '../../test/mocks/fetchMock';

// Routes by the 'type' query parameter; an unknown type answers the way the real API does for an
// endpoint that is not implemented: a successful, empty response.
function mockFetch(routes: Record<string, unknown[]>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const type = new URL(url, 'http://localhost').searchParams.get('type') ?? '';
      const data = routes[type] ?? [];
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, data }) };
    })
  );
}

const requestUrl = (call = 0) => new URL((fetch as Mock).mock.calls[call][0] as string, 'http://localhost');

const zeroSummary = { totalSessions: 0, totalScreenshots: 0, uniqueApps: 0, sessionDuration: 0, totalEvents: 0, activeUsers: 0 };

beforeEach(() => {
  (androidAnalyticsDb as unknown as { initialized: boolean }).initialized = true;
});

describe('androidAnalyticsDb', () => {
  describe('when no Android data is loaded', () => {
    beforeEach(() => mockFetch({}));

    it('says the summary has no data and gives zero counts', async () => {
      expect(await androidAnalyticsDb.getAnalyticsSummary()).toEqual({ data: zeroSummary, hasData: false });
    });

    it('returns empty row lists', async () => {
      expect(await androidAnalyticsDb.getAccessibilityEvents()).toEqual([]);
      expect(await androidAnalyticsDb.getAppSegments()).toEqual([]);
      expect(await androidAnalyticsDb.getScreenshots()).toEqual([]);
    });
  });

  describe('when a request fails', () => {
    beforeEach(() => vi.stubGlobal('fetch', createFetchError(500, 'Internal Server Error')));

    it('throws instead of pretending the module is empty', async () => {
      await expect(androidAnalyticsDb.getAnalyticsSummary()).rejects.toThrow(/500/);
      await expect(androidAnalyticsDb.getAccessibilityEvents()).rejects.toThrow(/500/);
      await expect(androidAnalyticsDb.getAppSegments()).rejects.toThrow(/500/);
      await expect(androidAnalyticsDb.getScreenshots()).rejects.toThrow(/500/);
    });
  });

  describe('with real rows', () => {
    it('maps the stats row into the summary', async () => {
      mockFetch({ stats: [{ total_sessions: 3, total_screenshots: 40, unique_apps: 5, total_duration_minutes: 62, total_events: 120, active_users: 1 }] });

      expect(await androidAnalyticsDb.getAnalyticsSummary()).toEqual({
        data: { totalSessions: 3, totalScreenshots: 40, uniqueApps: 5, sessionDuration: 62, totalEvents: 120, activeUsers: 1 },
        hasData: true
      });
    });

    it('returns the rows unchanged and passes the limit', async () => {
      const segment = { apk: 'com.android.chrome', t_unix_ts_segment_start: 1744765042854, duration_segment_ms: 245000, id_session: 's1', id_user: 'u1' };
      mockFetch({ 'app-segments': [segment] });

      expect(await androidAnalyticsDb.getAppSegments(5)).toEqual([segment]);
      expect(requestUrl().searchParams.get('type')).toBe('app-segments');
      expect(requestUrl().searchParams.get('limit')).toBe('5');
    });
  });

  it('no longer invents Android figures from social platform statistics', () => {
    for (const name of ['getTopApps', 'getAppUsageTimeline', 'getScreenTextAnalysis', 'getUrlVisits']) {
      expect((androidAnalyticsDb as unknown as Record<string, unknown>)[name], name).toBeUndefined();
    }
  });
});
