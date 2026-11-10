import { describe, expect, it } from 'vitest';
import { acyclicTransitions, behaviouralMetrics, hasAndroidData, temporalUsageFromSessions } from './androidData';
import type { AttentionSpan } from '$lib/services/types/androidResearchTypes';

const atUtcHour = (hour: number) => Date.UTC(2026, 3, 14, hour);

const span = (app: string, sessions: Array<[hour: number, durationSeconds: number]>): AttentionSpan => ({
  app,
  meanDuration: sessions.reduce((sum, [, duration]) => sum + duration, 0) / Math.max(sessions.length, 1),
  sessions: sessions.map(([hour, duration]) => ({ duration, timestamp: atUtcHour(hour), taskSwitches: 0, interruptions: 0 }))
});

describe('hasAndroidData', () => {
  it('is false when nothing is loaded', () => {
    expect(hasAndroidData([{ hasData: false }, [], { hasData: false, data: [] }])).toBe(false);
    expect(hasAndroidData([])).toBe(false);
  });

  it('is true as soon as any part has rows', () => {
    expect(hasAndroidData([{ hasData: false }, [{ apk: 'com.android.chrome' }]])).toBe(true);
    expect(hasAndroidData([{ hasData: true }, []])).toBe(true);
  });
});

describe('temporalUsageFromSessions', () => {
  it('is empty when there are no sessions, so nothing is drawn', () => {
    expect(temporalUsageFromSessions([])).toEqual([]);
    expect(temporalUsageFromSessions([span('YouTube', [])])).toEqual([]);
  });

  it("buckets each app's sessions by UTC hour, with usage in minutes", () => {
    const patterns = temporalUsageFromSessions([span('YouTube', [[9, 120], [9, 60], [21, 300]]), span('Chrome', [[9, 30]])]);

    expect(patterns).toHaveLength(24);
    expect(patterns[9]).toEqual({
      hour: 9,
      apps: [
        { app: 'YouTube', hour: 9, usage: 3, sessions: 2, avgDuration: 90 },
        { app: 'Chrome', hour: 9, usage: 0.5, sessions: 1, avgDuration: 30 }
      ],
      totalUsage: 3.5
    });
    expect(patterns[21].apps.find((entry) => entry.app === 'YouTube')).toMatchObject({ usage: 5, sessions: 1, avgDuration: 300 });
    expect(patterns[3].totalUsage).toBe(0);
    expect(patterns[3].apps.every((entry) => entry.usage === 0 && entry.sessions === 0)).toBe(true);
  });

  it('ignores sessions without a timestamp instead of placing them at midnight', () => {
    const spans: AttentionSpan[] = [{ app: 'Gmail', meanDuration: 60, sessions: [{ duration: 60, timestamp: 0, taskSwitches: 0, interruptions: 0 }] }];

    expect(temporalUsageFromSessions(spans)).toEqual([]);
  });
});

describe('behaviouralMetrics', () => {
  it('is null when there are no sessions', () => {
    expect(behaviouralMetrics([], [], [])).toBeNull();
  });

  it('summarises one recorded day of sessions and transitions', () => {
    const spans = [span('YouTube', [[9, 120], [21, 300]]), span('Chrome', [[9, 60]])];
    const transitions = [
      { source: 'YouTube', target: 'Chrome', value: 12 },
      { source: 'Chrome', target: 'YouTube', value: 12 }
    ];

    expect(behaviouralMetrics(temporalUsageFromSessions(spans), spans, transitions)).toEqual({
      daysRecorded: 1,
      totalDailyUsage: 8,
      peakUsageHour: 21,
      avgSessionLength: 160,
      appSwitchingRate: 1
    });
  });

  it('divides usage and transitions by the number of UTC days recorded', () => {
    const dayTwo = Date.UTC(2026, 3, 15, 9);
    const spans: AttentionSpan[] = [
      {
        app: 'YouTube',
        meanDuration: 240,
        sessions: [
          { duration: 120, timestamp: atUtcHour(9), taskSwitches: 0, interruptions: 0 },
          { duration: 360, timestamp: dayTwo, taskSwitches: 0, interruptions: 0 }
        ]
      }
    ];
    const transitions = [{ source: 'YouTube', target: 'Chrome', value: 96 }];

    expect(behaviouralMetrics(temporalUsageFromSessions(spans), spans, transitions)).toEqual({
      daysRecorded: 2,
      totalDailyUsage: 4,
      peakUsageHour: 9,
      avgSessionLength: 240,
      appSwitchingRate: 2
    });
  });

  it('treats sessions without timestamps as one unknown day and has no peak hour', () => {
    const spans: AttentionSpan[] = [
      {
        app: 'Gmail',
        meanDuration: 90,
        sessions: [
          { duration: 60, timestamp: 0, taskSwitches: 0, interruptions: 0 },
          { duration: 120, timestamp: 0, taskSwitches: 0, interruptions: 0 }
        ]
      }
    ];

    expect(behaviouralMetrics(temporalUsageFromSessions(spans), spans, [{ source: 'Gmail', target: 'Chrome', value: 48 }])).toEqual({
      daysRecorded: 1,
      totalDailyUsage: 3,
      peakUsageHour: null,
      avgSessionLength: 90,
      appSwitchingRate: 2
    });
  });
});

describe('acyclicTransitions', () => {
  it('keeps every link when there is no cycle, strongest first', () => {
    const links = [
      { source: 'Launcher', target: 'YouTube', value: 4 },
      { source: 'YouTube', target: 'Chrome', value: 9 }
    ];

    expect(acyclicTransitions(links)).toEqual([links[1], links[0]]);
  });

  it('drops self-loops and the weaker direction of a two-way pair', () => {
    const kept = acyclicTransitions([
      { source: 'A', target: 'A', value: 9 },
      { source: 'A', target: 'B', value: 3 },
      { source: 'B', target: 'A', value: 7 }
    ]);

    expect(kept).toEqual([{ source: 'B', target: 'A', value: 7 }]);
  });

  it('breaks a longer cycle by dropping its weakest link', () => {
    const kept = acyclicTransitions([
      { source: 'A', target: 'B', value: 5 },
      { source: 'B', target: 'C', value: 4 },
      { source: 'C', target: 'A', value: 1 }
    ]);

    expect(kept).toEqual([
      { source: 'A', target: 'B', value: 5 },
      { source: 'B', target: 'C', value: 4 }
    ]);
  });
});
