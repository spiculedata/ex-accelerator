import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildMentionsCsv,
  downloadCsv,
  filterAndSortMentions,
  getMentionTypeLabel,
  getToneDescription,
  mentionsCsvFilename,
  paginate,
  type MentionsView
} from './gdeltMentions';

const view = (over: Partial<MentionsView> = {}): MentionsView => ({ searchTerm: '', typeFilter: '', sortField: 'mentionTimeDate', sortDirection: 'desc', ...over });
const mention = (over: Record<string, unknown> = {}) => ({ mentionSourceName: 'bbc.com', mentionIdentifier: 'https://bbc.com/a', mentionType: 1, mentionTimeDate: 20260101, ...over });

describe('labels', () => {
  it('names the three mention types and falls back for others', () => {
    expect(getMentionTypeLabel(1)).toBe('Web News');
    expect(getMentionTypeLabel(2)).toBe('Print News');
    expect(getMentionTypeLabel(3)).toBe('Broadcast News');
    expect(getMentionTypeLabel(9)).toBe('Type 9');
  });

  it.each([
    [5, 'Very Positive'],
    [2, 'Positive'],
    [0.5, 'Slightly Positive'],
    [0, 'Neutral'],
    [-0.5, 'Slightly Negative'],
    [-2, 'Negative'],
    [-5, 'Very Negative']
  ])('describes a tone of %s as %s', (score, label) => {
    expect(getToneDescription(score)).toBe(label);
  });
});

describe('filterAndSortMentions', () => {
  const mentions = [
    mention({ mentionSourceName: 'Bbc.com', mentionTimeDate: 3, mentionType: 1 }),
    mention({ mentionSourceName: 'cnn.com', mentionIdentifier: 'https://x.com/bbc-story', mentionTimeDate: 1, mentionType: 2 }),
    mention({ mentionSourceName: null, mentionIdentifier: null, mentionTimeDate: 2, mentionType: 3 })
  ];

  it('sorts newest first by default and does not change the input', () => {
    const before = [...mentions];
    expect(filterAndSortMentions(mentions, view()).map((m) => m.mentionTimeDate)).toEqual([3, 2, 1]);
    expect(mentions).toEqual(before);
  });

  it('searches the source name and the identifier without regard to case', () => {
    expect(filterAndSortMentions(mentions, view({ searchTerm: 'BBC' })).map((m) => m.mentionTimeDate)).toEqual([3, 1]);
  });

  it('filters by mention type', () => {
    expect(filterAndSortMentions(mentions, view({ typeFilter: '2' }))).toHaveLength(1);
    expect(filterAndSortMentions(mentions, view({ typeFilter: '7' }))).toHaveLength(0);
  });

  it('sorts text without regard to case and puts missing values first when ascending, last when descending', () => {
    const asc = filterAndSortMentions(mentions, view({ sortField: 'mentionSourceName', sortDirection: 'asc' }));
    expect(asc.map((m) => m.mentionSourceName)).toEqual([null, 'Bbc.com', 'cnn.com']);
    const desc = filterAndSortMentions(mentions, view({ sortField: 'mentionSourceName', sortDirection: 'desc' }));
    expect(desc.map((m) => m.mentionSourceName)).toEqual(['cnn.com', 'Bbc.com', null]);
  });
});

describe('paginate', () => {
  it('returns the page asked for', () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginate(items, 1, 2)).toEqual([1, 2]);
    expect(paginate(items, 3, 2)).toEqual([5]);
    expect(paginate(items, 4, 2)).toEqual([]);
  });
});

describe('CSV export', () => {
  it('writes a header and one row per mention, quoting fields that need it', () => {
    const csv = buildMentionsCsv([
      { globalEventId: 7, mentionSourceName: 'a, b', mentionType: 1, mentionTimeDate: 20260101, confidence: 80, mentionDocTone: -1.5, mentionDocLen: 100, mentionIdentifier: 'say "hi"', eventTimeDate: 20260101 }
    ]);
    const [header, row] = csv.split('\n');
    expect(header.startsWith('Event ID,Source Name,Type,Mention Date')).toBe(true);
    expect(row).toBe('7,"a, b",Web News,2026-01-01,80,-1.5,100,"say ""hi""",2026-01-01,,,');
  });

  it('writes empty cells for missing values and falls back to the type number', () => {
    const [, row] = buildMentionsCsv([{ mentionType: 9 }]).split('\n');
    expect(row).toBe(',,Type 9,,,,,,,,,');
  });

  it('names the file after the event or the filtered events', () => {
    const now = new Date('2026-01-05T09:30:15.123Z');
    expect(mentionsCsvFilename(42, now)).toBe('gdelt-mentions-event-42-2026-01-05T09-30-15.csv');
    expect(mentionsCsvFilename(null, now)).toBe('gdelt-mentions-filtered-events-2026-01-05T09-30-15.csv');
  });
});

describe('downloadCsv', () => {
  afterEach(() => vi.restoreAllMocks());

  it('clicks a hidden link and then cleans it up', () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('a,b', 'file.csv');

    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download="file.csv"]')).toBeNull();
  });
});
