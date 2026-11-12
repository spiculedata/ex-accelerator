import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import { queryErrorResponse } from '$lib/server/queryErrors';
import type { AnalyticsContext, AnalyticsHandler } from './types';

async function investigationTimeline({ url }: AnalyticsContext): Promise<Response> {
  const keywords = url.searchParams.get('keywords') || '';
  const dateStart = url.searchParams.get('date_start');
  const dateEnd = url.searchParams.get('date_end');

  if (!keywords || !dateStart || !dateEnd) {
    return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
  }

  const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

  try {
    // A source whose table does not exist yet contributes empty columns instead of failing the whole timeline
    const [present] = await executeQuery("SELECT to_regclass('gdelt_events') IS NOT NULL AS gdelt, to_regclass('radio_transcripts') IS NOT NULL AS radio");
    const gdeltCte = present?.gdelt === true ? `gdelt AS (
        SELECT TO_DATE(sqldate::text, 'YYYYMMDD') AS d,
          COUNT(*) AS event_count, AVG(goldsteinscale) AS avg_goldstein, AVG(avgtone) AS avg_tone
        FROM gdelt_events
        WHERE sqldate >= CAST(REPLACE($1::text, '-', '') AS INTEGER)
          AND sqldate <= CAST(REPLACE($2::text, '-', '') AS INTEGER)
          AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[])
               OR actiongeo_fullname ILIKE ANY($3::text[]))
        GROUP BY 1
      ),` : `gdelt AS (SELECT NULL::date AS d, 0::bigint AS event_count, NULL::float8 AS avg_goldstein, NULL::float8 AS avg_tone WHERE false),`;
    const radioCte = present?.radio === true ? `radio AS (
        SELECT DATE(segment_start) AS d, COUNT(*) AS segment_count,
          COUNT(*) FILTER (WHERE sentiment = 'positive') AS positive,
          COUNT(*) FILTER (WHERE sentiment = 'negative') AS negative,
          COUNT(*) FILTER (WHERE sentiment = 'neutral') AS neutral
        FROM radio_transcripts
        WHERE segment_start >= $1::timestamp AND segment_start <= ($2::date + 1)::timestamp
          AND transcript ILIKE ANY($3::text[])
        GROUP BY 1
      ),` : `radio AS (SELECT NULL::date AS d, 0::bigint AS segment_count, 0::bigint AS positive, 0::bigint AS negative, 0::bigint AS neutral WHERE false),`;
    const socialCte = `social AS (
        SELECT DATE(to_timestamp(timestamp/1000)) AS d, COUNT(*) AS post_count,
          COUNT(*) FILTER (WHERE sentiment_category IN ('Positive','Very Positive')) AS positive,
          COUNT(*) FILTER (WHERE sentiment_category IN ('Negative','Very Negative')) AS negative,
          COUNT(*) FILTER (WHERE sentiment_category = 'Neutral') AS neutral
        FROM posts_with_sentiment
        WHERE to_timestamp(timestamp/1000) >= $1::timestamp
          AND to_timestamp(timestamp/1000) <= ($2::date + 1)::timestamp
          AND text ILIKE ANY($3::text[])
        GROUP BY 1
      )`;

    const data = await executeQuery(`
      WITH date_series AS (
        SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS d
      ),
      ${gdeltCte}
      ${radioCte}
      ${socialCte}
      SELECT ds.d as date,
        COALESCE(g.event_count, 0) as gdelt_events, g.avg_goldstein, g.avg_tone,
        COALESCE(r.segment_count, 0) as radio_segments, COALESCE(r.positive, 0) as radio_positive,
        COALESCE(r.negative, 0) as radio_negative, COALESCE(r.neutral, 0) as radio_neutral,
        COALESCE(s.post_count, 0) as social_posts, COALESCE(s.positive, 0) as social_positive,
        COALESCE(s.negative, 0) as social_negative, COALESCE(s.neutral, 0) as social_neutral
      FROM date_series ds
      LEFT JOIN gdelt g ON g.d = ds.d LEFT JOIN radio r ON r.d = ds.d LEFT JOIN social s ON s.d = ds.d
      ORDER BY ds.d
    `, [dateStart, dateEnd, keywordsArray]);

    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Investigation timeline', err, []);
  }
}

async function investigationGdeltEvents({ url }: AnalyticsContext): Promise<Response> {
  const keywords = url.searchParams.get('keywords') || '';
  const dateStart = url.searchParams.get('date_start');
  const dateEnd = url.searchParams.get('date_end');
  const limit = parseInt(url.searchParams.get('limit') || '100');

  if (!keywords || !dateStart || !dateEnd) {
    return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
  }

  const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

  try {
    const data = await executeQuery(`
      SELECT * FROM (
        SELECT DISTINCT ON (globaleventid) globaleventid, sqldate, actor1name, actor2name,
          eventcode, eventrootcode, quadclass, goldsteinscale, nummentions, numsources, numarticles, avgtone,
          actor1countrycode, actor2countrycode,
          actiongeo_fullname, actiongeo_lat, actiongeo_long, sourceurl
        FROM gdelt_events
        WHERE sqldate >= CAST(REPLACE($1::text, '-', '') AS INTEGER)
          AND sqldate <= CAST(REPLACE($2::text, '-', '') AS INTEGER)
          AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[])
               OR actiongeo_fullname ILIKE ANY($3::text[]))
        ORDER BY globaleventid
      ) deduped
      ORDER BY sqldate DESC, nummentions DESC
      LIMIT $4
    `, [dateStart, dateEnd, keywordsArray, limit]);

    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Investigation GDELT events', err, []);
  }
}

async function investigationRadioSegments({ url }: AnalyticsContext): Promise<Response> {
  const keywords = url.searchParams.get('keywords') || '';
  const dateStart = url.searchParams.get('date_start');
  const dateEnd = url.searchParams.get('date_end');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  if (!keywords || !dateStart || !dateEnd) {
    return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
  }

  const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

  try {
    const data = await executeQuery(`
      SELECT id, radio_name, state, segment_start, segment_end, duration_seconds,
        transcript, sentiment, emotion, confidence,
        is_political, is_ad, word_count
      FROM radio_transcripts
      WHERE segment_start >= $1::timestamp AND segment_start <= ($2::date + 1)::timestamp
        AND transcript ILIKE ANY($3::text[])
      ORDER BY segment_start DESC
      LIMIT $4
    `, [dateStart, dateEnd, keywordsArray, limit]);

    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Investigation radio segments', err, []);
  }
}

async function investigationSocialPosts({ url }: AnalyticsContext): Promise<Response> {
  const keywords = url.searchParams.get('keywords') || '';
  const dateStart = url.searchParams.get('date_start');
  const dateEnd = url.searchParams.get('date_end');
  const limit = parseInt(url.searchParams.get('limit') || '100');

  if (!keywords || !dateStart || !dateEnd) {
    return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
  }

  const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

  try {
    const data = await executeQuery(`
      SELECT id, text, timestamp, platform, author,
        sentiment_category, confidence_score, emotions,
        engagement_likes, engagement_shares, engagement_comments
      FROM posts_with_sentiment
      WHERE to_timestamp(timestamp/1000) >= $1::timestamp
        AND to_timestamp(timestamp/1000) <= ($2::date + 1)::timestamp
        AND text ILIKE ANY($3::text[])
      ORDER BY timestamp DESC
      LIMIT $4
    `, [dateStart, dateEnd, keywordsArray, limit]);

    return json({ success: true, data });
  } catch (err) {
    return queryErrorResponse('Investigation social posts', err, []);
  }
}

async function investigationKeywordOverlap({ url }: AnalyticsContext): Promise<Response> {
  const keywords = url.searchParams.get('keywords') || '';
  const dateStart = url.searchParams.get('date_start');
  const dateEnd = url.searchParams.get('date_end');

  if (!keywords || !dateStart || !dateEnd) {
    return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
  }

  const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

  try {
    const data = await executeQuery(`
      WITH gdelt_mentions AS (
        SELECT kw AS keyword, 'gdelt' AS source, COUNT(*) AS mention_count
        FROM gdelt_events
        CROSS JOIN unnest($3::text[]) AS kw
        WHERE sqldate >= CAST(REPLACE($1::text, '-', '') AS INTEGER)
          AND sqldate <= CAST(REPLACE($2::text, '-', '') AS INTEGER)
          AND (actor1name ILIKE kw OR actor2name ILIKE kw OR actiongeo_fullname ILIKE kw)
        GROUP BY kw
      ),
      radio_mentions AS (
        SELECT kw AS keyword, 'radio' AS source, COUNT(*) AS mention_count
        FROM radio_transcripts
        CROSS JOIN unnest($3::text[]) AS kw
        WHERE segment_start >= $1::timestamp AND segment_start <= ($2::date + 1)::timestamp
          AND transcript ILIKE kw
        GROUP BY kw
      ),
      social_mentions AS (
        SELECT kw AS keyword, 'social' AS source, COUNT(*) AS mention_count
        FROM posts_with_sentiment
        CROSS JOIN unnest($3::text[]) AS kw
        WHERE to_timestamp(timestamp/1000) >= $1::timestamp
          AND to_timestamp(timestamp/1000) <= ($2::date + 1)::timestamp
          AND text ILIKE kw
        GROUP BY kw
      ),
      combined AS (
        SELECT * FROM gdelt_mentions
        UNION ALL
        SELECT * FROM radio_mentions
        UNION ALL
        SELECT * FROM social_mentions
      )
      SELECT
        REPLACE(keyword, '%', '') AS keyword,
        COALESCE(SUM(mention_count) FILTER (WHERE source = 'gdelt'), 0) AS gdelt_count,
        COALESCE(SUM(mention_count) FILTER (WHERE source = 'radio'), 0) AS radio_count,
        COALESCE(SUM(mention_count) FILTER (WHERE source = 'social'), 0) AS social_count
      FROM combined
      GROUP BY keyword
      ORDER BY (COALESCE(SUM(mention_count) FILTER (WHERE source = 'gdelt'), 0) + COALESCE(SUM(mention_count) FILTER (WHERE source = 'radio'), 0) + COALESCE(SUM(mention_count) FILTER (WHERE source = 'social'), 0)) DESC
    `, [dateStart, dateEnd, keywordsArray]);

    return json({ success: true, data: data || [] });
  } catch (err) {
    return queryErrorResponse('Investigation keyword overlap', err, []);
  }
}

async function investigationLocations({ url }: AnalyticsContext): Promise<Response> {
  const keywords = url.searchParams.get('keywords') || '';
  const dateStart = url.searchParams.get('date_start');
  const dateEnd = url.searchParams.get('date_end');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  if (!keywords || !dateStart || !dateEnd) {
    return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
  }

  const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

  try {
    const data = await executeQuery(`
      SELECT actiongeo_fullname AS location,
        actiongeo_countrycode AS country_code,
        ROUND(AVG(actiongeo_lat::numeric), 4) AS lat,
        ROUND(AVG(actiongeo_long::numeric), 4) AS lng,
        COUNT(*) AS event_count,
        ROUND(AVG(avgtone::numeric), 2) AS avg_tone,
        ROUND(AVG(goldsteinscale::numeric), 2) AS avg_goldstein
      FROM gdelt_events
      WHERE sqldate::text >= REPLACE($1, '-', '')
        AND sqldate::text <= REPLACE($2, '-', '')
        AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[]))
        AND actiongeo_fullname IS NOT NULL AND actiongeo_fullname != ''
      GROUP BY actiongeo_fullname, actiongeo_countrycode
      ORDER BY event_count DESC
      LIMIT $4
    `, [dateStart, dateEnd, keywordsArray, limit]);

    return json({ success: true, data: data || [] });
  } catch (err) {
    return queryErrorResponse('Investigation locations', err, []);
  }
}

async function investigationActors({ url }: AnalyticsContext): Promise<Response> {
  const keywords = url.searchParams.get('keywords') || '';
  const dateStart = url.searchParams.get('date_start');
  const dateEnd = url.searchParams.get('date_end');
  const limit = parseInt(url.searchParams.get('limit') || '30');

  if (!keywords || !dateStart || !dateEnd) {
    return json({ success: false, error: 'keywords, date_start, and date_end are required' }, { status: 400 });
  }

  const keywordsArray = keywords.split(',').map((k: string) => '%' + k.trim() + '%');

  try {
    const data = await executeQuery(`
      WITH actor_mentions AS (
        SELECT actor1name AS actor, actor1countrycode AS country_code, avgtone, goldsteinscale
        FROM gdelt_events
        WHERE sqldate::text >= REPLACE($1, '-', '')
          AND sqldate::text <= REPLACE($2, '-', '')
          AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[]))
          AND actor1name IS NOT NULL AND actor1name != ''
        UNION ALL
        SELECT actor2name AS actor, actor2countrycode AS country_code, avgtone, goldsteinscale
        FROM gdelt_events
        WHERE sqldate::text >= REPLACE($1, '-', '')
          AND sqldate::text <= REPLACE($2, '-', '')
          AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[]))
          AND actor2name IS NOT NULL AND actor2name != ''
      )
      SELECT actor, country_code,
        COUNT(*) AS mention_count,
        ROUND(AVG(avgtone::numeric), 2) AS avg_tone,
        ROUND(AVG(goldsteinscale::numeric), 2) AS avg_goldstein
      FROM actor_mentions
      GROUP BY actor, country_code
      ORDER BY mention_count DESC
      LIMIT $4
    `, [dateStart, dateEnd, keywordsArray, limit]);

    // Also get co-occurrence pairs
    const pairs = await executeQuery(`
      SELECT actor1name AS source_actor, actor2name AS target_actor, COUNT(*) AS weight
      FROM gdelt_events
      WHERE sqldate::text >= REPLACE($1, '-', '')
        AND sqldate::text <= REPLACE($2, '-', '')
        AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[]))
        AND actor1name IS NOT NULL AND actor1name != ''
        AND actor2name IS NOT NULL AND actor2name != ''
      GROUP BY actor1name, actor2name
      ORDER BY weight DESC
      LIMIT 50
    `, [dateStart, dateEnd, keywordsArray]);

    return json({ success: true, data: { actors: data || [], pairs: pairs || [] } });
  } catch (err) {
    return queryErrorResponse('Investigation actors', err, { actors: [], pairs: [] });
  }
}

export const investigationsHandlers: Record<string, AnalyticsHandler> = {
  'investigation-timeline': investigationTimeline,
  'investigation-gdelt-events': investigationGdeltEvents,
  'investigation-radio-segments': investigationRadioSegments,
  'investigation-social-posts': investigationSocialPosts,
  'investigation-keyword-overlap': investigationKeywordOverlap,
  'investigation-locations': investigationLocations,
  'investigation-actors': investigationActors
};
