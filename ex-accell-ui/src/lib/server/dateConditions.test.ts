import { describe, expect, it } from 'vitest';
import { engagementQueries } from './engagementQueries';
import { languageQueries } from './languageQueries';
import { trigramPostsQuery } from './trigramQueries';

const range = ['p.created_at >= $2', 'p.created_at <= $3'];

describe('date range conditions', () => {
  it('restrict every engagement query alongside the platform filter', () => {
    for (const sql of [
      engagementQueries.stats(true, range),
      engagementQueries.platforms(true, range),
      engagementQueries.contentTypes(true, range),
      engagementQueries.timing(true, range),
      engagementQueries.topPosts(true, '$4', range),
      engagementQueries.trends(true, 7, range)
    ]) {
      expect(sql).toContain('ds.platform = ANY($1) AND p.created_at >= $2 AND p.created_at <= $3');
    }
  });

  it('replace the relative window of the engagement trends and of trigrams', () => {
    expect(engagementQueries.trends(false, 7, range)).not.toContain('INTERVAL');
    expect(engagementQueries.trends(false, 7)).toContain("INTERVAL '7 days'");
    const trigrams = trigramPostsQuery({ workspacePlatforms: false, platform: true }, 7, ['p.created_at >= $2']);
    expect(trigrams).toContain('AND p.created_at >= $2');
    expect(trigrams).not.toContain('INTERVAL');
    expect(trigramPostsQuery({ workspacePlatforms: false, platform: false }, 7)).toContain("INTERVAL '7 days'");
  });

  it('join the post date for language stats and mixing, and leave them untouched without a range', () => {
    expect(languageQueries.stats(['p.created_at >= $1'])).toContain('JOIN posts p ON p.id = ld.post_id WHERE p.created_at >= $1');
    expect(languageQueries.mixing(['p.created_at >= $1'])).toContain('JOIN posts p ON p.id = lm.post_id WHERE p.created_at >= $1');
    expect(languageQueries.stats()).not.toContain('JOIN posts');
    expect(languageQueries.mixing()).not.toContain('JOIN posts');
  });
});
