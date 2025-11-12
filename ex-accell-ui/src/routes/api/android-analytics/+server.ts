// Server-side API endpoint for Android analytics DuckDB queries
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import path from 'path';

// Path to the DuckDB database file in the ETL directory
const DB_PATH = path.resolve('../etl/android_analytics.db');

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

export const GET: RequestHandler = async ({ url }) => {
  try {
    const queryType = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let sql = '';
    let results: any[] = [];

    switch (queryType) {
      case 'stats':
        // Get dashboard statistics
        sql = `
          SELECT 
            total_sessions,
            total_screenshots,
            unique_apps,
            total_duration_minutes,
            total_events,
            active_users
          FROM android_dashboard_stats
        `;
        break;

      case 'accessibility-events':
        // Get accessibility events
        sql = `
          SELECT 
            id,
            id_user,
            id_session,
            type,
            t_unix_ts_ms,
            apk,
            text
          FROM android_accessibility_events
          ORDER BY t_unix_ts_ms DESC
          LIMIT ${limit}
        `;
        break;

      case 'app-segments':
        // Get app usage segments
        sql = `
          SELECT 
            id,
            id_user,
            id_session,
            apk,
            t_unix_ts_segment_start,
            duration_segment_ms
          FROM android_app_segments
          ORDER BY t_unix_ts_segment_start DESC
          LIMIT ${limit}
        `;
        break;

      case 'screenshots':
        // Get screenshots data
        sql = `
          SELECT 
            id,
            id_user,
            file,
            apk,
            app,
            text,
            t_epoch_ts_ms,
            t_natural_day_ts
          FROM android_screenshots
          ORDER BY t_epoch_ts_ms DESC
          LIMIT ${limit}
        `;
        break;

      case 'session-analytics':
        // Get session analytics
        sql = `
          SELECT 
            id_session,
            id_user,
            duration_minutes,
            unique_apps_used,
            total_screenshots,
            total_active_minutes,
            total_events
          FROM android_session_analytics
          ORDER BY duration_minutes DESC
          LIMIT ${limit}
        `;
        break;

      case 'app-analytics':
        // Get app analytics with usage statistics
        sql = `
          SELECT 
            apk,
            app_name,
            category,
            usage_sessions,
            total_minutes,
            avg_session_minutes,
            screenshot_count,
            unique_users
          FROM android_app_analytics
          ORDER BY total_minutes DESC
          LIMIT ${limit}
        `;
        break;

      case 'user-patterns':
        // Get user behavior patterns
        sql = `
          SELECT 
            id_user,
            total_sessions,
            total_session_minutes,
            unique_apps_used,
            total_screenshots,
            total_events,
            avg_session_duration
          FROM android_user_patterns
          ORDER BY total_session_minutes DESC
          LIMIT ${limit}
        `;
        break;

      case 'top-apps':
        // Get top apps by usage time
        sql = `
          SELECT 
            apk,
            app_name,
            total_minutes,
            usage_sessions,
            unique_users
          FROM android_app_analytics
          WHERE total_minutes > 0
          ORDER BY total_minutes DESC
          LIMIT ${limit}
        `;
        break;

      case 'timeline':
        // Get app usage timeline
        sql = `
          SELECT 
            seg.apk,
            CASE 
              WHEN seg.apk LIKE '%youtube%' THEN 'YouTube'
              WHEN seg.apk LIKE '%chrome%' THEN 'Chrome Browser'
              WHEN seg.apk LIKE '%whatsapp%' THEN 'WhatsApp'
              WHEN seg.apk LIKE '%instagram%' THEN 'Instagram'
              WHEN seg.apk LIKE '%spotify%' THEN 'Spotify'
              WHEN seg.apk LIKE '%netflix%' THEN 'Netflix'
              WHEN seg.apk LIKE '%twitter%' THEN 'Twitter'
              WHEN seg.apk LIKE '%slack%' THEN 'Slack'
              WHEN seg.apk LIKE '%teams%' THEN 'Microsoft Teams'
              WHEN seg.apk LIKE '%slides%' THEN 'Google Slides'
              WHEN seg.apk LIKE '%apple.mobile%' THEN REPLACE(REPLACE(seg.apk, 'com.apple.mobile', ''), 'com.apple.', '')
              ELSE SUBSTRING(seg.apk, LENGTH(seg.apk) - POSITION('.' IN REVERSE(seg.apk)) + 2)
            END as app_name,
            seg.t_unix_ts_segment_start as timestamp,
            ROUND(seg.duration_segment_ms / 60000.0, 1) as duration_minutes,
            seg.id_user,
            seg.id_session
          FROM android_app_segments seg
          ORDER BY seg.t_unix_ts_segment_start
          LIMIT ${limit}
        `;
        break;

      case 'screen-text':
        // Get screen text analysis
        sql = `
          SELECT 
            id,
            id_user,
            apk,
            CASE 
              WHEN apk LIKE '%youtube%' THEN 'YouTube'
              WHEN apk LIKE '%chrome%' THEN 'Chrome Browser'
              WHEN apk LIKE '%whatsapp%' THEN 'WhatsApp'
              WHEN apk LIKE '%instagram%' THEN 'Instagram'
              WHEN apk LIKE '%spotify%' THEN 'Spotify'
              WHEN apk LIKE '%netflix%' THEN 'Netflix'
              WHEN apk LIKE '%twitter%' THEN 'Twitter'
              WHEN apk LIKE '%slack%' THEN 'Slack'
              WHEN apk LIKE '%teams%' THEN 'Microsoft Teams'
              WHEN apk LIKE '%slides%' THEN 'Google Slides'
              WHEN apk LIKE '%apple.mobile%' THEN REPLACE(REPLACE(apk, 'com.apple.mobile', ''), 'com.apple.', '')
              ELSE SUBSTRING(apk, LENGTH(apk) - POSITION('.' IN REVERSE(apk)) + 2)
            END as app_name,
            text,
            t_unix_ts_ms
          FROM android_accessibility_events
          WHERE type = 'SCREEN_TEXT' AND text IS NOT NULL
          ORDER BY t_unix_ts_ms DESC
          LIMIT ${limit}
        `;
        break;

      case 'urls':
        // Get URL visits
        sql = `
          SELECT 
            id,
            id_user,
            apk,
            CASE 
              WHEN apk LIKE '%chrome%' THEN 'Chrome Browser'
              WHEN apk LIKE '%safari%' THEN 'Safari'
              ELSE 'Browser'
            END as browser_name,
            text as url,
            t_unix_ts_ms
          FROM android_accessibility_events
          WHERE type = 'URL' AND text IS NOT NULL
          ORDER BY t_unix_ts_ms DESC
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
    console.error('Android analytics query error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      data: [] 
    }, { status: 500 });
  }
};