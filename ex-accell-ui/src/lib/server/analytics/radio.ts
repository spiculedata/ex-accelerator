import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import { queryErrorResponse } from '$lib/server/queryErrors';
import type { AnalyticsContext, AnalyticsHandler } from './types';

async function radioOverview(_ctx: AnalyticsContext): Promise<Response> {
  try {
    const data = await executeQuery(`
      SELECT COUNT(*) as total_transcripts,
             COALESCE(SUM(duration_seconds), 0) as total_seconds,
             COUNT(DISTINCT radio_name) as station_count,
             COALESCE(AVG(duration_seconds), 0) as avg_duration,
             COUNT(*) FILTER (WHERE is_political = true) as political_count,
             COUNT(*) FILTER (WHERE is_ad = true) as ad_count
      FROM radio_transcripts
    `);
    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Radio overview', err, []);
  }
}

async function radioSentiment(_ctx: AnalyticsContext): Promise<Response> {
  try {
    const data = await executeQuery(`
      SELECT sentiment as sentiment_category,
             COUNT(*) as post_count,
             AVG(confidence) as avg_confidence
      FROM radio_transcripts
      WHERE sentiment IS NOT NULL
      GROUP BY sentiment ORDER BY post_count DESC
    `);
    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Radio sentiment', err, []);
  }
}

async function radioByStation(_ctx: AnalyticsContext): Promise<Response> {
  try {
    const data = await executeQuery(`
      SELECT radio_name, state, COUNT(*) as transcript_count,
             COALESCE(SUM(duration_seconds), 0) as total_seconds,
             COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_count,
             COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_count,
             COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral_count,
             COUNT(*) FILTER (WHERE is_political = true) as political_count
      FROM radio_transcripts GROUP BY radio_name, state ORDER BY transcript_count DESC
    `);
    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Radio by-station', err, []);
  }
}

async function radioTrends(_ctx: AnalyticsContext): Promise<Response> {
  try {
    const data = await executeQuery(`
      SELECT DATE(segment_start) as date,
             COUNT(*) FILTER (WHERE sentiment = 'positive') as positive,
             COUNT(*) FILTER (WHERE sentiment = 'negative') as negative,
             COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral,
             COUNT(*) as total
      FROM radio_transcripts
      WHERE segment_start IS NOT NULL
      GROUP BY DATE(segment_start) ORDER BY date DESC LIMIT 30
    `);
    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Radio trends', err, []);
  }
}

async function radioTopics(_ctx: AnalyticsContext): Promise<Response> {
  try {
    const data = await executeQuery(`
      SELECT topic, COUNT(*) as count, AVG(relevance) as avg_relevance
      FROM radio_topics GROUP BY topic ORDER BY count DESC LIMIT 20
    `);
    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Radio topics', err, []);
  }
}

async function radioPolitical(_ctx: AnalyticsContext): Promise<Response> {
  try {
    const data = await executeQuery(`
      SELECT
        CASE WHEN is_political = true AND is_ad = true THEN 'political_ad'
             WHEN is_political = true THEN 'political_news'
             ELSE 'apolitical' END as category,
        COUNT(*) as count
      FROM radio_transcripts GROUP BY category ORDER BY count DESC
    `);
    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Radio political', err, []);
  }
}

async function radioTranscripts({ url }: AnalyticsContext): Promise<Response> {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const search = url.searchParams.get('search');
    const political = url.searchParams.get('political');

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`transcript ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (political !== null && political !== '') {
      conditions.push(`is_political = $${paramIndex}`);
      params.push(political === 'true');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    const limitParam = `$${paramIndex}`;
    paramIndex++;
    params.push(offset);
    const offsetParam = `$${paramIndex}`;

    const data = await executeQuery(`
      SELECT id, radio_name, state, segment_start, segment_end, duration_seconds,
             transcript, is_political, is_ad,
             sentiment, emotion, confidence, word_count, topics
      FROM radio_transcripts
      ${whereClause}
      ORDER BY segment_start DESC LIMIT ${limitParam} OFFSET ${offsetParam}
    `, params);
    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Radio transcripts', err, []);
  }
}

async function radioWordcloud(_ctx: AnalyticsContext): Promise<Response> {
  try {
    const data = await executeQuery(`
      SELECT unnest(topics) as word, COUNT(*) as count
      FROM radio_transcripts WHERE topics IS NOT NULL
      GROUP BY word ORDER BY count DESC LIMIT 50
    `);
    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Radio wordcloud', err, []);
  }
}

export const radioHandlers: Record<string, AnalyticsHandler> = {
  'radio-overview': radioOverview,
  'radio-sentiment': radioSentiment,
  'radio-by-station': radioByStation,
  'radio-trends': radioTrends,
  'radio-topics': radioTopics,
  'radio-political': radioPolitical,
  'radio-transcripts': radioTranscripts,
  'radio-wordcloud': radioWordcloud
};
