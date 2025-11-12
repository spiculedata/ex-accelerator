// Server-side API endpoint for overview dashboard DuckDB queries
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import path from 'path';

// Path to the DuckDB database file in the ETL directory
const DB_PATH = path.resolve('../etl/gdelt.db');

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
        // Get overview statistics
        sql = `
          SELECT 
            active_projects,
            posts_analyzed,
            reports_ready,
            todays_activities
          FROM overview_stats
        `;
        break;

      case 'app-modules':
        // Get app modules status
        sql = `
          SELECT 
            name,
            display_name,
            status,
            active_jobs,
            total_processed,
            status_display,
            activity_display,
            icon_color
          FROM app_modules_status
          ORDER BY name
        `;
        break;

      case 'recent-activities':
        // Get recent system activities
        sql = `
          SELECT 
            id,
            activity_type,
            title,
            description,
            module,
            status,
            time_ago,
            icon_color
          FROM recent_activities_view
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;
        break;

      case 'system-status':
        // Get system status metrics
        sql = `
          SELECT 
            metric_name,
            display_name,
            metric_value,
            metric_unit,
            status,
            status_color,
            status_display
          FROM system_status_view
          ORDER BY metric_name
        `;
        break;

      case 'projects':
        // Get projects summary
        sql = `
          SELECT 
            p.id,
            p.name,
            p.description,
            p.status,
            p.category,
            p.created_at,
            COUNT(sa.id) as activity_count
          FROM projects p
          LEFT JOIN system_activities sa ON p.id = sa.project_id
          WHERE p.status = 'active'
          GROUP BY p.id, p.name, p.description, p.status, p.category, p.created_at
          ORDER BY p.updated_at DESC
          LIMIT ${limit}
        `;
        break;

      case 'workspace':
        // Get current workspace info (most active project)
        sql = `
          SELECT 
            p.id,
            p.name,
            p.description,
            p.status,
            p.category,
            COUNT(sa.id) as activity_count,
            COUNT(DISTINCT r.id) as reports_count
          FROM projects p
          LEFT JOIN system_activities sa ON p.id = sa.project_id 
            AND sa.created_at >= CURRENT_TIMESTAMP - INTERVAL 7 DAY
          LEFT JOIN reports r ON p.id = r.project_id
          WHERE p.status = 'active'
          GROUP BY p.id, p.name, p.description, p.status, p.category
          ORDER BY activity_count DESC, reports_count DESC
          LIMIT 1
        `;
        break;

      case 'data-processing':
        // Get data processing statistics
        sql = `
          SELECT 
            source_type,
            SUM(records_count) as total_records,
            COUNT(*) as batch_count,
            AVG(records_count) as avg_batch_size,
            MAX(imported_at) as latest_import
          FROM data_batches
          WHERE processing_status = 'completed'
            AND imported_at >= CURRENT_DATE - INTERVAL 7 DAY
          GROUP BY source_type
          ORDER BY total_records DESC
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
    console.error('Overview dashboard query error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      data: [] 
    }, { status: 500 });
  }
};