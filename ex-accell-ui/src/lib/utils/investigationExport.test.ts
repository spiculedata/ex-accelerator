import { describe, expect, it } from 'vitest';
import { buildInvestigationReport, buildPostsCsv, exportFileName, POST_CSV_COLUMNS } from './investigationExport';
import type { GdeltEvent, RadioSegment, WorkbenchPost } from './investigationTypes';

const NOW = new Date('2026-02-03T04:05:06.000Z');
const post = (id: string, text: string): WorkbenchPost => ({ id, text, platform: 'twitter', timestamp: 1767434400000 as unknown as string });
const gdelt = (id: number): GdeltEvent => ({ globaleventid: id, sqldate: '20260105', goldsteinscale: 0, avgtone: 0 });
const radio = (id: number): RadioSegment => ({ id, radio_name: 'R', segment_start: '', duration_seconds: 1, transcript: 't' });

describe('exportFileName', () => {
  it('joins the name with dashes and adds the day and extension', () => {
    expect(exportFileName('Border  Talks', 'csv', NOW)).toBe('investigation-Border-Talks-2026-02-03.csv');
  });

  it('falls back to "export" without a name', () => {
    expect(exportFileName(undefined, 'json', NOW)).toBe('investigation-export-2026-02-03.json');
  });
});

describe('buildInvestigationReport', () => {
  const input = {
    name: 'Border Talks',
    keywords: ['border'],
    dateStart: '2026-01-01',
    dateEnd: '2026-01-31',
    annotations: [{ id: 'a', text: 'note', timestamp: '' }],
    gdeltEvents: Array.from({ length: 60 }, (_, i) => gdelt(i)),
    radioSegments: Array.from({ length: 25 }, (_, i) => radio(i)),
    socialPosts: [post('p1', 'one'), post('p2', 'two')],
    timelineDays: 9,
    now: NOW
  };

  it('summarises the counts, samples GDELT and radio, and includes every post with a citation', () => {
    const report = buildInvestigationReport(input);

    expect(report.investigation).toEqual({ name: 'Border Talks', keywords: ['border'], dateStart: '2026-01-01', dateEnd: '2026-01-31' });
    expect(report.summary).toEqual({ gdelt_events: 60, radio_segments: 25, social_posts: 2, timeline_days: 9 });
    expect(report.gdelt_sample).toHaveLength(50);
    expect(report.radio_sample).toHaveLength(20);
    expect(report.social_posts.map((p) => p.citation)).toEqual(['twitter post #p1, 2026-01-03T10:00:00.000Z', 'twitter post #p2, 2026-01-03T10:00:00.000Z']);
    expect(report.note).toContain('holds the 2 posts loaded');
    expect(report.exported_at).toBe('2026-02-03T04:05:06.000Z');
    expect(report.annotations).toBe(input.annotations);
  });
});

describe('buildPostsCsv', () => {
  it('starts with a byte order mark and the header, then one row per post', () => {
    const lines = buildPostsCsv([post('p1', 'hello'), post('p2', '=SUM(A1)')]).replace('﻿', '').split(/\r?\n/);

    expect(buildPostsCsv([]).startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe(POST_CSV_COLUMNS.join(','));
    expect(lines[1]).toContain('hello');
    expect(lines[2]).toContain("'=SUM(A1)");
  });
});
