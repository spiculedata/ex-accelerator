// Server-side API endpoint for Topic Modeling DuckDB queries
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import path from 'path';

// Path to the DuckDB database file in the ETL directory
const DB_PATH = path.resolve('../etl/topic_modeling.db');

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

// Initialize Topic Modeling schema if needed
async function initializeSchema(): Promise<void> {
  try {
    // Check if topic modeling tables exist
    const checkTables = `
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_name IN ('topic_documents', 'topics', 'topic_keywords')
    `;
    
    const result = await executeDuckDBQuery(checkTables);
    const tableCount = result[0]?.table_count || 0;
    
    if (tableCount < 3) {
      // Load schema from file
      const fs = await import('fs');
      const schemaPath = path.resolve('./topic_modeling_schema.sql');
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      await executeDuckDBQuery(schemaSQL);
      console.log('Topic Modeling schema initialized');
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
    const category = url.searchParams.get('category') || 'all';
    const search = url.searchParams.get('search') || '';
    const minSize = parseInt(url.searchParams.get('minSize') || '0');

    // Initialize schema if needed
    await initializeSchema();

    let sql = '';
    let results: any[] = [];

    switch (queryType) {
      case 'test':
        // Test connection
        sql = 'SELECT 1 as test_result';
        break;

      case 'topics':
        // Get all topics with filtering
        let whereClause = '';
        const conditions = [];

        if (category !== 'all') {
          conditions.push(`category = '${category}'`);
        }
        
        if (search) {
          conditions.push(`(name LIKE '%${search}%' OR keywords LIKE '%${search}%')`);
        }
        
        if (minSize > 0) {
          conditions.push(`size >= ${minSize}`);
        }

        if (conditions.length > 0) {
          whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        sql = `
          SELECT 
            topic_id as id,
            name,
            category,
            category_color,
            size,
            weight,
            coherence_score,
            keywords
          FROM topic_overview
          ${whereClause}
          ORDER BY weight DESC
          LIMIT ${limit}
        `;
        break;

      case 'categories':
        // Get topic categories
        sql = `
          SELECT 
            category as name,
            category_color as color,
            topic_count,
            total_documents,
            avg_weight,
            avg_coherence
          FROM topic_categories
          ORDER BY total_documents DESC
        `;
        break;

      case 'relationships':
        // Get topic relationships
        sql = `
          SELECT 
            topic1_id,
            topic1_name,
            topic2_id,
            topic2_name,
            similarity_score,
            relationship_type,
            strength
          FROM topic_relationships_view
          ORDER BY similarity_score DESC
          LIMIT ${limit}
        `;
        break;

      case 'topic-stats':
        // Get overall topic modeling statistics
        sql = `
          SELECT 
            COUNT(*) as total_topics,
            COUNT(DISTINCT category) as total_categories,
            SUM(size) as total_documents,
            AVG(weight) as avg_weight,
            AVG(coherence_score) as avg_coherence,
            MAX(weight) as max_weight,
            MIN(weight) as min_weight
          FROM topics
        `;
        break;

      case 'trending-topics':
        // Get trending topics based on recent activity
        sql = `
          SELECT 
            t.topic_id,
            t.name,
            t.category,
            t.category_color,
            t.weight,
            AVG(tt.growth_rate) as avg_growth_rate,
            SUM(tt.document_count) as recent_document_count,
            COUNT(tt.id) as trend_data_points
          FROM topics t
          JOIN topic_trends tt ON t.id = tt.topic_id
          WHERE tt.analysis_date >= DATE('now', '-7 days')
          GROUP BY t.id, t.topic_id, t.name, t.category, t.category_color, t.weight
          ORDER BY avg_growth_rate DESC
          LIMIT ${limit}
        `;
        break;

      case 'topic-keywords':
        // Get keywords for a specific topic
        const topicId = url.searchParams.get('topicId');
        if (!topicId) {
          return json({ error: 'topicId parameter required' }, { status: 400 });
        }

        sql = `
          SELECT 
            keyword,
            weight,
            rank_position
          FROM topic_keywords_analysis
          WHERE topic_id = '${topicId}'
          ORDER BY rank_position
          LIMIT 20
        `;
        break;

      case 'topic-documents':
        // Get documents for a specific topic
        const docTopicId = url.searchParams.get('topicId');
        if (!docTopicId) {
          return json({ error: 'topicId parameter required' }, { status: 400 });
        }

        sql = `
          SELECT 
            document_id,
            title,
            source,
            author,
            engagement_score,
            probability,
            is_primary
          FROM document_topic_assignments
          WHERE topic_id = '${docTopicId}'
          ORDER BY probability DESC
          LIMIT ${limit}
        `;
        break;

      case 'search-topics':
        // Search topics by keywords or name
        const searchQuery = url.searchParams.get('query') || '';
        if (!searchQuery) {
          return json({ error: 'query parameter required' }, { status: 400 });
        }

        sql = `
          SELECT 
            topic_id as id,
            name,
            category,
            category_color,
            size,
            weight,
            coherence_score,
            keywords
          FROM topic_overview
          WHERE name LIKE '%${searchQuery}%' 
             OR keywords LIKE '%${searchQuery}%'
             OR category LIKE '%${searchQuery}%'
          ORDER BY weight DESC
          LIMIT ${limit}
        `;
        break;

      case 'topic-trends':
        // Get topic evolution trends
        const trendTopicId = url.searchParams.get('topicId');
        const days = parseInt(url.searchParams.get('days') || '30');
        
        let trendWhere = `tt.analysis_date >= DATE('now', '-${days} days')`;
        if (trendTopicId) {
          trendWhere += ` AND t.topic_id = '${trendTopicId}'`;
        }

        sql = `
          SELECT 
            topic_id,
            name,
            category,
            analysis_date,
            document_count,
            average_engagement,
            growth_rate,
            trend_direction
          FROM topic_trends_analysis tt
          JOIN topics t ON tt.topic_id = t.topic_id  
          WHERE ${trendWhere}
          ORDER BY analysis_date DESC, weight DESC
          LIMIT ${limit}
        `;
        break;

      case 'modeling-runs':
        // Get topic modeling run history
        sql = `
          SELECT 
            run_id,
            algorithm,
            num_topics,
            perplexity,
            coherence,
            parameters,
            status,
            started_at,
            completed_at
          FROM modeling_runs
          ORDER BY started_at DESC
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
    console.error('Topic Modeling query error:', error);
    return json({ 
      success: false, 
      error: error.message,
      data: [] 
    }, { status: 500 });
  }
};