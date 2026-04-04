// Server-side API endpoint for engagement analysis DuckDB queries
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';

// Path to the DuckDB database file in the ETL directory
const DB_PATH = path.resolve('../etl/gdelt.db');
const SCHEMA_PATH = path.resolve('./complete_engagement_schema.sql');

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

// Initialize engagement analysis schema if needed
async function initializeSchema(): Promise<void> {
  try {
    // Check if engagement analysis tables exist
    const checkTables = `
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_name IN ('content_types', 'post_engagement', 'daily_engagement')
    `;
    
    const result = await executeDuckDBQuery(checkTables);
    const tableCount = result[0]?.table_count || 0;
    
    if (tableCount < 3) {
      // Load schema from file
      const fs = await import('fs');
      const schemaSQL = fs.readFileSync(SCHEMA_PATH, 'utf8');
      await executeDuckDBQuery(schemaSQL);
      console.log('Engagement analysis schema initialized');
    }
  } catch (error) {
    console.warn('Schema initialization failed:', error);
    // Continue with existing schema
  }
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const queryType = url.searchParams.get('type');
    const filters = {
      platform: url.searchParams.get('platform') || 'all',
      contentType: url.searchParams.get('contentType') || 'all',
      timeRange: url.searchParams.get('timeRange') || '7d',
      minEngagementRate: parseFloat(url.searchParams.get('minEngagementRate') || '0'),
      limit: parseInt(url.searchParams.get('limit') || '10')
    };

    // Initialize schema if needed
    await initializeSchema();

    let sql = '';
    let results: any[] = [];

    switch (queryType) {
      case 'stats':
        sql = `
          SELECT 
            SUM(pe.likes_count + pe.comments_count + pe.shares_count + pe.saves_count) as total_engagements,
            AVG(pe.engagement_rate) as average_rate,
            SUM(pe.reach) as total_reach,
            MAX(pe.likes_count + pe.comments_count + pe.shares_count + pe.saves_count) as best_performing_post,
            COUNT(*) as total_posts,
            SUM(pe.impressions) as total_impressions,
            AVG(pe.likes_count) as avg_likes,
            AVG(pe.comments_count) as avg_comments,
            AVG(pe.shares_count) as avg_shares
          FROM post_engagement pe
        `;
        break;

      case 'platforms':
        let whereClause = '';
        if (filters.platform !== 'all') {
          whereClause = `WHERE ds.name = '${filters.platform}'`;
        }
        
        sql = `
          SELECT 
            ds.name as platform,
            AVG(pe.engagement_rate) as engagement_rate,
            SUM(pe.likes_count + pe.comments_count + pe.shares_count + pe.saves_count) as total_engagements,
            COUNT(*) as posts,
            AVG(pe.likes_count) as avg_likes,
            AVG(pe.comments_count) as avg_comments,
            AVG(pe.shares_count) as avg_shares,
            SUM(pe.reach) as total_reach
          FROM data_sources ds
          JOIN posts p ON ds.id = p.data_source_id
          JOIN post_engagement pe ON p.id = pe.post_id
          ${whereClause}
          GROUP BY ds.id, ds.name
          ORDER BY engagement_rate DESC
        `;
        break;

      case 'content-types':
        const conditions = [];
        if (filters.contentType !== 'all') {
          conditions.push(`ct.name = '${filters.contentType}'`);
        }
        if (filters.minEngagementRate > 0) {
          conditions.push(`pe.engagement_rate >= ${filters.minEngagementRate}`);
        }
        const contentWhereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        sql = `
          SELECT 
            ct.name as type,
            AVG(pe.engagement_rate) as engagement_rate,
            COUNT(*) as posts,
            SUM(pe.reach) as reach,
            AVG(pe.likes_count) as avg_likes,
            AVG(pe.comments_count) as avg_comments,
            AVG(pe.shares_count) as avg_shares
          FROM content_types ct
          JOIN post_engagement pe ON ct.id = pe.content_type_id
          ${contentWhereClause}
          GROUP BY ct.id, ct.name
          ORDER BY engagement_rate DESC
        `;
        break;

      case 'trends':
        const days = filters.timeRange === '30d' ? 30 : filters.timeRange === '90d' ? 90 : 7;
        sql = `
          SELECT 
            de.analysis_date as date,
            SUM(de.total_likes) as likes,
            SUM(de.total_comments) as comments,
            SUM(de.total_shares) as shares,
            SUM(de.total_saves) as saves,
            SUM(de.total_views) as views,
            SUM(de.total_reach) as reach,
            AVG(de.avg_engagement_rate) as engagement_rate
          FROM daily_engagement de
          WHERE de.analysis_date >= CURRENT_DATE - INTERVAL ${days} DAY
          GROUP BY de.analysis_date
          ORDER BY de.analysis_date ASC
        `;
        break;

      case 'top-posts':
        const postConditions = [];
        if (filters.platform !== 'all') {
          postConditions.push(`ds.name = '${filters.platform}'`);
        }
        if (filters.contentType !== 'all') {
          postConditions.push(`ct.name = '${filters.contentType}'`);
        }
        if (filters.minEngagementRate > 0) {
          postConditions.push(`pe.engagement_rate >= ${filters.minEngagementRate}`);
        }
        const postWhereClause = postConditions.length > 0 ? `WHERE ${postConditions.join(' AND ')}` : '';
        
        sql = `
          SELECT 
            p.id,
            p.content as text,
            p.author,
            p.created_at as timestamp,
            ds.name as platform,
            ct.name as content_type,
            pe.likes_count,
            pe.comments_count,
            pe.shares_count,
            pe.saves_count,
            pe.views_count,
            pe.reach,
            pe.engagement_rate
          FROM posts p
          JOIN data_sources ds ON p.data_source_id = ds.id
          JOIN post_engagement pe ON p.id = pe.post_id
          JOIN content_types ct ON pe.content_type_id = ct.id
          ${postWhereClause}
          ORDER BY pe.engagement_rate DESC
          LIMIT ${filters.limit}
        `;
        break;

      case 'timing':
        sql = `
          SELECT 
            et.hour_of_day,
            et.day_of_week,
            CASE et.day_of_week
              WHEN 1 THEN 'Monday'
              WHEN 2 THEN 'Tuesday' 
              WHEN 3 THEN 'Wednesday'
              WHEN 4 THEN 'Thursday'
              WHEN 5 THEN 'Friday'
              WHEN 6 THEN 'Saturday'
              ELSE 'Sunday'
            END as day_name,
            AVG(et.avg_engagement_rate) as avg_engagement_rate,
            SUM(et.posts_count) as total_posts,
            SUM(et.total_engagements) as total_engagements
          FROM engagement_timing et
          GROUP BY et.hour_of_day, et.day_of_week
          ORDER BY avg_engagement_rate DESC
        `;
        break;

      case 'hashtags':
        sql = `
          SELECT 
            he.hashtag,
            COUNT(*) as usage_count,
            AVG(he.engagement_boost) as avg_boost,
            AVG(he.avg_engagement_rate) as avg_engagement_rate,
            COUNT(*) * AVG(he.engagement_boost) as impact_score
          FROM hashtag_engagement he
          GROUP BY he.hashtag
          HAVING COUNT(*) >= 10
          ORDER BY impact_score DESC
          LIMIT ${filters.limit}
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
      filters
    });

  } catch (error) {
    console.error('DuckDB query error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      data: [] 
    }, { status: 500 });
  }
};