// Server-side API endpoint for Sentiment Analysis DuckDB queries
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import path from 'path';

// Path to the DuckDB database file in the ETL directory
const DB_PATH = path.resolve('../etl/sentiment_analysis.db');

// Simple mutex to handle concurrent database access
class DatabaseMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

const dbMutex = new DatabaseMutex();

// Execute DuckDB query using CLI with CSV output (with concurrency control)
async function executeDuckDBQuery(sql: string): Promise<any[]> {
  await dbMutex.acquire();
  
  try {
    return await new Promise((resolve, reject) => {
      const duckdb = spawn('duckdb', [DB_PATH, '-csv'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      duckdb.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      duckdb.stderr.on('data', (data: Buffer) => {
        error += data.toString();
      });

      duckdb.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`DuckDB process exited with code ${code}: ${error}`));
          return;
        }

        try {
          const lines = output.trim().split('\n');
          
          if (lines.length < 2) {
            resolve([]);
            return;
          }

          // Parse CSV output
          const headers = lines[0].split(',').map(h => h.trim());
          const results = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {};
            
            headers.forEach((header, index) => {
              const value = values[index]?.trim();
              // Convert numeric values
              if (value && !isNaN(Number(value))) {
                row[header] = Number(value);
              } else {
                row[header] = value || null;
              }
            });
            
            results.push(row);
          }

          resolve(results);
        } catch (parseError) {
          console.error('Parse error:', parseError, 'Output:', output);
          resolve([]); // Return empty array instead of rejecting
        }
      });

      // Send SQL query
      duckdb.stdin.write(sql + '\n');
      duckdb.stdin.end();
    });
  } finally {
    dbMutex.release();
  }
}

// Initialize Sentiment Analysis schema if needed
async function initializeSchema(): Promise<void> {
  try {
    // Check if sentiment tables exist
    const checkTables = `
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_name IN ('sentiment_posts', 'sentiment_classifications', 'emotion_analysis')
    `;
    
    const result = await executeDuckDBQuery(checkTables);
    const tableCount = result[0]?.table_count || 0;
    
    if (tableCount < 3) {
      // Load schema from file
      const fs = await import('fs');
      const schemaPath = path.resolve('./sentiment_analysis_schema.sql');
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      await executeDuckDBQuery(schemaSQL);
      console.log('Sentiment Analysis schema initialized');
    }
  } catch (error) {
    console.warn('Schema initialization failed:', error);
    // Continue with existing schema
  }
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const queryType = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const timeRange = url.searchParams.get('timeRange') || '7d';
    const sentiment = url.searchParams.get('sentiment') || 'all';
    const platform = url.searchParams.get('platform') || 'all';
    const confidenceThreshold = parseFloat(url.searchParams.get('confidenceThreshold') || '0.7');

    // Initialize schema if needed
    await initializeSchema();

    let sql = '';
    let results: any[] = [];

    switch (queryType) {
      case 'test':
        // Test connection
        sql = 'SELECT 1 as test_result';
        break;

      case 'sentiment-stats':
        // Get overall sentiment statistics
        sql = `
          SELECT 
            positive_count,
            negative_count,
            neutral_count,
            total_posts,
            positive_percentage,
            negative_percentage,
            neutral_percentage,
            avg_confidence
          FROM sentiment_overview
        `;
        break;

      case 'detailed-sentiments':
        // Get detailed sentiment breakdown
        sql = `
          SELECT 
            sentiment_category as label,
            count,
            percentage,
            color
          FROM sentiment_detailed
          ORDER BY count DESC
        `;
        break;

      case 'emotion-stats':
        // Get emotion analysis statistics
        sql = `
          SELECT 
            emotion,
            count,
            percentage,
            color
          FROM emotion_summary
          ORDER BY count DESC
        `;
        break;

      case 'sentiment-trends':
        // Get sentiment trends over time
        const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 7;
        sql = `
          SELECT 
            date,
            positive,
            negative,
            neutral,
            total_posts
          FROM daily_sentiment_trends
          ORDER BY date DESC
          LIMIT ${days}
        `;
        break;

      case 'sample-posts':
        // Get sample posts with sentiment analysis
        let whereClause = '';
        const conditions = [];

        if (sentiment !== 'all') {
          conditions.push(`sc.sentiment_category = '${sentiment}'`);
        }
        
        if (platform !== 'all') {
          conditions.push(`sp.platform = '${platform}'`);
        }
        
        if (confidenceThreshold > 0) {
          conditions.push(`sc.confidence_score >= ${confidenceThreshold}`);
        }

        if (conditions.length > 0) {
          whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        sql = `
          SELECT 
            sp.id,
            sp.text,
            sc.sentiment_category as sentiment,
            sc.confidence_score as confidence,
            GROUP_CONCAT(ea.emotion) as emotions,
            sp.platform,
            sp.timestamp,
            sp.engagement_likes as likes,
            sp.engagement_shares as shares,
            sp.engagement_comments as comments
          FROM sentiment_posts sp
          JOIN sentiment_classifications sc ON sp.id = sc.post_id
          LEFT JOIN emotion_analysis ea ON sp.id = ea.post_id
          ${whereClause}
          GROUP BY sp.id, sp.text, sc.sentiment_category, sc.confidence_score, sp.platform, sp.timestamp, sp.engagement_likes, sp.engagement_shares, sp.engagement_comments
          ORDER BY sp.timestamp DESC
          LIMIT ${limit}
        `;
        break;

      case 'platform-performance':
        // Get platform sentiment performance
        sql = `
          SELECT 
            platform,
            total_posts,
            positive_percentage,
            negative_percentage,
            neutral_percentage,
            avg_confidence,
            avg_engagement_score
          FROM platform_performance_summary
          ORDER BY avg_engagement_score DESC
        `;
        break;

      case 'top-keywords':
        // Get top sentiment keywords
        const keywordSentiment = url.searchParams.get('keywordSentiment') || 'all';
        let keywordWhere = '';
        
        if (keywordSentiment !== 'all') {
          keywordWhere = `WHERE sentiment_type = '${keywordSentiment}'`;
        }

        sql = `
          SELECT 
            keyword,
            sentiment_type,
            frequency,
            impact_score
          FROM top_sentiment_keywords
          ${keywordWhere}
          ORDER BY frequency DESC, impact_score DESC
          LIMIT ${limit}
        `;
        break;

      case 'emotion-correlations':
        // Get emotion correlations
        sql = `
          SELECT 
            emotion1,
            emotion2,
            correlation_score as correlation,
            co_occurrence_count
          FROM emotion_correlations
          ORDER BY correlation_score DESC
          LIMIT ${limit}
        `;
        break;

      case 'hourly-patterns':
        // Get hourly sentiment patterns
        sql = `
          SELECT 
            hour_of_day,
            positive,
            negative,
            neutral,
            total_posts_analyzed,
            pattern_strength
          FROM hourly_sentiment_distribution
          ORDER BY hour_of_day
        `;
        break;

      case 'export-data':
        // Export sentiment data with filters
        let exportWhereClause = '';
        const exportConditions = [];

        if (sentiment !== 'all') {
          exportConditions.push(`sc.sentiment_category = '${sentiment}'`);
        }
        
        if (platform !== 'all') {
          exportConditions.push(`sp.platform = '${platform}'`);
        }
        
        if (confidenceThreshold > 0) {
          exportConditions.push(`sc.confidence_score >= ${confidenceThreshold}`);
        }

        if (exportConditions.length > 0) {
          exportWhereClause = 'WHERE ' + exportConditions.join(' AND ');
        }

        sql = `
          SELECT 
            sp.text,
            sc.sentiment_category as sentiment,
            sc.confidence_score as confidence,
            GROUP_CONCAT(ea.emotion, ';') as emotions,
            sp.platform,
            sp.timestamp,
            sp.engagement_likes,
            sp.engagement_shares,
            sp.engagement_comments
          FROM sentiment_posts sp
          JOIN sentiment_classifications sc ON sp.id = sc.post_id
          LEFT JOIN emotion_analysis ea ON sp.id = ea.post_id
          ${exportWhereClause}
          GROUP BY sp.id, sp.text, sc.sentiment_category, sc.confidence_score, sp.platform, sp.timestamp, sp.engagement_likes, sp.engagement_shares, sp.engagement_comments
          ORDER BY sp.timestamp DESC
          LIMIT 10000
        `;
        break;

      default:
        return json({ error: 'Invalid query type' }, { status: 400 });
    }

    results = await executeDuckDBQuery(sql);
    
    return json({
      success: true,
      data: results,
      query: queryType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sentiment Analysis query error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      data: [] 
    }, { status: 500 });
  }
};