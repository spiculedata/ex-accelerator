import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import { dateBoundToEpochMs } from '$lib/server/dateBounds';
import { queryErrorResponse } from '$lib/server/queryErrors';
import { exportRangeConditions } from '$lib/server/exportRange';
import { buildPlatformFilter } from '$lib/services/workspaceContextResolver';
import type { AnalyticsContext, AnalyticsHandler } from './types';

/** The most rows one export holds, so a very large dataset cannot build an unbounded response. */
const EXPORT_MAX_ROWS = 10_000;

async function crossPlatformSentiment({ url, scope }: AnalyticsContext): Promise<Response> {
  try {
    // If workspace is scoped but has no social media datasets, return empty
    if (scope && !scope.hasSocialMedia) {
      return json({ success: true, data: [] });
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Explicit platform filter from FilterBar (overrides workspace scope)
    const explicitPlatforms = url.searchParams.get('platforms');
    if (explicitPlatforms !== null) {
      const platformList = explicitPlatforms.split(',').filter(p => p.trim());
      if (platformList.length === 0) {
        // All platforms disabled — return empty data
        return json({ success: true, data: [] });
      }
      conditions.push(`LOWER(platform) = ANY($${paramIndex})`);
      params.push(platformList.map(p => p.toLowerCase()));
      paramIndex++;
    } else {
      // Fall back to workspace scope filter
      const platformFilter = buildPlatformFilter(scope, paramIndex);
      if (platformFilter) {
        conditions.push(platformFilter.clause);
        params.push(...platformFilter.params);
        paramIndex = platformFilter.nextIndex;
      }
    }

    // Date range filter: the timestamp column is epoch milliseconds, so bounds are converted
    const dateStart = url.searchParams.get('date_start');
    const dateEnd = url.searchParams.get('date_end');
    for (const [name, value, bound, op] of [
      ['date_start', dateStart, 'start', '>='],
      ['date_end', dateEnd, 'end', '<=']
    ] as const) {
      if (!value) continue;
      const epochMs = dateBoundToEpochMs(value, bound);
      if (epochMs === null) {
        return json({ success: false, data: null, error: `${name} must be a date (YYYY-MM-DD) or an ISO timestamp with a time zone` }, { status: 400 });
      }
      conditions.push(`timestamp ${op} $${paramIndex}`);
      params.push(epochMs);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query sentiment data from PostgreSQL tables using DuckDB execution
    const data = await executeQuery(`
      SELECT
        sentiment_category,
        COUNT(*) as post_count,
        AVG(confidence_score) as avg_confidence,
        platform
      FROM posts_with_sentiment
      ${whereClause}
      GROUP BY sentiment_category, platform
      ORDER BY post_count DESC
    `, params);

    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('Cross-platform sentiment', error, []);
  }
}

async function sentimentTrends({ url, scope }: AnalyticsContext): Promise<Response> {
  try {
    const timeRange = url.searchParams.get('timeRange') || '30d';
    const days = timeRange === '90d' ? 90 : timeRange === '30d' ? 30 : timeRange === '14d' ? 14 : 7;

    // The window is the date bar when it is set, otherwise the last N days
    const dateBounds: Array<[string, number]> = [];
    for (const [name, bound, op] of [['date_start', 'start', '>='], ['date_end', 'end', '<=']] as const) {
      const value = url.searchParams.get(name);
      if (!value) continue;
      const epochMs = dateBoundToEpochMs(value, bound);
      if (epochMs === null) {
        return json({ success: false, data: null, error: `${name} must be a date (YYYY-MM-DD) or an ISO timestamp with a time zone` }, { status: 400 });
      }
      dateBounds.push([op, epochMs]);
    }

    // Build platform filter
    const conditions: string[] = [];
    const params: any[] = dateBounds.length > 0 ? dateBounds.map(([, ms]) => ms) : [days];
    let paramIndex = params.length + 1;
    const windowClause = dateBounds.length > 0
      ? dateBounds.map(([op], i) => `timestamp ${op} $${i + 1}`).join(' AND ')
      : "DATE(to_timestamp(timestamp/1000) AT TIME ZONE 'UTC') >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - $1::integer";

    const explicitPlatforms = url.searchParams.get('platforms');
    if (explicitPlatforms !== null) {
      const platformList = explicitPlatforms.split(',').filter(p => p.trim());
      if (platformList.length > 0) {
        conditions.push(`LOWER(platform) = ANY($${paramIndex})`);
        params.push(platformList.map(p => p.toLowerCase()));
        paramIndex++;
      }
    } else {
      const platformFilter = buildPlatformFilter(scope, paramIndex);
      if (platformFilter) {
        conditions.push(platformFilter.clause);
        params.push(...platformFilter.params);
        paramIndex = platformFilter.nextIndex;
      }
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // Query live data from posts_with_sentiment instead of stale pre-aggregated table
    const data = await executeQuery(`
      SELECT
        DATE(to_timestamp(timestamp/1000) AT TIME ZONE 'UTC') as date,
        COUNT(*) FILTER (WHERE sentiment_category IN ('Positive','Very Positive')) as positive,
        COUNT(*) FILTER (WHERE sentiment_category IN ('Negative','Very Negative')) as negative,
        COUNT(*) FILTER (WHERE sentiment_category = 'Neutral') as neutral,
        COUNT(*) as total_posts
      FROM posts_with_sentiment
      WHERE timestamp IS NOT NULL
        AND ${windowClause}
        ${whereClause}
      GROUP BY DATE(to_timestamp(timestamp/1000) AT TIME ZONE 'UTC')
      ORDER BY date
    `, params);

    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('Sentiment trends', error, []);
  }
}

async function samplePosts({ url, scope }: AnalyticsContext): Promise<Response> {
  try {
    if (scope && !scope.hasSocialMedia) return json({ success: true, data: [] });
    const sentiment = url.searchParams.get('sentiment') || 'all';
    const platform = url.searchParams.get('platform') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    // The sentiment page pages through up to 500 posts; nothing larger is useful in one response
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 50;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    const scopePlatformFilter = buildPlatformFilter(scope, paramIndex);
    if (scopePlatformFilter) {
      conditions.push(scopePlatformFilter.clause);
      params.push(...scopePlatformFilter.params);
      paramIndex = scopePlatformFilter.nextIndex;
    }

    if (sentiment !== 'all') {
      conditions.push(`LOWER(sentiment_category) LIKE '%' || LOWER($${paramIndex}) || '%'`);
      params.push(sentiment);
      paramIndex++;
    }
    if (platform !== 'all') {
      conditions.push(`LOWER(platform) = LOWER($${paramIndex})`);
      params.push(platform);
      paramIndex++;
    }

    params.push(safeLimit);
    const limitParam = `$${paramIndex}`;

    const data = await executeQuery(`
      SELECT
        id,
        text,
        sentiment_category as sentiment,
        confidence_score as confidence,
        platform,
        timestamp,
        'author_' || id as author
      FROM posts_with_sentiment
      WHERE ${conditions.join(' AND ')}
      ORDER BY confidence_score DESC, timestamp DESC
      LIMIT ${limitParam}
    `, params);
    
    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('Sample posts', error, []);
  }
}

async function platformPerformance({ scope }: AnalyticsContext): Promise<Response> {
  try {
    if (scope && !scope.hasSocialMedia) return json({ success: true, data: [] });
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const platformFilter = buildPlatformFilter(scope, paramIndex);
    if (platformFilter) {
      conditions.push(platformFilter.clause);
      params.push(...platformFilter.params);
      paramIndex = platformFilter.nextIndex;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const data = await executeQuery(`
      SELECT
        platform,
        COUNT(*) as total_posts,
        AVG(confidence_score) as avg_confidence,
        ROUND(
          COUNT(CASE WHEN LOWER(sentiment_category) LIKE '%positive%' THEN 1 END) * 1.0 / COUNT(*),
          3
        ) as positive_ratio
      FROM posts_with_sentiment
      ${whereClause}
      GROUP BY platform
      ORDER BY total_posts DESC
    `, params);

    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('Platform performance', error, []);
  }
}

async function topKeywords({ url }: AnalyticsContext): Promise<Response> {
  try {
    const sentiment = url.searchParams.get('keywordSentiment') || 'all';
    const params: any[] = [];
    let whereClause = '';
    if (sentiment !== 'all') {
      params.push(sentiment);
      whereClause = `WHERE LOWER(sc.sentiment_category) LIKE '%' || LOWER($1) || '%'`;
    }

    const data = await executeQuery(`
      SELECT
        REGEXP_EXTRACT(p.content, '\\b\\w{4,}\\b', 'g') as keywords
      FROM posts p
      JOIN sentiment_classifications sc ON p.id = sc.post_id
      ${whereClause}
      LIMIT 100
    `, params);
    
    return json({ success: true, data: data || [] });
  } catch (error) {
    return queryErrorResponse('Top keywords', error, []);
  }
}

async function sentimentKeywords({ url }: AnalyticsContext): Promise<Response> {
  try {
    const sentiment = url.searchParams.get('keywordSentiment') || 'all';
    const params: any[] = [];
    let whereClause = '';
    if (sentiment !== 'all') {
      params.push(sentiment);
      whereClause = `WHERE LOWER(sk.sentiment_type) LIKE '%' || LOWER($1) || '%'`;
    }

    const data = await executeQuery(`
      SELECT
        sk.keyword,
        sk.sentiment_type,
        sk.frequency,
        sk.impact_score,
        sk.platforms,
        sk.analysis_period_start,
        sk.analysis_period_end
      FROM sentiment_keywords sk
      ${whereClause}
      ORDER BY sk.frequency DESC
      LIMIT 50
    `, params);

    return json({ success: true, data: data || [] });
  } catch (error) {
    return queryErrorResponse('Sentiment keywords', error, []);
  }
}

async function hourlyPatterns({ scope }: AnalyticsContext): Promise<Response> {
  try {
    if (scope && !scope.hasSocialMedia) return json({ success: true, data: [] });
    const data = await executeQuery(`
      WITH hours AS (
        SELECT generate_series(0, 23) as hour_of_day
      )
      SELECT
        h.hour_of_day,
        COALESCE(hsp.total_posts_analyzed, 0) as positive,
        COALESCE(CAST(hsp.total_posts_analyzed * hsp.avg_negative_percentage / 100 AS INTEGER), 0) as negative,
        COALESCE(CAST(hsp.total_posts_analyzed * hsp.avg_neutral_percentage / 100 AS INTEGER), 0) as neutral
      FROM hours h
      LEFT JOIN hourly_sentiment_patterns hsp ON h.hour_of_day = hsp.hour_of_day
      ORDER BY h.hour_of_day
    `);
    
    return json({ success: true, data: data || [] });
  } catch (error) {
    return queryErrorResponse('Hourly patterns', error, []);
  }
}

async function exportData({ url, scope }: AnalyticsContext): Promise<Response> {
  const range = exportRangeConditions(url.searchParams, 1);
  if (!range.ok) return json({ success: false, error: range.error }, { status: 400 });
  try {
    if (scope && !scope.hasSocialMedia) return json({ success: true, data: [] });
    const sentiment = url.searchParams.get('sentiment') || 'all';
    const platform = url.searchParams.get('platform') || 'all';

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    const scopePlatformFilter = buildPlatformFilter(scope, paramIndex);
    if (scopePlatformFilter) {
      conditions.push(scopePlatformFilter.clause);
      params.push(...scopePlatformFilter.params);
      paramIndex = scopePlatformFilter.nextIndex;
    }

    if (sentiment !== 'all') {
      conditions.push(`LOWER(sentiment_category) LIKE '%' || LOWER($${paramIndex}) || '%'`);
      params.push(sentiment);
      paramIndex++;
    }
    if (platform !== 'all') {
      conditions.push(`LOWER(platform) = LOWER($${paramIndex})`);
      params.push(platform);
      paramIndex++;
    }

    // The date bar and the confidence slider apply too; the placeholders are renumbered after the filters above
    const dated = exportRangeConditions(url.searchParams, paramIndex);
    if (dated.ok) {
      conditions.push(...dated.conditions);
      params.push(...dated.params);
    }

    const data = await executeQuery(`
      SELECT
        id,
        text,
        sentiment_category as sentiment,
        confidence_score as confidence,
        platform,
        timestamp,
        'author_' || id as author
      FROM posts_with_sentiment
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT ${EXPORT_MAX_ROWS}
    `, params);
    
    return json({ success: true, data: data || [] });
  } catch (error) {
    return queryErrorResponse('Export data', error, []);
  }
}

export const sentimentHandlers: Record<string, AnalyticsHandler> = {
  'cross-platform-sentiment': crossPlatformSentiment,
  'sentiment-trends': sentimentTrends,
  'sample-posts': samplePosts,
  'platform-performance': platformPerformance,
  'top-keywords': topKeywords,
  'sentiment-keywords': sentimentKeywords,
  'hourly-patterns': hourlyPatterns,
  'export-data': exportData
};
