import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import { queryErrorResponse } from '$lib/server/queryErrors';
import { hasDataType } from '$lib/services/workspaceContextResolver';
import type { AnalyticsContext, AnalyticsHandler } from './types';

async function topicsOverview({ scope }: AnalyticsContext): Promise<Response> {
  if (!hasDataType(scope, 'social_media') && !hasDataType(scope, 'gdelt_events') && !hasDataType(scope, 'gdelt_gkg')) {
    return json({ success: true, data: [] });
  }
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
    return queryErrorResponse('Topics overview', error, []);
  }
}

async function topicKeywords({ url }: AnalyticsContext): Promise<Response> {
  try {
    const topicId = url.searchParams.get('topicId');
    const params: any[] = [];
    let whereClause = '';
    if (topicId) {
      params.push(topicId);
      whereClause = `WHERE t.topic_id = $1`;
    }

    // Keyed by the readable topics.topic_id so it matches topics-overview
    const data = await executeQuery(`
      SELECT
        t.topic_id AS topic_id,
        tk.keyword,
        tk.weight,
        tk.rank_position
      FROM topic_keywords tk
      JOIN topics t ON t.id = tk.topic_id
      ${whereClause}
      ORDER BY t.topic_id, tk.rank_position
    `, params);

    return json({ success: true, data: data || [] });
  } catch (error) {
    return queryErrorResponse('Topic keywords', error, []);
  }
}

async function topicTrends({ url }: AnalyticsContext): Promise<Response> {
  try {
    const timeRange = url.searchParams.get('timeRange') || '30d';
    // days is derived from a controlled ternary, not raw user input
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    if (!Number.isFinite(days)) throw new Error('Invalid days value');

    const data = await executeQuery(`
      SELECT
        topic_id,
        analysis_date,
        document_count,
        average_engagement,
        growth_rate,
        trend_direction
      FROM topic_trends
      WHERE analysis_date >= (SELECT MAX(analysis_date) FROM topic_trends) - INTERVAL '${days} days'
      ORDER BY analysis_date DESC, topic_id
    `);

    return json({ success: true, data: data || [] });
  } catch (error) {
    return queryErrorResponse('Topic trends', error, []);
  }
}

async function topicRelationships({ url }: AnalyticsContext): Promise<Response> {
  try {
    const threshold = parseFloat(url.searchParams.get('threshold') || '0.5');
    const safeThreshold = Number.isFinite(threshold) ? threshold : 0.5;

    const data = await executeQuery(`
      SELECT
        t1.topic_id AS topic1_id,
        t2.topic_id AS topic2_id,
        tr.similarity_score,
        tr.relationship_type,
        tr.strength
      FROM topic_relationships tr
      JOIN topics t1 ON t1.id = tr.topic1_id
      JOIN topics t2 ON t2.id = tr.topic2_id
      WHERE tr.similarity_score >= $1
      ORDER BY tr.similarity_score DESC
    `, [safeThreshold]);

    return json({ success: true, data: data || [] });
  } catch (error) {
    return queryErrorResponse('Topic relationships', error, []);
  }
}

async function topicCategories({ scope }: AnalyticsContext): Promise<Response> {
  if (!hasDataType(scope, 'social_media') && !hasDataType(scope, 'gdelt_events') && !hasDataType(scope, 'gdelt_gkg')) {
    return json({ success: true, data: [] });
  }
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
    return queryErrorResponse('Topic categories', error, []);
  }
}

export const topicsHandlers: Record<string, AnalyticsHandler> = {
  'topics-overview': topicsOverview,
  'topic-keywords': topicKeywords,
  'topic-trends': topicTrends,
  'topic-relationships': topicRelationships,
  'topic-categories': topicCategories
};
