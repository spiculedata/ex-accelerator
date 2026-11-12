import { postgresPool } from '$lib/services/postgres';

/** Columns the pg driver returns as strings that the dashboards expect as numbers. */
const NUMERIC_COLUMNS = new Set([
  'count', 'post_count', 'total_posts', 'total_size', 'topic_count',
  'avg_confidence', 'avg_coherence', 'positive_ratio', 'correlation',
  'positive', 'negative', 'neutral', 'total_posts_analyzed',
  'positive_count', 'negative_count', 'neutral_count',
  'hour_of_day', 'document_count', 'average_engagement', 'growth_rate',
  'similarity_score', 'weight', 'size', 'coherence_score', 'rank_position',
  'confidence', 'confidence_score', 'intensity_score',
  'avg_negative_percentage', 'avg_neutral_percentage',
  'record_count', 'health',
  'total_transcripts', 'total_seconds', 'station_count', 'avg_duration',
  'political_count', 'ad_count', 'transcript_count', 'positive_count',
  'negative_count', 'neutral_count', 'avg_relevance', 'word_count',
  'duration_seconds', 'avg_confidence'
]);

/**
 * Execute a query using pg_duckdb extension
 * This leverages DuckDB's analytical engine on PostgreSQL tables
 */
export async function executeQuery(sql: string, params: any[] = []): Promise<any[]> {
  // Errors propagate: callers map failures through queryErrorResponse (missing table => empty, else 500)
  const rows = await postgresPool.duckdbQuery(sql, params);

  // Convert BigInts and numeric strings to regular numbers for JSON serialization
  // PostgreSQL's pg driver returns COUNT/AVG/SUM/numeric columns as strings
  return rows.map(row => {
    const serializedRow: any = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'bigint') {
        serializedRow[key] = Number(value);
      } else if (typeof value === 'string' && NUMERIC_COLUMNS.has(key) && value !== '' && !isNaN(Number(value))) {
        serializedRow[key] = Number(value);
      } else {
        serializedRow[key] = value;
      }
    }
    return serializedRow;
  });
}
