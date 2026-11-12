import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import { queryErrorResponse } from '$lib/server/queryErrors';
import type { AnalyticsContext, AnalyticsHandler } from './types';

async function emotionCorrelations({ scope }: AnalyticsContext): Promise<Response> {
  if (scope && !scope.hasSocialMedia) return json({ success: true, data: [] });
  try {
    const data = await executeQuery(`
      SELECT
        ea1.emotion as emotion1,
        ea2.emotion as emotion2,
        CORR(ea1.intensity_score, ea2.intensity_score) as correlation,
        COUNT(*) as co_occurrence_count
      FROM emotion_analysis ea1
      JOIN emotion_analysis ea2 ON ea1.post_id = ea2.post_id AND ea1.emotion != ea2.emotion
      GROUP BY ea1.emotion, ea2.emotion
      HAVING COUNT(*) >= 5
      ORDER BY correlation DESC
      LIMIT 20
    `);

    return json({ success: true, data: data || [] });
  } catch (error) {
    return queryErrorResponse('Emotion correlations', error, []);
  }
}

async function emotionStats({ scope }: AnalyticsContext): Promise<Response> {
  try {
    if (scope && !scope.hasSocialMedia) return json({ success: true, data: [] });
    const data = await executeQuery(`
      SELECT
        ea.emotion,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emotion_analysis), 1) as percentage,
        AVG(ea.intensity_score) as avg_intensity,
        AVG(ea.confidence) as avg_confidence
      FROM emotion_analysis ea
      GROUP BY ea.emotion
      ORDER BY count DESC
    `);

    return json({ success: true, data: data || [] });
  } catch (error) {
    return queryErrorResponse('Emotion stats', error, []);
  }
}

export const emotionsHandlers: Record<string, AnalyticsHandler> = {
  'emotion-correlations': emotionCorrelations,
  'emotion-stats': emotionStats
};
