// Server-side API endpoint for Hashtag Analysis DuckDB queries
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import path from 'path';

// Path to the DuckDB database file in the ETL directory
const DB_PATH = path.resolve('../etl/hashtag_analysis.db');

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
            const row: Record<string, any> = {};
            
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

// Initialize Hashtag Analysis schema if needed
async function initializeSchema(): Promise<void> {
  try {
    // Check if hashtag analysis tables exist
    const checkTables = `
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_name IN ('hashtag_posts', 'hashtags', 'post_hashtags')
    `;
    
    const result = await executeDuckDBQuery(checkTables);
    const tableCount = result[0]?.table_count || 0;
    
    if (tableCount < 3) {
      // Load schema from file
      const fs = await import('fs');
      const schemaPath = path.resolve('./hashtag_analysis_schema.sql');
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      await executeDuckDBQuery(schemaSQL);
      console.log('Hashtag Analysis schema initialized');
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
    const platform = url.searchParams.get('platform') || 'all';
    const sentiment = url.searchParams.get('sentiment') || 'all';
    const trend = url.searchParams.get('trend') || 'all';
    const timeRange = url.searchParams.get('timeRange') || '7d';
    const minEngagement = parseFloat(url.searchParams.get('minEngagement') || '0');

    // Initialize schema if needed
    await initializeSchema();

    let sql = '';
    let results: any[] = [];

    switch (queryType) {
      case 'test':
        // Test connection
        sql = 'SELECT 1 as test_result';
        break;

      case 'hashtag-stats':
        // Get overall hashtag statistics
        sql = `
          SELECT 
            COUNT(DISTINCT h.id) as total_hashtags,
            COUNT(DISTINCT CASE WHEN h.is_trending = TRUE THEN h.id END) as trending_hashtags,
            SUM(hp.reach) as total_reach,
            AVG(CASE 
              WHEN hp.reach > 0 THEN 
                ((hp.likes_count + hp.shares_count + hp.comments_count) * 100.0 / hp.reach)
              ELSE 0 
            END) as average_engagement
          FROM hashtags h
          LEFT JOIN post_hashtags ph ON h.id = ph.hashtag_id
          LEFT JOIN hashtag_posts hp ON ph.post_id = hp.id
          WHERE hp.timestamp >= (EXTRACT(EPOCH FROM DATE('now', '-7 days')) * 1000)
        `;
        break;

      case 'trending-hashtags':
        // Get trending hashtags with filters
        let whereConditions = [];
        
        if (platform !== 'all') {
          whereConditions.push(`hp.platform = '${platform}'`);
        }
        
        if (sentiment !== 'all') {
          whereConditions.push(`dominant_sentiment = '${sentiment}'`);
        }
        
        if (trend !== 'all') {
          whereConditions.push(`trend_direction = '${trend}'`);
        }
        
        if (minEngagement > 0) {
          whereConditions.push(`avg_engagement_rate >= ${minEngagement}`);
        }
        
        const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : '';
        
        sql = `
          SELECT 
            h.hashtag,
            h.category,
            COUNT(DISTINCT ph.post_id) as count,
            SUM(hp.reach) as reach,
            AVG(CASE 
              WHEN hp.reach > 0 THEN 
                ((hp.likes_count + hp.shares_count + hp.comments_count) * 100.0 / hp.reach)
              ELSE 0 
            END) as engagement,
            CASE 
              WHEN AVG(hs_calc.sentiment_score) >= 0.7 THEN 'positive'
              WHEN AVG(hs_calc.sentiment_score) <= 0.3 THEN 'negative'
              WHEN AVG(hs_calc.sentiment_score) BETWEEN 0.4 AND 0.6 THEN 'neutral'
              ELSE 'mixed'
            END as sentiment,
            COALESCE(ht.trend_direction, 'stable') as trend,
            GROUP_CONCAT(DISTINCT hp.platform) as platforms,
            COALESCE(ht.growth_rate, 0.0) as growth
          FROM hashtags h
          LEFT JOIN post_hashtags ph ON h.id = ph.hashtag_id
          LEFT JOIN hashtag_posts hp ON ph.post_id = hp.id
          LEFT JOIN (
            SELECT hashtag_id, AVG(
              CASE sentiment 
                WHEN 'positive' THEN 0.8
                WHEN 'mixed' THEN 0.5
                WHEN 'neutral' THEN 0.5
                WHEN 'negative' THEN 0.2
                ELSE 0.5
              END
            ) as sentiment_score
            FROM hashtag_sentiment 
            WHERE analysis_date >= DATE('now', '-7 days')
            GROUP BY hashtag_id
          ) hs_calc ON h.id = hs_calc.hashtag_id
          LEFT JOIN (
            SELECT hashtag_id, growth_rate, trend_direction
            FROM hashtag_trends 
            WHERE analysis_date = (
              SELECT MAX(analysis_date) FROM hashtag_trends
            )
          ) ht ON h.id = ht.hashtag_id
          WHERE hp.timestamp >= (EXTRACT(EPOCH FROM DATE('now', '-7 days')) * 1000)
          ${whereClause}
          GROUP BY h.id, h.hashtag, h.category, ht.trend_direction, ht.growth_rate
          HAVING COUNT(DISTINCT ph.post_id) > 0
          ORDER BY COUNT(DISTINCT ph.post_id) DESC
          LIMIT ${limit}
        `;
        break;

      case 'hashtag-trends':
        // Get hashtag trends over time for top hashtags
        const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 7;
        
        sql = `
          WITH top_hashtags AS (
            SELECT h.id, h.hashtag
            FROM hashtags h
            JOIN post_hashtags ph ON h.id = ph.hashtag_id
            JOIN hashtag_posts hp ON ph.post_id = hp.id
            WHERE hp.timestamp >= (EXTRACT(EPOCH FROM DATE('now', '-${days} days')) * 1000)
            GROUP BY h.id, h.hashtag
            ORDER BY COUNT(DISTINCT ph.post_id) DESC
            LIMIT 3
          )
          SELECT 
            ht.analysis_date as date,
            th.hashtag,
            ht.post_count
          FROM hashtag_trends ht
          JOIN top_hashtags th ON ht.hashtag_id = th.id
          WHERE ht.analysis_date >= DATE('now', '-${days} days')
          ORDER BY ht.analysis_date ASC, th.hashtag
        `;
        break;

      case 'sample-posts':
        // Get recent posts with hashtags
        let postWhere = '';
        if (platform !== 'all') {
          postWhere = `AND hp.platform = '${platform}'`;
        }
        
        sql = `
          SELECT 
            hp.id,
            hp.text,
            hp.platform,
            hp.timestamp,
            hp.likes_count,
            hp.shares_count,
            hp.comments_count,
            hp.reach,
            GROUP_CONCAT(h.hashtag) as hashtags
          FROM hashtag_posts hp
          JOIN post_hashtags ph ON hp.id = ph.post_id
          JOIN hashtags h ON ph.hashtag_id = h.id
          WHERE hp.timestamp >= (EXTRACT(EPOCH FROM DATE('now', '-7 days')) * 1000)
          ${postWhere}
          GROUP BY hp.id, hp.text, hp.platform, hp.timestamp, hp.likes_count, hp.shares_count, hp.comments_count, hp.reach
          ORDER BY hp.timestamp DESC
          LIMIT ${limit}
        `;
        break;

      case 'platform-performance':
        // Get hashtag performance by platform
        sql = `
          SELECT 
            hp.platform,
            COUNT(DISTINCT ph.hashtag_id) as hashtag_count,
            COUNT(DISTINCT ph.post_id) as post_count,
            SUM(hp.reach) as total_reach,
            AVG(CASE 
              WHEN hp.reach > 0 THEN 
                ((hp.likes_count + hp.shares_count + hp.comments_count) * 100.0 / hp.reach)
              ELSE 0 
            END) as avg_engagement_rate
          FROM hashtag_posts hp
          JOIN post_hashtags ph ON hp.id = ph.post_id
          WHERE hp.timestamp >= (EXTRACT(EPOCH FROM DATE('now', '-7 days')) * 1000)
          GROUP BY hp.platform
          ORDER BY avg_engagement_rate DESC
          LIMIT ${limit}
        `;
        break;

      case 'hashtag-relationships':
        // Get hashtag co-occurrence relationships
        sql = `
          SELECT 
            h1.hashtag as hashtag1,
            h2.hashtag as hashtag2,
            hr.co_occurrence_count,
            hr.correlation_strength
          FROM hashtag_relationships hr
          JOIN hashtags h1 ON hr.hashtag1_id = h1.id
          JOIN hashtags h2 ON hr.hashtag2_id = h2.id
          WHERE hr.co_occurrence_count >= 2
          ORDER BY hr.correlation_strength DESC
          LIMIT ${limit}
        `;
        break;

      case 'export-data':
        // Export comprehensive hashtag data
        let exportWhere = [];
        
        if (platform !== 'all') {
          exportWhere.push(`hp.platform = '${platform}'`);
        }
        
        if (sentiment !== 'all') {
          exportWhere.push(`hs.sentiment = '${sentiment}'`);
        }
        
        const exportWhereClause = exportWhere.length > 0 ? `AND ${exportWhere.join(' AND ')}` : '';
        
        sql = `
          SELECT 
            h.hashtag,
            h.category,
            hp.text,
            hp.platform,
            hp.timestamp,
            hp.likes_count,
            hp.shares_count,
            hp.comments_count,
            hp.reach,
            hs.sentiment,
            hs.confidence as sentiment_confidence
          FROM hashtags h
          JOIN post_hashtags ph ON h.id = ph.hashtag_id
          JOIN hashtag_posts hp ON ph.post_id = hp.id
          LEFT JOIN hashtag_sentiment hs ON h.id = hs.hashtag_id AND hp.id = hs.post_id
          WHERE hp.timestamp >= (EXTRACT(EPOCH FROM DATE('now', '-7 days')) * 1000)
          ${exportWhereClause}
          ORDER BY hp.timestamp DESC
          LIMIT ${limit}
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
    console.error('Hashtag Analysis query error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      data: [] 
    }, { status: 500 });
  }
};