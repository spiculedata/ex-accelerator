import { describe, it, expect } from 'vitest';
import { socialPostRecord, toCsv } from './evidenceExport';

const post = { id: 193, text: 'Another morning of tram delays', timestamp: '1794066618733', platform: 'telegram', author: 'demo_user_0036', sentiment_category: 'Negative', confidence_score: 0.865, emotions: 'Sadness', engagement_likes: 739, engagement_shares: 106, engagement_comments: 158 };

describe('socialPostRecord', () => {
  it('turns an epoch-millisecond timestamp into ISO 8601 UTC', () => {
    expect(socialPostRecord(post).posted_at).toBe('2026-11-07T15:50:18.733Z');
  });

  it('gives a citation with the platform, id, author and time, since posts carry no permalink', () => {
    expect(socialPostRecord(post).citation).toBe('telegram post #193 by demo_user_0036, 2026-11-07T15:50:18.733Z');
  });

  it('copes with a missing author and a missing or bad timestamp', () => {
    const record = socialPostRecord({ ...post, author: null, timestamp: 'nope' });

    expect(record.citation).toBe('telegram post #193');
    expect(record.posted_at).toBe('');
  });

  it('keeps the evidence fields', () => {
    expect(socialPostRecord(post)).toMatchObject({ id: 193, platform: 'telegram', author: 'demo_user_0036', text: 'Another morning of tram delays', sentiment: 'Negative', confidence: 0.865, likes: 739, shares: 106, comments: 158 });
  });
});

describe('toCsv', () => {
  const columns = ['id', 'text'] as const;

  it('writes a header row and quotes commas, quotes and line breaks', () => {
    const csv = toCsv([{ id: 1, text: 'a, "b"\nc' }], columns);

    expect(csv).toBe('id,text\r\n1,"a, ""b""\nc"\r\n');
  });

  it('neutralises spreadsheet formulas so exported text cannot run in Excel', () => {
    const csv = toCsv([{ id: 1, text: '=HYPERLINK("http://x")' }, { id: 2, text: '+1' }, { id: 3, text: '@cmd' }, { id: 4, text: '-2+3' }], columns);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain(",'+1");
    expect(csv).toContain(",'@cmd");
    expect(csv).toContain(",'-2+3");
  });

  it('writes an empty cell for null and undefined', () => {
    expect(toCsv([{ id: 1, text: null }], columns)).toBe('id,text\r\n1,\r\n');
  });
});
