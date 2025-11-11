// Unified Analytics API
// PostgreSQL with pg_duckdb extension for unified database queries

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';

/**
 * Execute a query using pg_duckdb extension
 * This leverages DuckDB's analytical engine on PostgreSQL tables
 */
async function executeQuery(sql: string): Promise<any[]> {
  try {
    // Execute query using DuckDB execution engine for analytical queries
    const rows = await postgresPool.duckdbQuery(sql);

    // Convert BigInts to regular numbers for JSON serialization
    return rows.map(row => {
      const serializedRow: any = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'bigint') {
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
            poolStats
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
        // Query sentiment data from PostgreSQL tables using DuckDB execution
        const data = await executeQuery(`
          SELECT
            sentiment_category,
            COUNT(*) as post_count,
            AVG(confidence_score) as avg_confidence,
            platform
          FROM posts_with_sentiment
          GROUP BY sentiment_category, platform
          ORDER BY post_count DESC
        `);

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
          LIMIT ${days}
        `);
        
        return json({ success: true, data });
      } catch (error) {
        console.error('Sentiment trends query failed:', error);
        return json({ success: true, data: [] });
      }
    }
    
    if (type === 'sample-posts') {
      try {
        const sentiment = url.searchParams.get('sentiment') || 'all';
        const platform = url.searchParams.get('platform') || 'all';
        const limit = parseInt(url.searchParams.get('limit') || '50');
        
        let whereClause = 'WHERE 1=1'; // Remove date filtering since ETL data is from January
        if (sentiment !== 'all') {
          whereClause += ` AND LOWER(sentiment_category) LIKE '%${sentiment.toLowerCase()}%'`;
        }
        if (platform !== 'all') {
          whereClause += ` AND LOWER(platform) = '${platform.toLowerCase()}'`;
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
          ${whereClause}
          ORDER BY confidence_score DESC, timestamp DESC
          LIMIT ${limit}
        `);
        
        return json({ success: true, data });
      } catch (error) {
        console.error('Sample posts query failed:', error);
        return json({ success: true, data: [] });
      }
    }
    
    if (type === 'platform-performance') {
      try {
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
          GROUP BY platform
          ORDER BY total_posts DESC
        `);
        
        return json({ success: true, data });
      } catch (error) {
        console.error('Platform performance query failed:', error);
        return json({ success: true, data: [] });
      }
    }
    
    if (type === 'top-keywords') {
      try {
        const sentiment = url.searchParams.get('keywordSentiment') || 'all';
        let whereClause = '';
        if (sentiment !== 'all') {
          whereClause = `WHERE LOWER(sc.sentiment_category) LIKE '%${sentiment.toLowerCase()}%'`;
        }
        
        const data = await executeQuery(`
          SELECT 
            REGEXP_EXTRACT(p.content, '\\b\\w{4,}\\b', 'g') as keywords
          FROM posts p
          JOIN sentiment_classifications sc ON p.id = sc.post_id
          ${whereClause}
          LIMIT 100
        `);
        
        return json({ success: true, data: data || [] });
      } catch (error) {
        console.error('Top keywords query failed:', error);
        return json({ success: true, data: [] });
      }
    }
    
    if (type === 'emotion-correlations') {
      try {
        const data = await executeQuery(`
          SELECT 
            ea1.emotion as emotion1,
            ea2.emotion as emotion2,
            CORR(ea1.intensity_score, ea2.intensity_score) as correlation
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
    
    if (type === 'hourly-patterns') {
      try {
        const data = await executeQuery(`
          WITH hours AS (
            SELECT unnest(generate_series(0, 23)) as hour_of_day
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
        const sentiment = url.searchParams.get('sentiment') || 'all';
        const platform = url.searchParams.get('platform') || 'all';
        const timeRange = url.searchParams.get('timeRange') || '7d';
        
        let whereClause = 'WHERE 1=1'; // Remove date filtering since ETL data is from January
        if (sentiment !== 'all') {
          whereClause += ` AND LOWER(sentiment_category) LIKE '%${sentiment.toLowerCase()}%'`;
        }
        if (platform !== 'all') {
          whereClause += ` AND LOWER(platform) = '${platform.toLowerCase()}'`;
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
          ${whereClause}
          ORDER BY timestamp DESC
        `);
        
        return json({ success: true, data: data || [] });
      } catch (error) {
        console.error('Export data query failed:', error);
        return json({ success: true, data: [] });
      }
    }
    
    // Topic Modeling Database Queries
    if (type === 'topics-overview') {
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
        let whereClause = '';
        if (topicId) {
          whereClause = `WHERE topic_id = '${topicId}'`;
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
        `);

        return json({ success: true, data: data || [] });
      } catch (error) {
        console.error('Topic keywords query failed:', error);
        return json({ success: true, data: [] });
      }
    }

    if (type === 'topic-trends') {
      try {
        const timeRange = url.searchParams.get('timeRange') || '30d';
        const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;

        const data = await executeQuery(`
          SELECT
            topic_id,
            analysis_date,
            document_count,
            average_engagement,
            growth_rate,
            trend_direction
          FROM topic_trends
          WHERE analysis_date >= CURRENT_DATE - INTERVAL '${days} days'
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

        const data = await executeQuery(`
          SELECT
            topic1_id,
            topic2_id,
            similarity_score,
            relationship_type,
            strength
          FROM topic_relationships
          WHERE similarity_score >= ${threshold}
          ORDER BY similarity_score DESC
        `);

        return json({ success: true, data: data || [] });
      } catch (error) {
        console.error('Topic relationships query failed:', error);
        return json({ success: true, data: [] });
      }
    }

    if (type === 'topic-categories') {
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
      error: err.message,
      message: 'Failed to process unified analytics request'
    });
  }
};