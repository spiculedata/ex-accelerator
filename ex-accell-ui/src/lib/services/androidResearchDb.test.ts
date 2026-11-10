import { beforeEach, describe, expect, it, vi } from 'vitest';
import { androidResearchDb } from './androidResearchDb';
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

const service = androidResearchDb as unknown as Record<string, unknown> & { initialized: boolean };

beforeEach(() => {
  service.initialized = true;
});

describe('androidResearchDb', () => {
  describe('when no Android data is loaded', () => {
    beforeEach(() => mockFetch({}));

    it('returns empty collections flagged as having no data', async () => {
      expect(await androidResearchDb.getAttentionSpans()).toEqual({ data: [], hasData: false });
      expect(await androidResearchDb.getContentEngagement()).toEqual({ data: [], hasData: false });
      expect(await androidResearchDb.getCognitiveLoadData()).toEqual({ data: [], hasData: false });
      expect(await androidResearchDb.getResearchFindings()).toEqual({ data: [], hasData: false });
      expect(await androidResearchDb.getNetworkCentrality()).toEqual({ data: [], hasData: false });
      expect(await androidResearchDb.getTransitionFlow()).toEqual({ data: [], hasData: false });
    });

    it('returns no phenotype rather than a made-up "Moderate User"', async () => {
      expect(await androidResearchDb.getDigitalPhenotype()).toEqual({ data: null, hasData: false });
    });
  });

  describe('when a request fails', () => {
    beforeEach(() => vi.stubGlobal('fetch', createFetchError(500, 'Internal Server Error')));

    it('throws instead of returning example figures', async () => {
      await expect(androidResearchDb.getAttentionSpans()).rejects.toThrow(/500/);
      await expect(androidResearchDb.getContentEngagement()).rejects.toThrow(/500/);
      await expect(androidResearchDb.getCognitiveLoadData()).rejects.toThrow(/500/);
      await expect(androidResearchDb.getDigitalPhenotype()).rejects.toThrow(/500/);
      await expect(androidResearchDb.getResearchFindings()).rejects.toThrow(/500/);
      await expect(androidResearchDb.getNetworkCentrality()).rejects.toThrow(/500/);
      await expect(androidResearchDb.getTransitionFlow()).rejects.toThrow(/500/);
    });
  });

  describe('with real rows', () => {
    it('groups attention spans by app and averages their durations', async () => {
      mockFetch({
        'attention-spans': [
          { app_name: 'YouTube', attention_duration_ms: 120000, attention_start_ts: 1744765042854, task_switches: 1, interruption_count: 0 },
          { app_name: 'YouTube', attention_duration_ms: 60000, attention_start_ts: 1744765242854 },
          { apk: 'com.android.chrome', attention_duration_ms: 30000, attention_start_ts: 1744765342854 }
        ]
      });

      const result = await androidResearchDb.getAttentionSpans();

      expect(result.hasData).toBe(true);
      expect(result.data).toEqual([
        {
          app: 'YouTube',
          meanDuration: 90,
          sessions: [
            { duration: 120, timestamp: 1744765042854, taskSwitches: 1, interruptions: 0 },
            { duration: 60, timestamp: 1744765242854, taskSwitches: 0, interruptions: 0 }
          ]
        },
        { app: 'com.android.chrome', meanDuration: 30, sessions: [{ duration: 30, timestamp: 1744765342854, taskSwitches: 0, interruptions: 0 }] }
      ]);
    });

    it('maps content engagement rows, keeping return visits as a count', async () => {
      mockFetch({ 'content-engagement': [{ content_category: 'Video', engagement_score: 80, avg_duration_minutes: 2, avg_interaction_depth: 4, avg_return_visits: 3.5 }] });

      expect(await androidResearchDb.getContentEngagement()).toEqual({
        data: [{ content: 'Video', engagementScore: 80, avgDuration: 120, interactionDepth: 4, returnVisits: 3.5 }],
        hasData: true
      });
    });

    it('averages cognitive load per hour and leaves hours without rows at zero', async () => {
      mockFetch({
        'cognitive-load': [
          { analysis_hour: 9, task_switching_rate: 10, multitasking_index: 2, attention_fragmentation: 40, cognitive_efficiency: 80 },
          { analysis_hour: 9, task_switching_rate: 20, multitasking_index: 4, attention_fragmentation: 60, cognitive_efficiency: 60 }
        ]
      });

      const result = await androidResearchDb.getCognitiveLoadData();

      expect(result.hasData).toBe(true);
      expect(result.data).toHaveLength(24);
      expect(result.data[9]).toEqual({ hour: 9, taskSwitches: 15, multitaskingIndex: 3, attentionFragmentation: 50, cognitiveEfficiency: 70 });
      expect(result.data[3]).toEqual({ hour: 3, taskSwitches: 0, multitaskingIndex: 0, attentionFragmentation: 0, cognitiveEfficiency: 0 });
    });

    it('maps the phenotype row', async () => {
      mockFetch({ 'digital-phenotype': [{ usage_behavior_type: 'Heavy User', attention_profile: 'Fragmented', usage_pattern: 'Morning-Peak', multitasking_profile: 'High' }] });

      expect(await androidResearchDb.getDigitalPhenotype()).toEqual({
        data: { behaviorType: 'Heavy User', attentionProfile: 'Fragmented', usagePattern: 'Morning-Peak', multitaskingIndex: 'High' },
        hasData: true
      });
    });

    it('maps research findings', async () => {
      mockFetch({ 'research-findings': [{ finding_title: 'Peak', finding_description: 'Most use at 21:00', research_implications: 'Evening attention', behavioral_recommendations: 'Schedule prompts then' }] });

      expect(await androidResearchDb.getResearchFindings()).toEqual({
        data: [{ title: 'Peak', finding: 'Most use at 21:00', significance: 'Evening attention', implication: 'Schedule prompts then' }],
        hasData: true
      });
    });

    it('sorts network centrality by score', async () => {
      mockFetch({
        'network-centrality': [
          { app_name: 'Chrome', out_degree: 1, in_degree: 2, total_degree: 3, app_category: 'Productivity' },
          { app_name: 'YouTube', out_degree: 5, in_degree: 4, total_degree: 9 }
        ]
      });

      expect(await androidResearchDb.getNetworkCentrality()).toEqual({
        data: [
          { app: 'YouTube', outDegree: 5, inDegree: 4, centralityScore: 9, category: 'Other' },
          { app: 'Chrome', outDegree: 1, inDegree: 2, centralityScore: 3, category: 'Productivity' }
        ],
        hasData: true
      });
    });

    it('maps transition flow rows and drops rows without a count rather than inventing one', async () => {
      mockFetch({
        'transition-flow': [
          { from_app_name: 'Launcher', to_app_name: 'YouTube', transition_count: 7 },
          { from_app_name: 'YouTube', to_app_name: 'Chrome' },
          { from_app_name: 'Chrome', to_app_name: 'Gmail', transition_count: 0 }
        ]
      });

      expect(await androidResearchDb.getTransitionFlow()).toEqual({ data: [{ source: 'Launcher', target: 'YouTube', value: 7 }], hasData: true });
    });
  });

  it('surfaces a malformed response as an error, not as an empty module', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => { throw new SyntaxError('Unexpected token <'); } })));

    await expect(androidResearchDb.getAttentionSpans()).rejects.toThrow(/Unexpected token/);
  });

  it('has no fallback figures and no Android metrics derived from social data', () => {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(androidResearchDb));

    expect(methods.filter((name) => name.startsWith('getFallback'))).toEqual([]);
    for (const name of ['getTemporalUsagePatterns', 'getAppTransitions', 'getBehavioralMetrics', 'calculateBehavioralMetrics']) {
      expect(service[name], name).toBeUndefined();
    }
  });
});
