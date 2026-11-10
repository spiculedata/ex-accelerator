import { describe, expect, it } from 'vitest';
import { insightText, needsFirstRun, sourceNames } from './homeProject';

const project = (over: Record<string, unknown> = {}) => ({
  anomaly: null,
  sentiment_trend: 'neutral',
  sparkline: [1, 2, 3],
  event_count: 10,
  workspace_count: 1,
  sources: { gdelt: false, radio: false, social: true },
  ...over
});

describe('insightText', () => {
  it('reports an anomaly or a sentiment trend first', () => {
    expect(insightText(project({ anomaly: { type: 'volume_spike' } }) as any)).toBe('Volume spike detected');
    expect(insightText(project({ sentiment_trend: 'negative' }) as any)).toBe('Sentiment trending negative');
  });

  it('says steady only when there is data showing it', () => {
    expect(insightText(project() as any)).toBe('Steady, no significant changes');
  });

  it('says there is no trend yet, instead of steady, when there is nothing to base one on', () => {
    expect(insightText(project({ sparkline: [], event_count: 0 }) as any)).toBe('No data yet, so no trend to show');
  });
});

describe('sourceNames', () => {
  it('names the sources that have data, in words', () => {
    expect(sourceNames({ gdelt: true, radio: false, social: true })).toEqual(['GDELT', 'Social']);
    expect(sourceNames({ gdelt: false, radio: false, social: false })).toEqual([]);
  });
});

describe('needsFirstRun', () => {
  it('is true with no projects, or when no project has a workspace yet', () => {
    expect(needsFirstRun([])).toBe(true);
    expect(needsFirstRun([project({ workspace_count: 0 }) as any])).toBe(true);
  });

  it('is false once any project has a workspace', () => {
    expect(needsFirstRun([project({ workspace_count: 0 }) as any, project() as any])).toBe(false);
  });
});
