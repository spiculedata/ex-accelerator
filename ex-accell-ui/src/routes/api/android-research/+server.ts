// Server-side API endpoint for Android research DuckDB queries
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import path from 'path';

// Path to the DuckDB database file in the ETL directory
const DB_PATH = path.resolve('../etl/android_research.db');

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

// Initialize Android Research schema if needed
async function initializeSchema(): Promise<void> {
  try {
    // Check if research tables exist
    const checkTables = `
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_name IN ('android_temporal_patterns', 'android_app_transitions', 'android_attention_spans')
    `;
    
    const result = await executeDuckDBQuery(checkTables);
    const tableCount = result[0]?.table_count || 0;
    
    if (tableCount < 3) {
      // Load schema from file
      const fs = await import('fs');
      const schemaPath = path.resolve('./android_research_schema.sql');
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      await executeDuckDBQuery(schemaSQL);
      console.log('Android Research schema initialized');
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

    // Initialize schema if needed
    await initializeSchema();

    let sql = '';
    let results: any[] = [];

    switch (queryType) {
      case 'test':
        // Test connection
        sql = 'SELECT 1 as test_result';
        break;

      case 'temporal-patterns':
        // Get temporal usage patterns from android_temporal_analysis view
        sql = `
          SELECT 
            hour_of_day,
            day_name,
            app_name,
            avg_usage_minutes,
            total_sessions,
            avg_session_duration,
            avg_intensity
          FROM android_temporal_analysis
          ORDER BY hour_of_day, avg_usage_minutes DESC
          LIMIT ${limit}
        `;
        break;

      case 'app-transitions':
        // Get app transitions with app names
        sql = `
          SELECT 
            from_apk,
            to_apk,
            CASE 
              WHEN from_apk LIKE '%youtube%' THEN 'YouTube'
              WHEN from_apk LIKE '%chrome%' THEN 'Chrome'
              WHEN from_apk LIKE '%instagram%' THEN 'Instagram'
              WHEN from_apk LIKE '%whatsapp%' THEN 'WhatsApp'
              WHEN from_apk LIKE '%launcher%' THEN 'Home Screen'
              WHEN from_apk LIKE '%gm%' THEN 'Gmail'
              WHEN from_apk LIKE '%slack%' THEN 'Slack'
              WHEN from_apk LIKE '%netflix%' THEN 'Netflix'
              WHEN from_apk LIKE '%spotify%' THEN 'Spotify'
              ELSE from_apk
            END as from_app_name,
            CASE 
              WHEN to_apk LIKE '%youtube%' THEN 'YouTube'
              WHEN to_apk LIKE '%chrome%' THEN 'Chrome'
              WHEN to_apk LIKE '%instagram%' THEN 'Instagram'
              WHEN to_apk LIKE '%whatsapp%' THEN 'WhatsApp'
              WHEN to_apk LIKE '%launcher%' THEN 'Home Screen'
              WHEN to_apk LIKE '%gm%' THEN 'Gmail'
              WHEN to_apk LIKE '%slack%' THEN 'Slack'
              WHEN to_apk LIKE '%netflix%' THEN 'Netflix'
              WHEN to_apk LIKE '%spotify%' THEN 'Spotify'
              ELSE to_apk
            END as to_app_name,
            COUNT(*) as transition_count,
            AVG(dwell_time_ms) as avg_dwell_time_ms
          FROM android_app_transitions
          GROUP BY from_apk, to_apk
          ORDER BY transition_count DESC
          LIMIT ${limit}
        `;
        break;

      case 'attention-spans':
        // Get attention span data from android_attention_spans table
        sql = `
          SELECT 
            apk,
            CASE 
              WHEN apk LIKE '%youtube%' THEN 'YouTube'
              WHEN apk LIKE '%chrome%' THEN 'Chrome'
              WHEN apk LIKE '%instagram%' THEN 'Instagram'
              WHEN apk LIKE '%whatsapp%' THEN 'WhatsApp'
              WHEN apk LIKE '%gm%' THEN 'Gmail'
              WHEN apk LIKE '%slack%' THEN 'Slack'
              WHEN apk LIKE '%netflix%' THEN 'Netflix'
              WHEN apk LIKE '%spotify%' THEN 'Spotify'
              ELSE apk
            END as app_name,
            attention_start_ts,
            attention_duration_ms,
            interruption_count,
            task_switches,
            depth_level,
            engagement_score,
            context_type
          FROM android_attention_spans
          ORDER BY attention_duration_ms DESC
          LIMIT ${limit}
        `;
        break;

      case 'content-engagement':
        // Get content engagement from android_engagement_summary view
        sql = `
          SELECT 
            content_category,
            unique_users,
            engagement_episodes,
            avg_duration_minutes,
            avg_interaction_depth,
            avg_return_visits,
            avg_engagement_score,
            sustained_attention_count,
            fragmented_attention_count,
            positive_valence_count,
            negative_valence_count
          FROM android_engagement_summary
          ORDER BY avg_engagement_score DESC
        `;
        break;

      case 'cognitive-load':
        // Get cognitive load data
        sql = `
          SELECT 
            analysis_hour,
            AVG(task_switching_rate) as avg_task_switching_rate,
            AVG(multitasking_index) as avg_multitasking_index,
            AVG(attention_fragmentation) as avg_attention_fragmentation,
            AVG(cognitive_efficiency) as avg_cognitive_efficiency,
            AVG(decision_fatigue_score) as avg_decision_fatigue,
            AVG(context_switch_penalty) as avg_context_switch_penalty
          FROM android_cognitive_load
          GROUP BY analysis_hour
          ORDER BY analysis_hour
        `;
        break;

      case 'behavioral-metrics':
        // Get behavioral metrics from android_behavioral_summary view
        sql = `
          SELECT 
            total_daily_usage_minutes,
            peak_usage_hour,
            unique_apps_used,
            avg_attention_duration_seconds,
            avg_engagement_score,
            avg_task_switching_rate,
            avg_cognitive_efficiency
          FROM android_behavioral_summary
          ORDER BY total_daily_usage_minutes DESC
          LIMIT 1
        `;
        break;

      case 'digital-phenotype':
        // Get digital phenotype classification
        sql = `
          SELECT 
            usage_behavior_type,
            attention_profile,
            usage_pattern,
            multitasking_profile,
            app_diversity_score,
            routine_consistency,
            social_engagement_level,
            productivity_orientation
          FROM android_digital_phenotypes
          ORDER BY phenotype_date DESC
          LIMIT 1
        `;
        break;

      case 'research-findings':
        // Get research findings
        sql = `
          SELECT 
            finding_category,
            finding_title,
            finding_description,
            statistical_significance,
            effect_size,
            confidence_level,
            research_implications,
            behavioral_recommendations,
            analysis_period_start,
            analysis_period_end
          FROM android_research_findings
          ORDER BY confidence_level DESC
          LIMIT ${limit}
        `;
        break;

      case 'network-centrality':
        // Get network centrality from android_network_analysis view
        sql = `
          SELECT 
            app_name,
            app_category,
            betweenness_centrality,
            closeness_centrality,
            eigenvector_centrality,
            pagerank_score,
            in_degree,
            out_degree,
            hub_score,
            authority_score,
            total_degree,
            overall_centrality
          FROM android_network_analysis
          ORDER BY overall_centrality DESC
          LIMIT ${limit}
        `;
        break;

      case 'transition-flow':
        // Get transition flow for Sankey diagram (hierarchical, no cycles)
        sql = `
          SELECT 
            from_apk as source_apk,
            to_apk as target_apk,
            CASE 
              WHEN from_apk LIKE '%launcher%' THEN 'Home Screen'
              WHEN from_apk LIKE '%youtube%' THEN 'YouTube'
              WHEN from_apk LIKE '%chrome%' THEN 'Chrome'
              WHEN from_apk LIKE '%instagram%' THEN 'Instagram'
              WHEN from_apk LIKE '%whatsapp%' THEN 'WhatsApp'
              WHEN from_apk LIKE '%gm%' THEN 'Gmail'
              WHEN from_apk LIKE '%slack%' THEN 'Slack'
              WHEN from_apk LIKE '%netflix%' THEN 'Netflix'
              WHEN from_apk LIKE '%spotify%' THEN 'Spotify'
              ELSE from_apk
            END as from_app_name,
            CASE 
              WHEN to_apk LIKE '%launcher%' THEN 'Home Screen'
              WHEN to_apk LIKE '%youtube%' THEN 'YouTube'
              WHEN to_apk LIKE '%chrome%' THEN 'Chrome'
              WHEN to_apk LIKE '%instagram%' THEN 'Instagram'
              WHEN to_apk LIKE '%whatsapp%' THEN 'WhatsApp'
              WHEN to_apk LIKE '%gm%' THEN 'Gmail'
              WHEN to_apk LIKE '%slack%' THEN 'Slack'
              WHEN to_apk LIKE '%netflix%' THEN 'Netflix'
              WHEN to_apk LIKE '%spotify%' THEN 'Spotify'
              ELSE to_apk
            END as to_app_name,
            COUNT(*) as transition_count
          FROM android_app_transitions
          WHERE from_apk != to_apk
          GROUP BY from_apk, to_apk
          ORDER BY transition_count DESC
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
    console.error('Android Research query error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      data: [] 
    }, { status: 500 });
  }
};