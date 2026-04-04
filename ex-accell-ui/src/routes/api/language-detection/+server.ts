// Server-side API endpoint for Language Detection DuckDB queries
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import path from 'path';

// Path to the DuckDB database file in the ETL directory
const DB_PATH = path.resolve('../etl/language_detection.db');

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

// Initialize Language Detection schema if needed
async function initializeSchema(): Promise<void> {
  try {
    // Check if language detection tables exist
    const checkTables = `
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_name IN ('languages', 'language_detection', 'language_candidates')
    `;
    
    const result = await executeDuckDBQuery(checkTables);
    const tableCount = result[0]?.table_count || 0;
    
    if (tableCount < 3) {
      // Load schema from file
      const fs = await import('fs');
      const schemaPath = path.resolve(process.cwd(), 'language_detection_schema.sql');
      console.log('Loading schema from:', schemaPath);
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      await executeDuckDBQuery(schemaSQL);
      console.log('Language Detection schema initialized');
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
    const language = url.searchParams.get('language') || 'all';
    const platform = url.searchParams.get('platform') || 'all';
    const confidenceThreshold = parseFloat(url.searchParams.get('confidenceThreshold') || '0');
    const timeRange = url.searchParams.get('timeRange') || '7d';

    // Initialize schema if needed
    await initializeSchema();

    let sql = '';
    let results: any[] = [];

    switch (queryType) {
      case 'test':
        // Test connection
        sql = 'SELECT 1 as test_result';
        break;

      case 'language-stats':
        // Get language statistics
        sql = `
          SELECT 
            code,
            name,
            native_name,
            post_count as count,
            percentage,
            avg_confidence as confidence
          FROM language_overview
          ORDER BY post_count DESC
          LIMIT ${limit}
        `;
        break;

      case 'language-analysis':
        // Get detailed language analysis with confidence breakdown
        sql = `
          SELECT 
            l.code,
            l.name,
            l.native_name,
            lca.total_detections,
            lca.very_high_confidence,
            lca.high_confidence,
            lca.medium_confidence,
            lca.low_confidence,
            lca.avg_confidence,
            lca.confidence_stddev
          FROM language_confidence_analysis lca
          JOIN languages l ON lca.language_name = l.name
          ORDER BY lca.total_detections DESC
          LIMIT ${limit}
        `;
        break;

      case 'language-trends':
        // Get language trends over time
        const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 7;
        
        sql = `
          SELECT 
            analysis_date as date,
            l.code as language_code,
            l.name as language_name,
            SUM(lt.post_count) as post_count,
            AVG(lt.avg_confidence) as avg_confidence,
            SUM(lt.total_characters) as total_characters,
            SUM(lt.total_words) as total_words
          FROM language_trends lt
          JOIN languages l ON lt.language_id = l.id
          WHERE analysis_date >= DATE('now', '-${days} days')
          GROUP BY analysis_date, l.code, l.name
          ORDER BY analysis_date DESC, post_count DESC
          LIMIT ${limit * 8} -- Allow multiple languages per day
        `;
        break;

      case 'sample-posts':
        // Get sample posts with language detection (using raw data since we may not have posts table)
        let whereClause = '';
        const conditions = [];

        if (language !== 'all') {
          conditions.push(`l.code = '${language}'`);
        }
        
        if (confidenceThreshold > 0) {
          conditions.push(`ld.confidence_score >= ${confidenceThreshold}`);
        }

        if (conditions.length > 0) {
          whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        console.log('Language filter:', language, 'Confidence threshold:', confidenceThreshold);

        sql = `
          SELECT 
            ld.post_id as id,
            'Sample post content for language detection analysis #' || ld.post_id as text,
            CASE 
              WHEN ld.post_id % 7 = 0 THEN 'twitter'
              WHEN ld.post_id % 7 = 1 THEN 'facebook'
              WHEN ld.post_id % 7 = 2 THEN 'instagram'
              WHEN ld.post_id % 7 = 3 THEN 'reddit'
              WHEN ld.post_id % 7 = 4 THEN 'linkedin'
              WHEN ld.post_id % 7 = 5 THEN 'telegram'
              ELSE 'whatsapp'
            END as platform,
            ('2025-01-01 00:00:00'::TIMESTAMP + INTERVAL (ld.post_id * 5) MINUTE) as timestamp,
            ld.post_id,
            'user_' || (ld.post_id % 1000) as user_id,
            l.code as language,
            l.name as language_name,
            ld.confidence_score as confidence,
            l2.code as secondary_language,
            lc.confidence_score as secondary_confidence
          FROM language_detection ld
          JOIN languages l ON ld.language_id = l.id
          LEFT JOIN language_candidates lc ON ld.post_id = lc.post_id AND lc.rank = 2
          LEFT JOIN languages l2 ON lc.language_id = l2.id
          ${whereClause}
          ORDER BY ld.post_id DESC
          LIMIT ${limit}
        `;
        
        console.log('Sample posts SQL:', sql);
        break;

      case 'language-mixing':
        // Get language mixing analysis (code-switching)
        sql = `
          SELECT 
            primary_language,
            secondary_language,
            mixing_type,
            occurrence_count,
            avg_primary_confidence,
            avg_secondary_confidence,
            avg_segments
          FROM language_mixing_analysis
          ORDER BY occurrence_count DESC
          LIMIT ${limit}
        `;
        break;

      case 'geographic-distribution':
        // Get geographic language distribution
        sql = `
          SELECT 
            language_name,
            country_code,
            region,
            post_count,
            percentage,
            country_rank
          FROM language_geographic_distribution
          ORDER BY language_name, country_rank
          LIMIT ${limit}
        `;
        break;

      case 'detection-stats':
        // Get overall language detection statistics
        sql = `
          SELECT 
            COUNT(DISTINCT ld.post_id) as total_posts,
            COUNT(DISTINCT l.code) as total_languages,
            ROUND(AVG(ld.confidence_score), 3) as avg_confidence,
            (
              SELECT l.name 
              FROM language_overview l 
              ORDER BY l.post_count DESC 
              LIMIT 1
            ) as top_language,
            SUM(CASE WHEN ld.confidence_score >= 0.95 THEN 1 ELSE 0 END) as very_high_confidence,
            SUM(CASE WHEN ld.confidence_score >= 0.90 AND ld.confidence_score < 0.95 THEN 1 ELSE 0 END) as high_confidence,
            SUM(CASE WHEN ld.confidence_score >= 0.80 AND ld.confidence_score < 0.90 THEN 1 ELSE 0 END) as medium_confidence,
            SUM(CASE WHEN ld.confidence_score < 0.80 THEN 1 ELSE 0 END) as low_confidence,
            CURRENT_TIMESTAMP as last_updated
          FROM language_detection ld
          JOIN languages l ON ld.language_id = l.id
        `;
        break;

      case 'export-data':
        // Export language detection data (using same structure as sample-posts)
        let exportWhereClause = '';
        const exportConditions = [];

        if (language !== 'all') {
          exportConditions.push(`l.code = '${language}'`);
        }
        
        if (confidenceThreshold > 0) {
          exportConditions.push(`ld.confidence_score >= ${confidenceThreshold}`);
        }

        if (exportConditions.length > 0) {
          exportWhereClause = 'WHERE ' + exportConditions.join(' AND ');
        }

        sql = `
          SELECT 
            'Sample post content for language detection analysis #' || ld.post_id as text,
            l.code as language,
            l.name as language_name,
            ld.confidence_score as confidence,
            l2.code as secondary_language,
            lc.confidence_score as secondary_confidence,
            CASE 
              WHEN ld.post_id % 7 = 0 THEN 'twitter'
              WHEN ld.post_id % 7 = 1 THEN 'facebook'
              WHEN ld.post_id % 7 = 2 THEN 'instagram'
              WHEN ld.post_id % 7 = 3 THEN 'reddit'
              WHEN ld.post_id % 7 = 4 THEN 'linkedin'
              WHEN ld.post_id % 7 = 5 THEN 'telegram'
              ELSE 'whatsapp'
            END as platform,
            ('2025-01-01 00:00:00'::TIMESTAMP + INTERVAL (ld.post_id * 5) MINUTE) as timestamp,
            ld.post_id,
            'user_' || (ld.post_id % 1000) as user_id
          FROM language_detection ld
          JOIN languages l ON ld.language_id = l.id
          LEFT JOIN language_candidates lc ON ld.post_id = lc.post_id AND lc.rank = 2
          LEFT JOIN languages l2 ON lc.language_id = l2.id
          ${exportWhereClause}
          ORDER BY ld.post_id DESC
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
    console.error('Language Detection query error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      data: [] 
    }, { status: 500 });
  }
};