// Unified Analytics API
// PostgreSQL with pg_duckdb extension for unified database queries

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';
import { resolveWorkspaceScope, buildPlatformFilter, hasDataType } from '$lib/services/workspaceContextResolver';

/**
 * Execute a query using pg_duckdb extension
 * This leverages DuckDB's analytical engine on PostgreSQL tables
 */
async function executeQuery(sql: string, params: any[] = []): Promise<any[]> {
  try {
    // Execute query using DuckDB execution engine for analytical queries
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
      'record_count', 'health'
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
  } catch (error) {
    console.error(`PostgreSQL/DuckDB query error:`, error);
    return [];
  }
}

/**
 * GET /api/unified-analytics
 * Test connection and basic queries for unified analytics
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const type = url.searchParams.get('type');

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

        // Date range filter
        const dateStart = url.searchParams.get('date_start');
        const dateEnd = url.searchParams.get('date_end');
        if (dateStart) {
          conditions.push(`timestamp >= $${paramIndex}`);
          params.push(dateStart);
          paramIndex++;
        }
        if (dateEnd) {
          conditions.push(`timestamp <= $${paramIndex}`);
          params.push(dateEnd);
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
        console.error('Cross-platform sentiment query failed:', error);
        return json({ success: true, data: [] });
      }
    }
    
    if (type === 'sentiment-trends') {
      try {
        const timeRange = url.searchParams.get('timeRange') || '7d';
        const days = timeRange === '30d' ? 30 : timeRange === '14d' ? 14 : 7;
        
        const data = await executeQuery(`
          SELECT
            DATE(stt.analysis_date) as date,
            SUM(stt.positive_count) as positive,
            SUM(stt.negative_count) as negative,
            SUM(stt.neutral_count) as neutral,
            SUM(stt.total_posts) as total_posts
          FROM sentiment_temporal_trends stt
          GROUP BY DATE(stt.analysis_date)
          ORDER BY DATE(stt.analysis_date) DESC
          LIMIT $1
        `, [days]);
        
        return json({ success: true, data });
      } catch (error) {
        console.error('Sentiment trends query failed:', error);
        return json({ success: true, data: [] });
      }
    }
    
    if (type === 'sample-posts') {
      try {
        if (scope && !scope.hasSocialMedia) return json({ success: true, data: [] });
        const sentiment = url.searchParams.get('sentiment') || 'all';
        const platform = url.searchParams.get('platform') || 'all';
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 50;

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
        console.error('Sample posts query failed:', error);
        return json({ success: true, data: [] });
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
        console.error('Platform performance query failed:', error);
        return json({ success: true, data: [] });
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
        console.error('Top keywords query failed:', error);
        return json({ success: true, data: [] });
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
        console.error('Emotion correlations query failed:', error);
        return json({ success: true, data: [] });
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
        console.error('Emotion stats query failed:', error);
        return json({ success: true, data: [] });
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
        console.error('Sentiment keywords query failed:', error);
        return json({ success: true, data: [] });
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
        console.error('Hourly patterns query failed:', error);
        return json({ success: true, data: [] });
      }
    }
    
    if (type === 'export-data') {
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
        `, params);
        
        return json({ success: true, data: data || [] });
      } catch (error) {
        console.error('Export data query failed:', error);
        return json({ success: true, data: [] });
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
        console.error('Topics overview query failed:', error);
        return json({ success: true, data: [] });
      }
    }

    if (type === 'topic-keywords') {
      try {
        const topicId = url.searchParams.get('topicId');
        const params: any[] = [];
        let whereClause = '';
        if (topicId) {
          params.push(topicId);
          whereClause = `WHERE topic_id = $1`;
        }

        const data = await executeQuery(`
          SELECT
            topic_id,
            keyword,
            weight,
            rank_position
          FROM topic_keywords
          ${whereClause}
          ORDER BY topic_id, rank_position
        `, params);

        return json({ success: true, data: data || [] });
      } catch (error) {
        console.error('Topic keywords query failed:', error);
        return json({ success: true, data: [] });
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
        console.error('Topic trends query failed:', error);
        return json({ success: true, data: [] });
      }
    }

    if (type === 'topic-relationships') {
      try {
        const threshold = parseFloat(url.searchParams.get('threshold') || '0.5');
        const safeThreshold = Number.isFinite(threshold) ? threshold : 0.5;

        const data = await executeQuery(`
          SELECT
            topic1_id,
            topic2_id,
            similarity_score,
            relationship_type,
            strength
          FROM topic_relationships
          WHERE similarity_score >= $1
          ORDER BY similarity_score DESC
        `, [safeThreshold]);

        return json({ success: true, data: data || [] });
      } catch (error) {
        console.error('Topic relationships query failed:', error);
        return json({ success: true, data: [] });
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
        console.error('Topic categories query failed:', error);
        return json({ success: true, data: [] });
      }
    }
    
    // ─── Language Detection Endpoints ─────────────────────────────────────
    if (type === 'language-stats') {
      try {
        const data = await executeQuery(`
          SELECT
            l.code as language_code,
            l.name as language,
            COUNT(ld.id) as post_count,
            AVG(ld.confidence) as confidence
          FROM language_detection ld
          JOIN languages l ON ld.language_code = l.code
          GROUP BY l.code, l.name
          ORDER BY post_count DESC
        `);
        return json({ success: true, data });
      } catch (error) {
        console.error('Language stats query failed:', error);
        return json({ success: true, data: [] });
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
        console.error('Language trends query failed:', error);
        return json({ success: true, data: [] });
      }
    }

    if (type === 'language-detection-detail') {
      try {
        const langCode = url.searchParams.get('language') || 'all';
        const params: any[] = [];
        let whereClause = '';
        if (langCode !== 'all') {
          params.push(langCode);
          whereClause = `WHERE ld.language_code = $1`;
        }
        const data = await executeQuery(`
          SELECT
            ld.document_id,
            ld.document_source,
            ld.language_code,
            ld.confidence,
            l.name as language_name
          FROM language_detection ld
          JOIN languages l ON ld.language_code = l.code
          ${whereClause}
          ORDER BY ld.confidence DESC
          LIMIT 100
        `, params);
        return json({ success: true, data });
      } catch (error) {
        console.error('Language detection detail query failed:', error);
        return json({ success: true, data: [] });
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
        console.error('GDELT summary failed:', error);
        return json({ success: true, data: [] });
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
        console.error('GDELT by country failed:', error);
        return json({ success: true, data: [] });
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
        console.error('GDELT by event type failed:', error);
        return json({ success: true, data: [] });
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
        console.error('GDELT timeline failed:', error);
        return json({ success: true, data: [] });
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
        console.error('GDELT top actors failed:', error);
        return json({ success: true, data: [] });
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
        console.error('GDELT country detail failed:', error);
        return json({ success: true, data: {} });
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
        console.error('GDELT conflicts failed:', error);
        return json({ success: true, data: [] });
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
        console.error('GDELT search failed:', error);
        return json({ success: true, data: {} });
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

    if (type === 'hashtag-analysis') {
      try {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const wsId = url.searchParams.get('workspace_id');

        // Only apply platform filter if workspace is specified
        let platformFilter = '';
        const params: any[] = [];
        let paramIndex = 1;

        if (wsId) {
          const scope = await resolveWorkspaceScope(url);
          if (scope.hasSocialMedia && scope.socialPlatforms.length > 0) {
            platformFilter = `AND media_type = ANY($${paramIndex})`;
            params.push(scope.socialPlatforms);
            paramIndex++;
          }
        }

        params.push(limit);

        // Extract hashtags from posts using regex
        const data = await executeQuery(`
          WITH hashtag_extract AS (
            SELECT
              unnest(regexp_matches(content, '#([A-Za-z0-9_]+)', 'g')) as hashtag,
              post_id,
              media_type
            FROM silver.posts
            WHERE content IS NOT NULL
              AND content LIKE '%#%'
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
          LIMIT $${paramIndex}
        `, params);

        // Also get hashtag co-occurrence (top pairs)
        const cooccurrence = await executeQuery(`
          WITH hashtag_extract AS (
            SELECT
              post_id,
              unnest(regexp_matches(content, '#([A-Za-z0-9_]+)', 'g')) as hashtag
            FROM silver.posts
            WHERE content IS NOT NULL AND content LIKE '%#%'
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
        `, platformFilter ? params.slice(0, -1) : []);

        return json({
          success: true,
          data: {
            hashtags: data,
            cooccurrence,
            totalHashtags: data.length,
            totalPosts: data.reduce((sum: number, h: any) => sum + parseInt(h.post_count || 0), 0)
          }
        });
      } catch (error: any) {
        console.error('Hashtag analysis failed:', error);
        return json({ success: true, data: { hashtags: [], cooccurrence: [], totalHashtags: 0, totalPosts: 0 } });
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

    if (type === 'datasets') {
      // Return mock datasets for now since we don't have real data tables yet
      return json({
        success: true,
        datasets: [
          {
            id: 'sample_social',
            name: 'Sample Social Media Data',
            description: 'Sample dataset for testing workflows',
            table: 'posts',
            type: 'sample'
          }
        ]
      });
    }
    
    // Default response for unsupported query types
    return json({
      success: true,
      data: [],
      message: `Query type '${type}' not implemented yet`,
      endpoints: {
        test: '/api/unified-analytics?type=test',
        datasets: '/api/unified-analytics?type=datasets',
        'cross-platform-sentiment': '/api/unified-analytics?type=cross-platform-sentiment',
        'sentiment-trends': '/api/unified-analytics?type=sentiment-trends'
      }
    });
  } catch (err) {
    console.error('Unified analytics API error:', err);
    return json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      message: 'Failed to process unified analytics request'
    });
  }
};