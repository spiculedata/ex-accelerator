import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import { queryErrorResponse } from '$lib/server/queryErrors';
import { hasNoSocialData } from '$lib/server/languageQueries';
import type { AnalyticsContext, AnalyticsHandler } from './types';

interface HashtagPostSource {
  from: string;
  idColumn: string;
  contentColumn: string;
  platformColumn: string;
}

/** Where hashtags are read from: the ETL silver.posts table when present, else the core posts table. */
async function hashtagPostSource(): Promise<HashtagPostSource> {
  const [row] = await executeQuery("SELECT to_regclass('silver.posts') IS NOT NULL AS present");
  if (row?.present === true) {
    return { from: 'FROM silver.posts', idColumn: 'post_id', contentColumn: 'content', platformColumn: 'media_type' };
  }
  return {
    from: 'FROM posts p JOIN data_sources ds ON ds.id = p.data_source_id',
    idColumn: 'p.id',
    contentColumn: 'p.content',
    platformColumn: 'ds.platform'
  };
}

async function hashtagAnalysis({ url, scope }: AnalyticsContext): Promise<Response> {
  if (hasNoSocialData(scope)) return json({ success: true, data: [] });
  try {
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50') || 50, 1), 500);

    // ETL installs keep posts in silver.posts; otherwise use the core posts table
    const source = await hashtagPostSource();

    // Only apply platform filter if workspace is specified
    let platformFilter = '';
    const filterParams: any[] = [];
    if (scope?.hasSocialMedia && scope.socialPlatforms.length > 0) {
      platformFilter = `AND ${source.platformColumn} = ANY($1)`;
      filterParams.push(scope.socialPlatforms);
    }
    const limitParam = `$${filterParams.length + 1}`;

    const data = await executeQuery(`
      WITH hashtag_extract AS (
        SELECT
          unnest(regexp_matches(${source.contentColumn}, '#([A-Za-z0-9_]+)', 'g')) as hashtag,
          ${source.idColumn} as post_id,
          ${source.platformColumn} as media_type
        ${source.from}
        WHERE ${source.contentColumn} IS NOT NULL
          AND ${source.contentColumn} LIKE '%#%'
          ${platformFilter}
      )
      SELECT
        lower(hashtag) as hashtag,
        COUNT(*) as count,
        COUNT(DISTINCT post_id) as post_count,
        array_agg(DISTINCT media_type) as platforms
      FROM hashtag_extract
      GROUP BY lower(hashtag)
      HAVING COUNT(*) >= 2
      ORDER BY count DESC
      LIMIT ${limitParam}
    `, [...filterParams, limit]);

    // Also get hashtag co-occurrence (top pairs)
    const cooccurrence = await executeQuery(`
      WITH hashtag_extract AS (
        SELECT
          ${source.idColumn} as post_id,
          unnest(regexp_matches(${source.contentColumn}, '#([A-Za-z0-9_]+)', 'g')) as hashtag
        ${source.from}
        WHERE ${source.contentColumn} IS NOT NULL AND ${source.contentColumn} LIKE '%#%'
        ${platformFilter}
      ),
      pairs AS (
        SELECT a.hashtag as h1, b.hashtag as h2
        FROM hashtag_extract a
        JOIN hashtag_extract b ON a.post_id = b.post_id AND lower(a.hashtag) < lower(b.hashtag)
      )
      SELECT lower(h1) as hashtag1, lower(h2) as hashtag2, COUNT(*) as co_count
      FROM pairs
      GROUP BY lower(h1), lower(h2)
      HAVING COUNT(*) >= 2
      ORDER BY co_count DESC
      LIMIT 20
    `, filterParams);

    return json({
      success: true,
      data: {
        hashtags: data,
        cooccurrence,
        totalHashtags: data.length,
        totalPosts: data.reduce((sum: number, h: any) => sum + parseInt(h.post_count || 0), 0)
      }
    });
  } catch (error) {
    return queryErrorResponse('Hashtag analysis', error, {
      hashtags: [], cooccurrence: [], totalHashtags: 0, totalPosts: 0
    });
  }
}

export const hashtagsHandlers: Record<string, AnalyticsHandler> = {
  'hashtag-analysis': hashtagAnalysis
};
