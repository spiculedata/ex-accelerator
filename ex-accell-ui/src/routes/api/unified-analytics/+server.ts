// Unified Analytics API
// PostgreSQL with pg_duckdb extension for unified database queries

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';
import { ENGAGEMENT_TRENDS_DAYS, engagementQueries } from '$lib/server/engagementQueries';
import { languageQueries } from '$lib/server/languageQueries';
import { WORKFLOW_DATASET_COUNT_QUERIES, buildWorkflowDatasets, type WorkflowDatasetCounts } from '$lib/server/workflowDatasets';
import { TRIGRAM_DEFAULT_DAYS, TRIGRAM_MAX_POSTS, TRIGRAM_TIME_RANGE_DAYS, trigramPostsQuery } from '$lib/server/trigramQueries';
import { computeTrigrams, trendWindow } from '$lib/server/trigrams';
import { dateBoundToEpochMs, validateDateParams } from '$lib/server/dateBounds';
import { isMissingRelationError, queryErrorResponse } from '$lib/server/queryErrors';
import { exportRangeConditions } from '$lib/server/exportRange';
import { parseDateWindow, windowConditions } from '$lib/server/dateWindow';
import { resolveWorkspaceScope, buildPlatformFilter, hasDataType } from '$lib/services/workspaceContextResolver';

/**
 * Execute a query using pg_duckdb extension
 * This leverages DuckDB's analytical engine on PostgreSQL tables
 */
async function executeQuery(sql: string, params: any[] = []): Promise<any[]> {
  // Errors propagate: callers map failures through queryErrorResponse (missing table => empty, else 500)
  const rows = await postgresPool.duckdbQuery(sql, params);

  // Convert BigInts and numeric strings to regular numbers for JSON serialization
  // PostgreSQL's pg driver returns COUNT/AVG/SUM/numeric columns as strings
  const numericColumns = new Set([
    'count', 'post_count', 'total_posts', 'total_size', 'topic_count',
    'avg_confidence', 'avg_coherence', 'positive_ratio', 'correlation',
    'positive', 'negative', 'neutral', 'total_posts_analyzed',
    'positive_count', 'negative_count', 'neutral_count',
    'hour_of_day', 'document_count', 'average_engagement', 'growth_rate',
    'similarity_score', 'weight', 'size', 'coherence_score', 'rank_position',
    'confidence', 'confidence_score', 'intensity_score',
    'avg_negative_percentage', 'avg_neutral_percentage',
    'record_count', 'health',
    'total_transcripts', 'total_seconds', 'station_count', 'avg_duration',
    'political_count', 'ad_count', 'transcript_count', 'positive_count',
    'negative_count', 'neutral_count', 'avg_relevance', 'word_count',
    'duration_seconds', 'avg_confidence'
  ]);

  return rows.map(row => {
    const serializedRow: any = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'bigint') {
        serializedRow[key] = Number(value);
      } else if (typeof value === 'string' && numericColumns.has(key) && value !== '' && !isNaN(Number(value))) {
        serializedRow[key] = Number(value);
      } else {
        serializedRow[key] = value;
      }
    }
    return serializedRow;
  });
}

/**
 * GET /api/unified-analytics
 * Test connection and basic queries for unified analytics
 */
interface TrigramPostRow {
  id: number | string;
  text: string | null;
  platform: string;
  created_at: string | Date;
  sentiment_category: string | null;
  engagement_rate: string | number | null;
}

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

/** The most rows one export holds, so a very large dataset cannot build an unbounded response. */
const EXPORT_MAX_ROWS = 10_000;

export const GET: RequestHandler = async ({ url }) => {
  try {
    const type = url.searchParams.get('type');

    // A bad or reversed date range is the caller's mistake, whatever the endpoint: answer 400, not a database error
    const dateProblem = validateDateParams(url.searchParams);
    if (dateProblem) return json({ success: false, error: dateProblem }, { status: 400 });

    // Resolve workspace scope for dataset-scoped analytics
    const scope = await resolveWorkspaceScope(url);

    if (type === 'test') {
      // Test PostgreSQL connection with pg_duckdb
      const isConnected = await postgresPool.healthCheck();

      if (isConnected) {
        try {
          // Check if we have data in the database
          const postCount = await executeQuery('SELECT COUNT(*) as count FROM sentiment_posts');
          const sentimentCount = await executeQuery('SELECT COUNT(*) as count FROM sentiment_classifications');

          // Get connection pool stats
          const poolStats = postgresPool.getPoolStats();

          return json({
            success: true,
            message: 'PostgreSQL with pg_duckdb extension connected',
            timestamp: new Date().toISOString(),
            dataStatus: {
              posts: postCount[0]?.count || 0,
              sentiments: sentimentCount[0]?.count || 0,
              hasData: (postCount[0]?.count || 0) > 0
            },
            poolStats,
            scope: scope ? {
              workspaceId: scope.workspaceId,
              workspaceName: scope.workspaceName,
              datasetCount: scope.datasets.length,
              datasetTypes: scope.datasetTypes,
              socialPlatforms: scope.socialPlatforms,
              hasGdeltEvents: scope.hasGdeltEvents,
              hasGdeltGkg: scope.hasGdeltGkg
            } : null
          });
        } catch (error) {
          console.warn('Could not check data status:', error);
          return json({
            success: true,
            message: 'PostgreSQL connected (data status unknown)',
            timestamp: new Date().toISOString(),
            warning: 'Could not verify data availability'
          });
        }
      } else {
        return json({
          success: false,
          error: 'Database connection failed',
          message: 'Could not connect to PostgreSQL'
        });
      }
    }
    
    // Global filter: if platforms param is explicitly empty, return empty for all social endpoints
    const socialEndpoints = ['cross-platform-sentiment', 'sentiment-trends', 'sample-posts',
      'platform-performance', 'hourly-patterns', 'topics-overview', 'topic-keywords',
      'topic-trends', 'topic-relationships', 'topic-categories', 'language-stats',
      'language-trends', 'language-detection-detail', 'emotion-stats', 'emotion-correlations',
      'sentiment-keywords', 'top-keywords', 'export-data', 'hashtag-analysis'];

    const platformsParam = url.searchParams.get('platforms');
    if (platformsParam !== null && platformsParam.split(',').filter(p => p.trim()).length === 0) {
      if (socialEndpoints.includes(type)) {
        return json({ success: true, data: [] });
      }
    }

    // Handle sentiment analysis queries
    if (type === 'cross-platform-sentiment') {
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
    
    if (type === 'sentiment-trends') {
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
    
    if (type === 'sample-posts') {
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
    
    if (type === 'platform-performance') {
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
    
    if (type === 'top-keywords') {
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
    
    if (type === 'emotion-correlations') {
      if (scope && !scope.hasSocialMedia) return json({ success: true, data: [] });
      try {
        const data = await executeQuery(`
          SELECT
            ea1.emotion as emotion1,
            ea2.emotion as emotion2,
            CORR(ea1.intensity_score, ea2.intensity_score) as correlation,
            COUNT(*) as co_occurrence_count
          FROM emotion_analysis ea1
          JOIN emotion_analysis ea2 ON ea1.post_id = ea2.post_id AND ea1.emotion != ea2.emotion
          GROUP BY ea1.emotion, ea2.emotion
          HAVING COUNT(*) >= 5
          ORDER BY correlation DESC
          LIMIT 20
        `);

        return json({ success: true, data: data || [] });
      } catch (error) {
        return queryErrorResponse('Emotion correlations', error, []);
      }
    }

    if (type === 'emotion-stats') {
      try {
        if (scope && !scope.hasSocialMedia) return json({ success: true, data: [] });
        const data = await executeQuery(`
          SELECT
            ea.emotion,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emotion_analysis), 1) as percentage,
            AVG(ea.intensity_score) as avg_intensity,
            AVG(ea.confidence) as avg_confidence
          FROM emotion_analysis ea
          GROUP BY ea.emotion
          ORDER BY count DESC
        `);

        return json({ success: true, data: data || [] });
      } catch (error) {
        return queryErrorResponse('Emotion stats', error, []);
      }
    }

    if (type === 'sentiment-keywords') {
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
    
    if (type === 'hourly-patterns') {
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
    
    if (type === 'export-data') {
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
    
    // Topic Modeling Database Queries
    if (type === 'topics-overview') {
      if (!hasDataType(scope, 'social_media') && !hasDataType(scope, 'gdelt_events') && !hasDataType(scope, 'gdelt_gkg')) {
        return json({ success: true, data: [] });
      }
      try {
        const data = await executeQuery(`
          SELECT
            topic_id,
            name,
            category,
            category_color,
            size,
            weight,
            coherence_score,
            created_at
          FROM topics
          ORDER BY size DESC
        `);

        return json({ success: true, data: data || [] });
      } catch (error) {
        return queryErrorResponse('Topics overview', error, []);
      }
    }

    if (type === 'topic-keywords') {
      try {
        const topicId = url.searchParams.get('topicId');
        const params: any[] = [];
        let whereClause = '';
        if (topicId) {
          params.push(topicId);
          whereClause = `WHERE t.topic_id = $1`;
        }

        // Keyed by the readable topics.topic_id so it matches topics-overview
        const data = await executeQuery(`
          SELECT
            t.topic_id AS topic_id,
            tk.keyword,
            tk.weight,
            tk.rank_position
          FROM topic_keywords tk
          JOIN topics t ON t.id = tk.topic_id
          ${whereClause}
          ORDER BY t.topic_id, tk.rank_position
        `, params);

        return json({ success: true, data: data || [] });
      } catch (error) {
        return queryErrorResponse('Topic keywords', error, []);
      }
    }

    if (type === 'topic-trends') {
      try {
        const timeRange = url.searchParams.get('timeRange') || '30d';
        // days is derived from a controlled ternary, not raw user input
        const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
        if (!Number.isFinite(days)) throw new Error('Invalid days value');

        const data = await executeQuery(`
          SELECT
            topic_id,
            analysis_date,
            document_count,
            average_engagement,
            growth_rate,
            trend_direction
          FROM topic_trends
          WHERE analysis_date >= (SELECT MAX(analysis_date) FROM topic_trends) - INTERVAL '${days} days'
          ORDER BY analysis_date DESC, topic_id
        `);

        return json({ success: true, data: data || [] });
      } catch (error) {
        return queryErrorResponse('Topic trends', error, []);
      }
    }

    if (type === 'topic-relationships') {
      try {
        const threshold = parseFloat(url.searchParams.get('threshold') || '0.5');
        const safeThreshold = Number.isFinite(threshold) ? threshold : 0.5;

        const data = await executeQuery(`
          SELECT
            t1.topic_id AS topic1_id,
            t2.topic_id AS topic2_id,
            tr.similarity_score,
            tr.relationship_type,
            tr.strength
          FROM topic_relationships tr
          JOIN topics t1 ON t1.id = tr.topic1_id
          JOIN topics t2 ON t2.id = tr.topic2_id
          WHERE tr.similarity_score >= $1
          ORDER BY tr.similarity_score DESC
        `, [safeThreshold]);

        return json({ success: true, data: data || [] });
      } catch (error) {
        return queryErrorResponse('Topic relationships', error, []);
      }
    }

    if (type === 'topic-categories') {
      if (!hasDataType(scope, 'social_media') && !hasDataType(scope, 'gdelt_events') && !hasDataType(scope, 'gdelt_gkg')) {
        return json({ success: true, data: [] });
      }
      try {
        const data = await executeQuery(`
          SELECT DISTINCT
            category,
            category_color,
            COUNT(*) as topic_count,
            SUM(size) as total_size,
            AVG(coherence_score) as avg_coherence
          FROM topics
          GROUP BY category, category_color
          ORDER BY total_size DESC
        `);

        return json({ success: true, data: data || [] });
      } catch (error) {
        return queryErrorResponse('Topic categories', error, []);
      }
    }
    
    // ─── Language Detection Endpoints ─────────────────────────────────────
    if (type === 'language-stats') {
      const parsed = parseDateWindow(url.searchParams);
      if (!parsed.ok) return json({ success: false, error: parsed.error }, { status: 400 });
      try {
        const dated = windowConditions('p.created_at', parsed.window, 1);
        const data = await executeQuery(languageQueries.stats(dated.conditions), dated.params);
        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('Language stats', error, []);
      }
    }

    if (type === 'language-posts') {
      const parsed = parseDateWindow(url.searchParams);
      if (!parsed.ok) return json({ success: false, error: parsed.error }, { status: 400 });
      try {
        const params: any[] = [];
        const conditions: string[] = [];
        const platform = url.searchParams.get('platform');
        const language = url.searchParams.get('language');
        const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '');
        if (platform && platform !== 'all') { params.push(platform); conditions.push(`ds.platform = $${params.length}`); }
        if (language && language !== 'all') { params.push(language); conditions.push(`l.code = $${params.length}`); }
        if (Number.isFinite(minConfidence)) { params.push(minConfidence); conditions.push(`ld.confidence_score >= $${params.length}`); }
        const dated = windowConditions('p.created_at', parsed.window, params.length + 1);
        params.push(...dated.params);
        conditions.push(...dated.conditions);
        params.push(Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50') || 50, 1), 200));

        const data = await executeQuery(languageQueries.posts(conditions, `$${params.length}`), params);
        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('Language posts', error, []);
      }
    }

    if (type === 'language-mixing') {
      const parsed = parseDateWindow(url.searchParams);
      if (!parsed.ok) return json({ success: false, error: parsed.error }, { status: 400 });
      try {
        const dated = windowConditions('p.created_at', parsed.window, 1);
        const data = await executeQuery(languageQueries.mixing(dated.conditions), dated.params);
        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('Language mixing', error, []);
      }
    }

    if (type === 'language-trends') {
      try {
        const data = await executeQuery(`
          SELECT
            language_code,
            analysis_date,
            document_count,
            avg_confidence
          FROM language_trends
          ORDER BY analysis_date DESC, document_count DESC
        `);
        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('Language trends', error, []);
      }
    }

    if (type === 'language-detection-detail') {
      try {
        const langCode = url.searchParams.get('language') || 'all';
        const params: any[] = [];
        let whereClause = '';
        if (langCode !== 'all') {
          params.push(langCode);
          whereClause = `WHERE l.code = $1`;
        }
        const data = await executeQuery(`
          SELECT
            ld.post_id AS document_id,
            ds.platform AS document_source,
            l.code AS language_code,
            ld.confidence_score AS confidence,
            l.name AS language_name
          FROM language_detection ld
          JOIN languages l ON ld.language_id = l.id
          LEFT JOIN posts p ON p.id = ld.post_id
          LEFT JOIN data_sources ds ON ds.id = p.data_source_id
          ${whereClause}
          ORDER BY ld.confidence_score DESC
          LIMIT 100
        `, params);
        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('Language detection detail', error, []);
      }
    }

    // ─── GDELT Analytics Endpoints ────────────────────────────────────────
    if (type === 'gdelt-summary') {
      try {
        const dateStart = url.searchParams.get('dateStart');
        const dateEnd = url.searchParams.get('dateEnd');
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        // Convert YYYY-MM-DD to YYYYMM for monthly materialized view
        if (dateStart) {
          conditions.push(`year_month >= $${paramIndex}`);
          params.push(parseInt(dateStart.replace(/-/g, '').substring(0, 6)));
          paramIndex++;
        }
        if (dateEnd) {
          conditions.push(`year_month <= $${paramIndex}`);
          params.push(parseInt(dateEnd.replace(/-/g, '').substring(0, 6)));
          paramIndex++;
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Use pre-aggregated materialized view (44 rows vs 23M)
        const data = await executeQuery(`
          SELECT
            SUM(events) as total_events,
            MAX(countries) as countries,
            SUM(events * avg_goldstein) / NULLIF(SUM(events), 0) as avg_goldstein,
            SUM(events * avg_tone) / NULLIF(SUM(events), 0) as avg_tone,
            SUM(events * avg_articles) / NULLIF(SUM(events), 0) as avg_articles,
            MIN(date_min) as date_min,
            MAX(date_max) as date_max
          FROM gdelt_summary_monthly ${where}
        `, params);

        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('GDELT summary', error, []);
      }
    }

    if (type === 'gdelt-by-country') {
      try {
        const dateStart = url.searchParams.get('dateStart');
        const dateEnd = url.searchParams.get('dateEnd');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (dateStart) {
          conditions.push(`year_month >= $${paramIndex}`);
          params.push(parseInt(dateStart.replace(/-/g, '').substring(0, 6)));
          paramIndex++;
        }
        if (dateEnd) {
          conditions.push(`year_month <= $${paramIndex}`);
          params.push(parseInt(dateEnd.replace(/-/g, '').substring(0, 6)));
          paramIndex++;
        }

        params.push(limit);
        const limitParam = `$${paramIndex}`;
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Use pre-aggregated materialized view (6250 rows vs 23M)
        const data = await executeQuery(`
          SELECT country, SUM(events) as events,
                 SUM(events * avg_goldstein) / NULLIF(SUM(events), 0) as avg_goldstein,
                 SUM(events * avg_tone) / NULLIF(SUM(events), 0) as avg_tone
          FROM gdelt_country_monthly ${where}
          GROUP BY country
          ORDER BY events DESC
          LIMIT ${limitParam}
        `, params);

        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('GDELT by country', error, []);
      }
    }

    if (type === 'gdelt-by-eventtype') {
      try {
        const dateStart = url.searchParams.get('dateStart');
        const dateEnd = url.searchParams.get('dateEnd');
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (dateStart) {
          conditions.push(`year_month >= $${paramIndex}`);
          params.push(parseInt(dateStart.replace(/-/g, '').slice(0, 6)));
          paramIndex++;
        }
        if (dateEnd) {
          conditions.push(`year_month <= $${paramIndex}`);
          params.push(parseInt(dateEnd.replace(/-/g, '').slice(0, 6)));
          paramIndex++;
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const data = await executeQuery(`
          SELECT eventrootcode as code,
                 CASE eventrootcode
                   WHEN '1' THEN 'Public Statements & Speeches'
                   WHEN '2' THEN 'Appeals & Requests'
                   WHEN '3' THEN 'Cooperation & Agreements'
                   WHEN '4' THEN 'Consultations & Meetings'
                   WHEN '5' THEN 'Diplomatic Actions'
                   WHEN '6' THEN 'Material Cooperation & Aid'
                   WHEN '7' THEN 'Providing Aid & Assistance'
                   WHEN '8' THEN 'Concessions & Yielding'
                   WHEN '9' THEN 'Investigations & Monitoring'
                   WHEN '10' THEN 'Demands & Pressure'
                   WHEN '11' THEN 'Criticism & Disapproval'
                   WHEN '12' THEN 'Rejection & Refusal'
                   WHEN '13' THEN 'Threats & Intimidation'
                   WHEN '14' THEN 'Protests & Demonstrations'
                   WHEN '15' THEN 'Military Posturing'
                   WHEN '16' THEN 'Sanctions & Reduced Relations'
                   WHEN '17' THEN 'Coercion & Repression'
                   WHEN '18' THEN 'Assault & Physical Violence'
                   WHEN '19' THEN 'Armed Conflict & Fighting'
                   WHEN '20' THEN 'Conventional Military Force'
                   ELSE 'Other (' || eventrootcode || ')'
                 END as event_type,
                 SUM(events) as events,
                 SUM(events * avg_goldstein) / NULLIF(SUM(events), 0) as avg_goldstein
          FROM gdelt_eventtype_monthly
          ${whereClause}
          GROUP BY eventrootcode
          ORDER BY events DESC
        `, params);

        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('GDELT by event type', error, []);
      }
    }

    if (type === 'gdelt-timeline') {
      try {
        const dateStart = url.searchParams.get('dateStart');
        const dateEnd = url.searchParams.get('dateEnd');
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (dateStart) {
          conditions.push(`sqldate >= $${paramIndex}`);
          params.push(parseInt(dateStart.replace(/-/g, '')));
          paramIndex++;
        }
        if (dateEnd) {
          conditions.push(`sqldate <= $${paramIndex}`);
          params.push(parseInt(dateEnd.replace(/-/g, '')));
          paramIndex++;
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Use materialized view for timeline (pre-aggregated, much faster)
        const data = await executeQuery(`
          SELECT sqldate as date, event_count as events,
                 avg_goldstein, avg_tone
          FROM gdelt_daily_stats ${where}
          ORDER BY sqldate
        `, params);

        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('GDELT timeline', error, []);
      }
    }

    if (type === 'gdelt-top-actors') {
      try {
        const dateStart = url.searchParams.get('dateStart');
        const dateEnd = url.searchParams.get('dateEnd');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (dateStart) {
          conditions.push(`year_month >= $${paramIndex}`);
          params.push(parseInt(dateStart.replace(/-/g, '').slice(0, 6)));
          paramIndex++;
        }
        if (dateEnd) {
          conditions.push(`year_month <= $${paramIndex}`);
          params.push(parseInt(dateEnd.replace(/-/g, '').slice(0, 6)));
          paramIndex++;
        }

        params.push(limit);
        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const data = await executeQuery(`
          SELECT actor1name as actor, SUM(mentions) as mentions,
                 SUM(mentions * avg_tone) / NULLIF(SUM(mentions), 0) as avg_tone
          FROM gdelt_actors_monthly
          ${whereClause}
          GROUP BY actor1name
          ORDER BY mentions DESC
          LIMIT $${paramIndex}
        `, params);

        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('GDELT top actors', error, []);
      }
    }

    if (type === 'gdelt-country-detail') {
      try {
        const country = url.searchParams.get('country');
        const dateStart = url.searchParams.get('dateStart');
        const dateEnd = url.searchParams.get('dateEnd');

        if (!country) return json({ success: false, error: 'country parameter required' }, { status: 400 });

        // Build conditions for both raw table and materialized views
        const rawConditions: string[] = ['actiongeo_countrycode = $1'];
        const rawParams: any[] = [country];
        let rawParamIndex = 2;

        const mvConditions: string[] = ['country = $1'];
        const mvParams: any[] = [country];
        let mvParamIndex = 2;

        if (dateStart) {
          rawConditions.push(`sqldate >= $${rawParamIndex}`);
          rawParams.push(parseInt(dateStart.replace(/-/g, '')));
          rawParamIndex++;

          mvConditions.push(`year_month >= $${mvParamIndex}`);
          mvParams.push(parseInt(dateStart.replace(/-/g, '').substring(0, 6)));
          mvParamIndex++;
        }
        if (dateEnd) {
          rawConditions.push(`sqldate <= $${rawParamIndex}`);
          rawParams.push(parseInt(dateEnd.replace(/-/g, '')));
          rawParamIndex++;

          mvConditions.push(`year_month <= $${mvParamIndex}`);
          mvParams.push(parseInt(dateEnd.replace(/-/g, '').substring(0, 6)));
          mvParamIndex++;
        }

        const rawWhere = rawConditions.join(' AND ');
        const mvWhere = mvConditions.join(' AND ');

        // Use materialized view for summary + timeline (fast), raw table for actors + events
        const [summary, actors, eventTypes, toneTrend, keyEvents] = await Promise.all([
          // Summary from materialized view (instant)
          executeQuery(`
            SELECT SUM(events) as total_events,
                   SUM(events * avg_goldstein) / NULLIF(SUM(events), 0) as avg_goldstein,
                   SUM(events * avg_tone) / NULLIF(SUM(events), 0) as avg_tone,
                   0 as unique_actors
            FROM gdelt_country_monthly WHERE ${mvWhere}
          `, mvParams),
          // Actors from raw table (needs row-level data, limit 15)
          executeQuery(`
            SELECT actor1name as actor, COUNT(*) as mentions, AVG(avgtone) as avg_tone
            FROM gdelt_events WHERE ${rawWhere} AND actor1name IS NOT NULL AND actor1name != ''
            GROUP BY actor1name ORDER BY mentions DESC LIMIT 15
          `, rawParams),
          executeQuery(`
            SELECT eventrootcode as code,
                   CASE eventrootcode
                     WHEN '1' THEN 'Public Statements & Speeches'
                     WHEN '2' THEN 'Appeals & Requests'
                     WHEN '3' THEN 'Cooperation & Agreements'
                     WHEN '4' THEN 'Consultations & Meetings'
                     WHEN '5' THEN 'Diplomatic Actions'
                     WHEN '6' THEN 'Material Cooperation & Aid'
                     WHEN '7' THEN 'Providing Aid & Assistance'
                     WHEN '8' THEN 'Concessions & Yielding'
                     WHEN '9' THEN 'Investigations & Monitoring'
                     WHEN '10' THEN 'Demands & Pressure'
                     WHEN '11' THEN 'Criticism & Disapproval'
                     WHEN '12' THEN 'Rejection & Refusal'
                     WHEN '13' THEN 'Threats & Intimidation'
                     WHEN '14' THEN 'Protests & Demonstrations'
                     WHEN '15' THEN 'Military Posturing'
                     WHEN '16' THEN 'Sanctions & Reduced Relations'
                     WHEN '17' THEN 'Coercion & Repression'
                     WHEN '18' THEN 'Assault & Physical Violence'
                     WHEN '19' THEN 'Armed Conflict & Fighting'
                     WHEN '20' THEN 'Conventional Military Force'
                     ELSE 'Other (' || eventrootcode || ')'
                   END as event_type,
                   COUNT(*) as events
            FROM gdelt_events WHERE ${rawWhere} AND eventrootcode IS NOT NULL
            GROUP BY eventrootcode ORDER BY events DESC
          `, rawParams),
          // Timeline from raw table (daily granularity for detailed trends)
          executeQuery(`
            SELECT sqldate as date, COUNT(*) as events,
                   AVG(avgtone) as avg_tone, AVG(goldsteinscale) as avg_goldstein
            FROM gdelt_events WHERE ${rawWhere}
            GROUP BY sqldate ORDER BY sqldate
          `, rawParams),
          // Key events from raw table (limited to 10, fast with index)
          executeQuery(`
            SELECT globaleventid, actor1name, actor2name, eventrootcode, goldsteinscale,
                   avgtone, numarticles, sourceurl, sqldate,
                   actiongeo_fullname
            FROM gdelt_events WHERE ${rawWhere}
            ORDER BY numarticles DESC NULLS LAST LIMIT 10
          `, rawParams)
        ]);

        return json({ success: true, data: { summary: summary[0], actors, eventTypes, toneTrend, keyEvents } });
      } catch (error) {
        return queryErrorResponse('GDELT country detail', error, {});
      }
    }

    if (type === 'gdelt-conflicts') {
      try {
        const dateStart = url.searchParams.get('dateStart');
        const dateEnd = url.searchParams.get('dateEnd');
        const conditions: string[] = ['conflict_events > 0'];
        const params: any[] = [];
        let paramIndex = 1;

        if (dateStart) {
          conditions.push(`year_month >= $${paramIndex}`);
          params.push(parseInt(dateStart.replace(/-/g, '').substring(0, 6)));
          paramIndex++;
        }
        if (dateEnd) {
          conditions.push(`year_month <= $${paramIndex}`);
          params.push(parseInt(dateEnd.replace(/-/g, '').substring(0, 6)));
          paramIndex++;
        }

        const where = conditions.join(' AND ');

        // Use pre-aggregated materialized view
        const data = await executeQuery(`
          SELECT country, country as location,
                 SUM(conflict_events) as conflict_events,
                 SUM(events * avg_goldstein) / NULLIF(SUM(events), 0) as avg_goldstein,
                 SUM(events * avg_tone) / NULLIF(SUM(events), 0) as avg_tone,
                 0 as violent_events
          FROM gdelt_country_monthly WHERE ${where}
          GROUP BY country
          ORDER BY conflict_events DESC LIMIT 20
        `, params);

        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('GDELT conflicts', error, []);
      }
    }

    if (type === 'gdelt-search') {
      try {
        const query = url.searchParams.get('q');
        const dateStart = url.searchParams.get('dateStart');
        const dateEnd = url.searchParams.get('dateEnd');

        if (!query) return json({ success: false, error: 'q parameter required' }, { status: 400 });

        const conditions: string[] = [`(LOWER(actor1name) LIKE '%' || LOWER($1) || '%' OR LOWER(actor2name) LIKE '%' || LOWER($1) || '%' OR LOWER(actiongeo_fullname) LIKE '%' || LOWER($1) || '%')`];
        const params: any[] = [query];
        let paramIndex = 2;

        if (dateStart) {
          conditions.push(`sqldate >= $${paramIndex}`);
          params.push(parseInt(dateStart.replace(/-/g, '')));
          paramIndex++;
        }
        if (dateEnd) {
          conditions.push(`sqldate <= $${paramIndex}`);
          params.push(parseInt(dateEnd.replace(/-/g, '')));
          paramIndex++;
        }

        const where = conditions.join(' AND ');

        const [summary, events] = await Promise.all([
          executeQuery(`
            SELECT COUNT(*) as total, AVG(goldsteinscale) as avg_goldstein, AVG(avgtone) as avg_tone,
                   COUNT(DISTINCT actiongeo_countrycode) as countries
            FROM gdelt_events WHERE ${where}
          `, params),
          executeQuery(`
            SELECT globaleventid, actor1name, actor2name, eventrootcode, goldsteinscale,
                   avgtone, numarticles, sourceurl, sqldate, actiongeo_fullname, actiongeo_countrycode
            FROM gdelt_events WHERE ${where}
            ORDER BY numarticles DESC NULLS LAST LIMIT 50
          `, params)
        ]);

        return json({ success: true, data: { summary: summary[0], events } });
      } catch (error) {
        return queryErrorResponse('GDELT search', error, {});
      }
    }

    if (type === 'gdelt-narrative-summary') {
      try {
        const country = url.searchParams.get('country');
        const dateStart = url.searchParams.get('dateStart');
        const dateEnd = url.searchParams.get('dateEnd');
        const topic = url.searchParams.get('topic') || 'general overview';

        // Gather context data for the LLM
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (country) {
          conditions.push(`actiongeo_countrycode = $${paramIndex}`);
          params.push(country);
          paramIndex++;
        }
        if (dateStart) {
          conditions.push(`sqldate >= $${paramIndex}`);
          params.push(parseInt(dateStart.replace(/-/g, '')));
          paramIndex++;
        }
        if (dateEnd) {
          conditions.push(`sqldate <= $${paramIndex}`);
          params.push(parseInt(dateEnd.replace(/-/g, '')));
          paramIndex++;
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        // Get summary stats for context
        const stats = await executeQuery(`
          SELECT COUNT(*) as total_events,
                 AVG(goldsteinscale) as avg_goldstein,
                 AVG(avgtone) as avg_tone,
                 COUNT(DISTINCT actor1name) as unique_actors
          FROM gdelt_events ${whereClause}
        `, params);

        // Get top actors
        const actors = await executeQuery(`
          SELECT actor1name as actor, COUNT(*) as mentions
          FROM gdelt_events ${whereClause} ${conditions.length > 0 ? 'AND' : 'WHERE'} actor1name IS NOT NULL AND actor1name != ''
          GROUP BY actor1name ORDER BY mentions DESC LIMIT 5
        `, params);

        // Get top event types
        const eventTypes = await executeQuery(`
          SELECT eventrootcode, COUNT(*) as cnt
          FROM gdelt_events ${whereClause} ${conditions.length > 0 ? 'AND' : 'WHERE'} eventrootcode IS NOT NULL
          GROUP BY eventrootcode ORDER BY cnt DESC LIMIT 5
        `, params);

        const cameoLabels: Record<string, string> = {
          '1': 'Public Statements', '2': 'Appeals', '3': 'Cooperation',
          '4': 'Consultations', '5': 'Diplomatic Actions', '6': 'Material Cooperation',
          '7': 'Aid', '8': 'Concessions', '9': 'Investigations',
          '10': 'Demands', '11': 'Disapproval', '12': 'Rejection',
          '13': 'Threats', '14': 'Protests', '15': 'Military Posturing',
          '16': 'Sanctions', '17': 'Coercion', '18': 'Assault',
          '19': 'Armed Conflict', '20': 'Military Force'
        };

        const stat = stats[0] || {};
        const actorList = actors.map((a: any) => `${a.actor} (${a.mentions} events)`).join(', ');
        const eventList = eventTypes.map((e: any) => `${cameoLabels[e.eventrootcode] || e.eventrootcode}: ${e.cnt}`).join(', ');

        const countryName = country || 'Global';
        const goldsteinDesc = (stat.avg_goldstein || 0) > 1 ? 'cooperative' :
                              (stat.avg_goldstein || 0) < -1 ? 'conflictual' : 'mixed';
        const toneDesc = (stat.avg_tone || 0) > 1 ? 'positive' :
                         (stat.avg_tone || 0) < -1 ? 'negative' : 'neutral';

        const prompt = `You are a geopolitical intelligence analyst. Write a concise intelligence briefing (3-4 paragraphs) about ${countryName} based on GDELT event data.

Context data:
- Total events: ${stat.total_events || 0}
- Average Goldstein scale: ${Number(stat.avg_goldstein || 0).toFixed(2)} (${goldsteinDesc} — scale is -10 conflict to +10 cooperation)
- Average media tone: ${Number(stat.avg_tone || 0).toFixed(2)} (${toneDesc})
- Unique actors: ${stat.unique_actors || 0}
- Top actors: ${actorList || 'none'}
- Top event types: ${eventList || 'none'}
- Topic focus: ${topic}
${dateStart ? `- Date range: ${dateStart} to ${dateEnd || 'present'}` : ''}

Write a professional intelligence briefing that:
1. Summarizes the overall situation and key dynamics
2. Highlights the most significant actors and their roles
3. Notes any patterns in event types (cooperation vs conflict)
4. Provides a brief outlook or assessment

Be factual and analytical. Do not speculate beyond what the data suggests.`;

        // Call Ollama
        const ollamaHost = process.env.OLLAMA_HOST || 'http://ollama:11434';
        const ollamaResponse = await fetch(`${ollamaHost}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemma3:4b',
            prompt,
            stream: false,
            options: { temperature: 0.3, num_predict: 500 }
          })
        });

        if (!ollamaResponse.ok) {
          const errText = await ollamaResponse.text();
          console.error('Ollama error:', errText);
          return json({ success: false, error: `LLM unavailable: ${ollamaResponse.status}` }, { status: 502 });
        }

        const ollamaData = await ollamaResponse.json() as any;
        const narrative = ollamaData.response || '';

        return json({
          success: true,
          data: {
            narrative,
            context: {
              country: countryName,
              totalEvents: stat.total_events,
              avgGoldstein: Number(stat.avg_goldstein || 0).toFixed(2),
              avgTone: Number(stat.avg_tone || 0).toFixed(2),
              topActors: actors.map((a: any) => a.actor),
              model: 'gemma3:4b'
            }
          }
        });
      } catch (error: any) {
        console.error('GDELT narrative summary failed:', error);
        return json({ success: false, error: error.message || 'Failed to generate narrative' }, { status: 500 });
      }
    }

    if (type?.startsWith('engagement-')) {
      const parsed = parseDateWindow(url.searchParams);
      if (!parsed.ok) return json({ success: false, error: parsed.error }, { status: 400 });
      try {
        const wsId = url.searchParams.get('workspace_id');
        let platforms: string[] = [];
        if (wsId && scope?.hasSocialMedia && scope.socialPlatforms.length > 0) platforms = scope.socialPlatforms;
        const filter = platforms.length > 0;
        const params: any[] = filter ? [platforms] : [];
        const dated = windowConditions('p.created_at', parsed.window, params.length + 1);
        params.push(...dated.params);
        const dateConditions = dated.conditions;
        const limitParam = `$${params.length + 1}`;
        const days = ENGAGEMENT_TRENDS_DAYS[url.searchParams.get('timeRange') || '7d'] ?? 7;
        const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10') || 10, 1), 100);

        const queries: Record<string, { sql: string; extra?: any[] }> = {
          'engagement-stats': { sql: engagementQueries.stats(filter, dateConditions) },
          'engagement-platforms': { sql: engagementQueries.platforms(filter, dateConditions) },
          'engagement-content-types': { sql: engagementQueries.contentTypes(filter, dateConditions) },
          'engagement-trends': { sql: engagementQueries.trends(filter, days, dateConditions) },
          'engagement-top-posts': { sql: engagementQueries.topPosts(filter, limitParam, dateConditions), extra: [limit] },
          'engagement-timing': { sql: engagementQueries.timing(filter, dateConditions) }
        };
        const query = queries[type];
        if (!query) return json({ success: false, error: `Unknown engagement query: ${type}` }, { status: 400 });

        const data = await executeQuery(query.sql, [...params, ...(query.extra ?? [])]);
        return json({ success: true, data });
      } catch (error) {
        return queryErrorResponse('Engagement analysis', error, []);
      }
    }

    if (type === 'trigrams') {
      const parsed = parseDateWindow(url.searchParams);
      if (!parsed.ok) return json({ success: false, error: parsed.error }, { status: 400 });
      try {
        const intParam = (name: string, fallback: number, min: number, max: number): number => {
          const parsed = parseInt(url.searchParams.get(name) || '');
          return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
        };
        const sentimentParam = (name: string, fallback: number): number => {
          const parsed = parseFloat(url.searchParams.get(name) || '');
          return Number.isFinite(parsed) ? Math.min(Math.max(parsed, -1), 1) : fallback;
        };

        const days = TRIGRAM_TIME_RANGE_DAYS[url.searchParams.get('timeRange') || ''] ?? TRIGRAM_DEFAULT_DAYS;
        const platform = url.searchParams.get('platform');
        const filterByPlatform = !!platform && platform !== 'all';
        const workspacePlatforms = scope?.hasSocialMedia && scope.socialPlatforms.length > 0 ? scope.socialPlatforms : [];

        const params: any[] = [];
        if (workspacePlatforms.length > 0) params.push(workspacePlatforms);
        if (filterByPlatform) params.push(platform);
        const dated = windowConditions('p.created_at', parsed.window, params.length + 1);
        params.push(...dated.params);

        const rows: TrigramPostRow[] = await executeQuery(
          trigramPostsQuery({ workspacePlatforms: workspacePlatforms.length > 0, platform: filterByPlatform }, days, dated.conditions),
          params
        );
        const posts = rows.map((row) => ({
          id: row.id,
          text: String(row.text ?? ''),
          platform: String(row.platform),
          createdAt: new Date(row.created_at),
          sentiment: row.sentiment_category ?? null,
          engagementRate: Number(row.engagement_rate) || 0
        }));

        // When the scan hit its cap, the oldest posts were dropped: measure trends from the oldest one kept
        const now = new Date();
        const truncated = rows.length >= TRIGRAM_MAX_POSTS;
        const oldestKept = posts.reduce((oldest, p) => Math.min(oldest, p.createdAt.getTime()), now.getTime());
        const trendPeriod = trendWindow(parsed.window, days, now, oldestKept, truncated);

        const data = computeTrigrams(posts, {
          now: trendPeriod.end,
          windowStart: trendPeriod.start,
          minFrequency: intParam('minFrequency', 1, 1, 1000),
          maxResults: intParam('maxResults', 100, 1, 500),
          search: url.searchParams.get('search') || undefined,
          sentimentRange: [sentimentParam('minSentiment', -1), sentimentParam('maxSentiment', 1)]
        });
        return json({ success: true, data, meta: { truncated, scannedPosts: rows.length } });
      } catch (error) {
        return queryErrorResponse('Trigram analysis', error, []);
      }
    }

    if (type === 'hashtag-analysis') {
      try {
        const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50') || 50, 1), 500);
        const wsId = url.searchParams.get('workspace_id');

        // ETL installs keep posts in silver.posts; otherwise use the core posts table
        const source = await hashtagPostSource();

        // Only apply platform filter if workspace is specified
        let platformFilter = '';
        const filterParams: any[] = [];
        if (wsId) {
          const scope = await resolveWorkspaceScope(url);
          if (scope.hasSocialMedia && scope.socialPlatforms.length > 0) {
            platformFilter = `AND ${source.platformColumn} = ANY($1)`;
            filterParams.push(scope.socialPlatforms);
          }
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

    if (type === 'gdelt-refresh-views') {
      try {
        const views = [
          'gdelt_summary_monthly',
          'gdelt_country_monthly',
          'gdelt_eventtype_monthly',
          'gdelt_actors_monthly',
          'gdelt_daily_stats'
        ];
        const results: string[] = [];
        for (const view of views) {
          try {
            await executeQuery(`REFRESH MATERIALIZED VIEW ${view}`);
            results.push(`${view}: refreshed`);
          } catch (e: any) {
            results.push(`${view}: ${e.message || 'failed'}`);
          }
        }
        return json({ success: true, data: results, message: 'Materialized views refreshed' });
      } catch (error) {
        console.error('GDELT refresh views failed:', error);
        return json({ success: false, error: 'Failed to refresh materialized views' }, { status: 500 });
      }
    }

    if (type === 'workflow-datasets') {
      try {
        // The counts are independent, so run them together; a module whose table does not exist yet has no data
        const entries = await Promise.all(
          Object.entries(WORKFLOW_DATASET_COUNT_QUERIES).map(async ([key, sql]) => {
            try {
              const [row] = await executeQuery(sql);
              return [key, Number(row?.count) || 0] as const;
            } catch (error) {
              if (!isMissingRelationError(error)) throw error;
              return [key, 0] as const;
            }
          })
        );
        const counts = Object.fromEntries(entries) as unknown as WorkflowDatasetCounts;
        return json({ success: true, data: buildWorkflowDatasets(counts) });
      } catch (error) {
        return queryErrorResponse('Workflow datasets', error, []);
      }
    }

    // ========== Radio Analytics Handlers ==========

    if (type === 'radio-overview') {
      try {
        const data = await executeQuery(`
          SELECT COUNT(*) as total_transcripts,
                 COALESCE(SUM(duration_seconds), 0) as total_seconds,
                 COUNT(DISTINCT radio_name) as station_count,
                 COALESCE(AVG(duration_seconds), 0) as avg_duration,
                 COUNT(*) FILTER (WHERE is_political = true) as political_count,
                 COUNT(*) FILTER (WHERE is_ad = true) as ad_count
          FROM radio_transcripts
        `);
        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Radio overview', err, []);
      }
    }

    if (type === 'radio-sentiment') {
      try {
        const data = await executeQuery(`
          SELECT sentiment as sentiment_category,
                 COUNT(*) as post_count,
                 AVG(confidence) as avg_confidence
          FROM radio_transcripts
          WHERE sentiment IS NOT NULL
          GROUP BY sentiment ORDER BY post_count DESC
        `);
        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Radio sentiment', err, []);
      }
    }

    if (type === 'radio-by-station') {
      try {
        const data = await executeQuery(`
          SELECT radio_name, state, COUNT(*) as transcript_count,
                 COALESCE(SUM(duration_seconds), 0) as total_seconds,
                 COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_count,
                 COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_count,
                 COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral_count,
                 COUNT(*) FILTER (WHERE is_political = true) as political_count
          FROM radio_transcripts GROUP BY radio_name, state ORDER BY transcript_count DESC
        `);
        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Radio by-station', err, []);
      }
    }

    if (type === 'radio-trends') {
      try {
        const data = await executeQuery(`
          SELECT DATE(segment_start) as date,
                 COUNT(*) FILTER (WHERE sentiment = 'positive') as positive,
                 COUNT(*) FILTER (WHERE sentiment = 'negative') as negative,
                 COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral,
                 COUNT(*) as total
          FROM radio_transcripts
          WHERE segment_start IS NOT NULL
          GROUP BY DATE(segment_start) ORDER BY date DESC LIMIT 30
        `);
        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Radio trends', err, []);
      }
    }

    if (type === 'radio-topics') {
      try {
        const data = await executeQuery(`
          SELECT topic, COUNT(*) as count, AVG(relevance) as avg_relevance
          FROM radio_topics GROUP BY topic ORDER BY count DESC LIMIT 20
        `);
        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Radio topics', err, []);
      }
    }

    if (type === 'radio-political') {
      try {
        const data = await executeQuery(`
          SELECT
            CASE WHEN is_political = true AND is_ad = true THEN 'political_ad'
                 WHEN is_political = true THEN 'political_news'
                 ELSE 'apolitical' END as category,
            COUNT(*) as count
          FROM radio_transcripts GROUP BY category ORDER BY count DESC
        `);
        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Radio political', err, []);
      }
    }

    if (type === 'radio-transcripts') {
      try {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const search = url.searchParams.get('search');
        const political = url.searchParams.get('political');

        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (search) {
          conditions.push(`transcript ILIKE $${paramIndex}`);
          params.push(`%${search}%`);
          paramIndex++;
        }

        if (political !== null && political !== '') {
          conditions.push(`is_political = $${paramIndex}`);
          params.push(political === 'true');
          paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        params.push(limit);
        const limitParam = `$${paramIndex}`;
        paramIndex++;
        params.push(offset);
        const offsetParam = `$${paramIndex}`;

        const data = await executeQuery(`
          SELECT id, radio_name, state, segment_start, segment_end, duration_seconds,
                 transcript, is_political, is_ad,
                 sentiment, emotion, confidence, word_count, topics
          FROM radio_transcripts
          ${whereClause}
          ORDER BY segment_start DESC LIMIT ${limitParam} OFFSET ${offsetParam}
        `, params);
        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Radio transcripts', err, []);
      }
    }

    if (type === 'radio-wordcloud') {
      try {
        const data = await executeQuery(`
          SELECT unnest(topics) as word, COUNT(*) as count
          FROM radio_transcripts WHERE topics IS NOT NULL
          GROUP BY word ORDER BY count DESC LIMIT 50
        `);
        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Radio wordcloud', err, []);
      }
    }

    // ── Investigation query types ────────────────────────────────────

    if (type === 'investigation-timeline') {
      const keywords = url.searchParams.get('keywords') || '';
      const dateStart = url.searchParams.get('date_start');
      const dateEnd = url.searchParams.get('date_end');

      if (!keywords || !dateStart || !dateEnd) {
        return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
      }

      const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

      try {
        // A source whose table does not exist yet contributes empty columns instead of failing the whole timeline
        const [present] = await executeQuery("SELECT to_regclass('gdelt_events') IS NOT NULL AS gdelt, to_regclass('radio_transcripts') IS NOT NULL AS radio");
        const gdeltCte = present?.gdelt === true ? `gdelt AS (
            SELECT TO_DATE(sqldate::text, 'YYYYMMDD') AS d,
              COUNT(*) AS event_count, AVG(goldsteinscale) AS avg_goldstein, AVG(avgtone) AS avg_tone
            FROM gdelt_events
            WHERE sqldate >= CAST(REPLACE($1::text, '-', '') AS INTEGER)
              AND sqldate <= CAST(REPLACE($2::text, '-', '') AS INTEGER)
              AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[])
                   OR actiongeo_fullname ILIKE ANY($3::text[]))
            GROUP BY 1
          ),` : `gdelt AS (SELECT NULL::date AS d, 0::bigint AS event_count, NULL::float8 AS avg_goldstein, NULL::float8 AS avg_tone WHERE false),`;
        const radioCte = present?.radio === true ? `radio AS (
            SELECT DATE(segment_start) AS d, COUNT(*) AS segment_count,
              COUNT(*) FILTER (WHERE sentiment = 'positive') AS positive,
              COUNT(*) FILTER (WHERE sentiment = 'negative') AS negative,
              COUNT(*) FILTER (WHERE sentiment = 'neutral') AS neutral
            FROM radio_transcripts
            WHERE segment_start >= $1::timestamp AND segment_start <= ($2::date + 1)::timestamp
              AND transcript ILIKE ANY($3::text[])
            GROUP BY 1
          ),` : `radio AS (SELECT NULL::date AS d, 0::bigint AS segment_count, 0::bigint AS positive, 0::bigint AS negative, 0::bigint AS neutral WHERE false),`;
        const socialCte = `social AS (
            SELECT DATE(to_timestamp(timestamp/1000)) AS d, COUNT(*) AS post_count,
              COUNT(*) FILTER (WHERE sentiment_category IN ('Positive','Very Positive')) AS positive,
              COUNT(*) FILTER (WHERE sentiment_category IN ('Negative','Very Negative')) AS negative,
              COUNT(*) FILTER (WHERE sentiment_category = 'Neutral') AS neutral
            FROM posts_with_sentiment
            WHERE to_timestamp(timestamp/1000) >= $1::timestamp
              AND to_timestamp(timestamp/1000) <= ($2::date + 1)::timestamp
              AND text ILIKE ANY($3::text[])
            GROUP BY 1
          )`;

        const data = await executeQuery(`
          WITH date_series AS (
            SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS d
          ),
          ${gdeltCte}
          ${radioCte}
          ${socialCte}
          SELECT ds.d as date,
            COALESCE(g.event_count, 0) as gdelt_events, g.avg_goldstein, g.avg_tone,
            COALESCE(r.segment_count, 0) as radio_segments, COALESCE(r.positive, 0) as radio_positive,
            COALESCE(r.negative, 0) as radio_negative, COALESCE(r.neutral, 0) as radio_neutral,
            COALESCE(s.post_count, 0) as social_posts, COALESCE(s.positive, 0) as social_positive,
            COALESCE(s.negative, 0) as social_negative, COALESCE(s.neutral, 0) as social_neutral
          FROM date_series ds
          LEFT JOIN gdelt g ON g.d = ds.d LEFT JOIN radio r ON r.d = ds.d LEFT JOIN social s ON s.d = ds.d
          ORDER BY ds.d
        `, [dateStart, dateEnd, keywordsArray]);

        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Investigation timeline', err, []);
      }
    }

    if (type === 'investigation-gdelt-events') {
      const keywords = url.searchParams.get('keywords') || '';
      const dateStart = url.searchParams.get('date_start');
      const dateEnd = url.searchParams.get('date_end');
      const limit = parseInt(url.searchParams.get('limit') || '100');

      if (!keywords || !dateStart || !dateEnd) {
        return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
      }

      const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

      try {
        const data = await executeQuery(`
          SELECT * FROM (
            SELECT DISTINCT ON (globaleventid) globaleventid, sqldate, actor1name, actor2name,
              eventcode, eventrootcode, quadclass, goldsteinscale, nummentions, numsources, numarticles, avgtone,
              actor1countrycode, actor2countrycode,
              actiongeo_fullname, actiongeo_lat, actiongeo_long, sourceurl
            FROM gdelt_events
            WHERE sqldate >= CAST(REPLACE($1::text, '-', '') AS INTEGER)
              AND sqldate <= CAST(REPLACE($2::text, '-', '') AS INTEGER)
              AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[])
                   OR actiongeo_fullname ILIKE ANY($3::text[]))
            ORDER BY globaleventid
          ) deduped
          ORDER BY sqldate DESC, nummentions DESC
          LIMIT $4
        `, [dateStart, dateEnd, keywordsArray, limit]);

        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Investigation GDELT events', err, []);
      }
    }

    if (type === 'investigation-radio-segments') {
      const keywords = url.searchParams.get('keywords') || '';
      const dateStart = url.searchParams.get('date_start');
      const dateEnd = url.searchParams.get('date_end');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      if (!keywords || !dateStart || !dateEnd) {
        return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
      }

      const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

      try {
        const data = await executeQuery(`
          SELECT id, radio_name, state, segment_start, segment_end, duration_seconds,
            transcript, sentiment, emotion, confidence,
            is_political, is_ad, word_count
          FROM radio_transcripts
          WHERE segment_start >= $1::timestamp AND segment_start <= ($2::date + 1)::timestamp
            AND transcript ILIKE ANY($3::text[])
          ORDER BY segment_start DESC
          LIMIT $4
        `, [dateStart, dateEnd, keywordsArray, limit]);

        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Investigation radio segments', err, []);
      }
    }

    if (type === 'investigation-social-posts') {
      const keywords = url.searchParams.get('keywords') || '';
      const dateStart = url.searchParams.get('date_start');
      const dateEnd = url.searchParams.get('date_end');
      const limit = parseInt(url.searchParams.get('limit') || '100');

      if (!keywords || !dateStart || !dateEnd) {
        return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
      }

      const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

      try {
        const data = await executeQuery(`
          SELECT id, text, timestamp, platform, author,
            sentiment_category, confidence_score, emotions,
            engagement_likes, engagement_shares, engagement_comments
          FROM posts_with_sentiment
          WHERE to_timestamp(timestamp/1000) >= $1::timestamp
            AND to_timestamp(timestamp/1000) <= ($2::date + 1)::timestamp
            AND text ILIKE ANY($3::text[])
          ORDER BY timestamp DESC
          LIMIT $4
        `, [dateStart, dateEnd, keywordsArray, limit]);

        return json({ success: true, data });
      } catch (err) {
        return queryErrorResponse('Investigation social posts', err, []);
      }
    }

    if (type === 'investigation-keyword-overlap') {
      const keywords = url.searchParams.get('keywords') || '';
      const dateStart = url.searchParams.get('date_start');
      const dateEnd = url.searchParams.get('date_end');

      if (!keywords || !dateStart || !dateEnd) {
        return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
      }

      const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

      try {
        const data = await executeQuery(`
          WITH gdelt_mentions AS (
            SELECT kw AS keyword, 'gdelt' AS source, COUNT(*) AS mention_count
            FROM gdelt_events
            CROSS JOIN unnest($3::text[]) AS kw
            WHERE sqldate >= CAST(REPLACE($1::text, '-', '') AS INTEGER)
              AND sqldate <= CAST(REPLACE($2::text, '-', '') AS INTEGER)
              AND (actor1name ILIKE kw OR actor2name ILIKE kw OR actiongeo_fullname ILIKE kw)
            GROUP BY kw
          ),
          radio_mentions AS (
            SELECT kw AS keyword, 'radio' AS source, COUNT(*) AS mention_count
            FROM radio_transcripts
            CROSS JOIN unnest($3::text[]) AS kw
            WHERE segment_start >= $1::timestamp AND segment_start <= ($2::date + 1)::timestamp
              AND transcript ILIKE kw
            GROUP BY kw
          ),
          social_mentions AS (
            SELECT kw AS keyword, 'social' AS source, COUNT(*) AS mention_count
            FROM posts_with_sentiment
            CROSS JOIN unnest($3::text[]) AS kw
            WHERE to_timestamp(timestamp/1000) >= $1::timestamp
              AND to_timestamp(timestamp/1000) <= ($2::date + 1)::timestamp
              AND text ILIKE kw
            GROUP BY kw
          ),
          combined AS (
            SELECT * FROM gdelt_mentions
            UNION ALL
            SELECT * FROM radio_mentions
            UNION ALL
            SELECT * FROM social_mentions
          )
          SELECT
            REPLACE(keyword, '%', '') AS keyword,
            COALESCE(SUM(mention_count) FILTER (WHERE source = 'gdelt'), 0) AS gdelt_count,
            COALESCE(SUM(mention_count) FILTER (WHERE source = 'radio'), 0) AS radio_count,
            COALESCE(SUM(mention_count) FILTER (WHERE source = 'social'), 0) AS social_count
          FROM combined
          GROUP BY keyword
          ORDER BY (COALESCE(SUM(mention_count) FILTER (WHERE source = 'gdelt'), 0) + COALESCE(SUM(mention_count) FILTER (WHERE source = 'radio'), 0) + COALESCE(SUM(mention_count) FILTER (WHERE source = 'social'), 0)) DESC
        `, [dateStart, dateEnd, keywordsArray]);

        return json({ success: true, data: data || [] });
      } catch (err) {
        return queryErrorResponse('Investigation keyword overlap', err, []);
      }
    }

    if (type === 'investigation-locations') {
      const keywords = url.searchParams.get('keywords') || '';
      const dateStart = url.searchParams.get('date_start');
      const dateEnd = url.searchParams.get('date_end');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      if (!keywords || !dateStart || !dateEnd) {
        return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
      }

      const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

      try {
        const data = await executeQuery(`
          SELECT actiongeo_fullname AS location,
            actiongeo_countrycode AS country_code,
            ROUND(AVG(actiongeo_lat::numeric), 4) AS lat,
            ROUND(AVG(actiongeo_long::numeric), 4) AS lng,
            COUNT(*) AS event_count,
            ROUND(AVG(avgtone::numeric), 2) AS avg_tone,
            ROUND(AVG(goldsteinscale::numeric), 2) AS avg_goldstein
          FROM gdelt_events
          WHERE sqldate::text >= REPLACE($1, '-', '')
            AND sqldate::text <= REPLACE($2, '-', '')
            AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[]))
            AND actiongeo_fullname IS NOT NULL AND actiongeo_fullname != ''
          GROUP BY actiongeo_fullname, actiongeo_countrycode
          ORDER BY event_count DESC
          LIMIT $4
        `, [dateStart, dateEnd, keywordsArray, limit]);

        return json({ success: true, data: data || [] });
      } catch (err) {
        return queryErrorResponse('Investigation locations', err, []);
      }
    }

    if (type === 'investigation-actors') {
      const keywords = url.searchParams.get('keywords') || '';
      const dateStart = url.searchParams.get('date_start');
      const dateEnd = url.searchParams.get('date_end');
      const limit = parseInt(url.searchParams.get('limit') || '30');

      if (!keywords || !dateStart || !dateEnd) {
        return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
      }

      const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

      try {
        const data = await executeQuery(`
          WITH actor_mentions AS (
            SELECT actor1name AS actor, actor1countrycode AS country_code, avgtone, goldsteinscale
            FROM gdelt_events
            WHERE sqldate::text >= REPLACE($1, '-', '')
              AND sqldate::text <= REPLACE($2, '-', '')
              AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[]))
              AND actor1name IS NOT NULL AND actor1name != ''
            UNION ALL
            SELECT actor2name AS actor, actor2countrycode AS country_code, avgtone, goldsteinscale
            FROM gdelt_events
            WHERE sqldate::text >= REPLACE($1, '-', '')
              AND sqldate::text <= REPLACE($2, '-', '')
              AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[]))
              AND actor2name IS NOT NULL AND actor2name != ''
          )
          SELECT actor, country_code,
            COUNT(*) AS mention_count,
            ROUND(AVG(avgtone::numeric), 2) AS avg_tone,
            ROUND(AVG(goldsteinscale::numeric), 2) AS avg_goldstein
          FROM actor_mentions
          GROUP BY actor, country_code
          ORDER BY mention_count DESC
          LIMIT $4
        `, [dateStart, dateEnd, keywordsArray, limit]);

        // Also get co-occurrence pairs
        const pairs = await executeQuery(`
          SELECT actor1name AS source_actor, actor2name AS target_actor, COUNT(*) AS weight
          FROM gdelt_events
          WHERE sqldate::text >= REPLACE($1, '-', '')
            AND sqldate::text <= REPLACE($2, '-', '')
            AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[]))
            AND actor1name IS NOT NULL AND actor1name != ''
            AND actor2name IS NOT NULL AND actor2name != ''
          GROUP BY actor1name, actor2name
          ORDER BY weight DESC
          LIMIT 50
        `, [dateStart, dateEnd, keywordsArray]);

        return json({ success: true, data: { actors: data || [], pairs: pairs || [] } });
      } catch (err) {
        return queryErrorResponse('Investigation actors', err, { actors: [], pairs: [] });
      }
    }

    // Default response for unsupported query types
    return json({
      success: true,
      data: [],
      message: `Query type '${type}' not implemented yet`,
      endpoints: {
        test: '/api/unified-analytics?type=test',
        'cross-platform-sentiment': '/api/unified-analytics?type=cross-platform-sentiment',
        'sentiment-trends': '/api/unified-analytics?type=sentiment-trends',
        'radio-overview': '/api/unified-analytics?type=radio-overview',
        'radio-sentiment': '/api/unified-analytics?type=radio-sentiment',
        'radio-by-station': '/api/unified-analytics?type=radio-by-station',
        'radio-trends': '/api/unified-analytics?type=radio-trends',
        'radio-topics': '/api/unified-analytics?type=radio-topics',
        'radio-political': '/api/unified-analytics?type=radio-political',
        'radio-transcripts': '/api/unified-analytics?type=radio-transcripts',
        'radio-wordcloud': '/api/unified-analytics?type=radio-wordcloud',
        'investigation-timeline': '/api/unified-analytics?type=investigation-timeline&keywords=...&date_start=...&date_end=...',
        'investigation-gdelt-events': '/api/unified-analytics?type=investigation-gdelt-events&keywords=...&date_start=...&date_end=...',
        'investigation-radio-segments': '/api/unified-analytics?type=investigation-radio-segments&keywords=...&date_start=...&date_end=...',
        'investigation-social-posts': '/api/unified-analytics?type=investigation-social-posts&keywords=...&date_start=...&date_end=...',
        'investigation-keyword-overlap': '/api/unified-analytics?type=investigation-keyword-overlap&keywords=...&date_start=...&date_end=...'
      }
    });
  } catch (err) {
    return queryErrorResponse('Unified analytics request', err, []);
  }
};