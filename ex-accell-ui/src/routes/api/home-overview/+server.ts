// Home Overview API Endpoint
// Returns all data needed for the home page in one round trip:
// projects with sparklines/sentiment/anomalies, activity feed, summary stats

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';

export const GET: RequestHandler = async () => {
  try {
    // Get all investigations grouped by their keywords/date config
    const projects = await postgresPool.query(`
      SELECT
        i.id,
        i.name,
        i.description,
        i.query_config,
        i.created_at,
        i.updated_at,
        (SELECT COUNT(*) FROM investigations sub WHERE sub.workspace_id = i.workspace_id) as investigation_count
      FROM investigations i
      ORDER BY i.updated_at DESC
    `);

    // For each project, compute sparkline + sentiment + anomaly
    const enrichedProjects = await Promise.all(
      projects.map(async (p: any) => {
        const config = p.query_config || {};
        const keywords: string[] = config.keywords || [];
        const dateStart: string = config.dateStart || '';
        const dateEnd: string = config.dateEnd || '';

        if (!keywords.length || !dateStart || !dateEnd) {
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            keywords,
            date_start: dateStart,
            date_end: dateEnd,
            sources: { gdelt: false, radio: false, social: false },
            event_count: 0,
            investigation_count: Number(p.investigation_count || 0),
            last_activity: p.updated_at,
            sparkline: [],
            avg_sentiment: 0,
            sentiment_trend: 'neutral' as const,
            anomaly: null
          };
        }

        const keywordsArray = keywords.map((k: string) => '%' + k.trim() + '%');

        // 14-day sparkline + source presence + sentiment
        const sparklineData = await postgresPool.query(
          `
          WITH date_range AS (
            SELECT generate_series(
              GREATEST($1::date, CURRENT_DATE - INTERVAL '13 days'),
              LEAST($2::date, CURRENT_DATE),
              '1 day'::interval
            )::date AS d
          ),
          gdelt AS (
            SELECT TO_DATE(sqldate::text, 'YYYYMMDD') AS d,
              COUNT(*) AS cnt, AVG(avgtone) AS avg_tone
            FROM gdelt_events
            WHERE sqldate >= CAST(REPLACE(GREATEST($1::date, CURRENT_DATE - INTERVAL '13 days')::text, '-', '') AS INTEGER)
              AND sqldate <= CAST(REPLACE(LEAST($2::date, CURRENT_DATE)::text, '-', '') AS INTEGER)
              AND (actor1name ILIKE ANY($3::text[]) OR actor2name ILIKE ANY($3::text[])
                   OR actiongeo_fullname ILIKE ANY($3::text[]))
            GROUP BY 1
          ),
          radio AS (
            SELECT DATE(segment_start) AS d, COUNT(*) AS cnt,
              COUNT(*) FILTER (WHERE sentiment = 'positive') AS pos,
              COUNT(*) FILTER (WHERE sentiment = 'negative') AS neg
            FROM radio_transcripts
            WHERE segment_start >= GREATEST($1::date, CURRENT_DATE - INTERVAL '13 days')::timestamp
              AND segment_start <= (LEAST($2::date, CURRENT_DATE) + 1)::timestamp
              AND transcript ILIKE ANY($3::text[])
            GROUP BY 1
          ),
          social AS (
            SELECT DATE(to_timestamp(timestamp/1000)) AS d, COUNT(*) AS cnt,
              COUNT(*) FILTER (WHERE sentiment_category IN ('Positive','Very Positive')) AS pos,
              COUNT(*) FILTER (WHERE sentiment_category IN ('Negative','Very Negative')) AS neg
            FROM posts_with_sentiment
            WHERE to_timestamp(timestamp/1000) >= GREATEST($1::date, CURRENT_DATE - INTERVAL '13 days')::timestamp
              AND to_timestamp(timestamp/1000) <= (LEAST($2::date, CURRENT_DATE) + 1)::timestamp
              AND text ILIKE ANY($3::text[])
            GROUP BY 1
          )
          SELECT dr.d AS date,
            COALESCE(g.cnt, 0) AS gdelt_events,
            COALESCE(g.avg_tone, 0) AS gdelt_tone,
            COALESCE(r.cnt, 0) AS radio_segments,
            COALESCE(r.pos, 0) AS radio_pos, COALESCE(r.neg, 0) AS radio_neg,
            COALESCE(s.cnt, 0) AS social_posts,
            COALESCE(s.pos, 0) AS social_pos, COALESCE(s.neg, 0) AS social_neg
          FROM date_range dr
          LEFT JOIN gdelt g ON g.d = dr.d
          LEFT JOIN radio r ON r.d = dr.d
          LEFT JOIN social s ON s.d = dr.d
          ORDER BY dr.d
        `,
          [dateStart, dateEnd, keywordsArray]
        );

        // Compute derived values from sparkline data
        const sparkline = sparklineData.map(
          (d: any) => Number(d.gdelt_events) + Number(d.radio_segments) + Number(d.social_posts)
        );
        const totalEvents = sparkline.reduce((a: number, b: number) => a + b, 0);
        const hasGdelt = sparklineData.some((d: any) => Number(d.gdelt_events) > 0);
        const hasRadio = sparklineData.some((d: any) => Number(d.radio_segments) > 0);
        const hasSocial = sparklineData.some((d: any) => Number(d.social_posts) > 0);

        // Fused sentiment per day, then trend
        const sentimentScores = sparklineData.map((d: any) => {
          const sources: number[] = [];
          if (Number(d.gdelt_events) > 0) sources.push(Number(d.gdelt_tone) / 10);
          const rTotal = Number(d.radio_segments);
          if (rTotal > 0) sources.push((Number(d.radio_pos) - Number(d.radio_neg)) / rTotal);
          const sTotal = Number(d.social_posts);
          if (sTotal > 0) sources.push((Number(d.social_pos) - Number(d.social_neg)) / sTotal);
          return sources.length > 0 ? sources.reduce((a, b) => a + b, 0) / sources.length : 0;
        });

        const avgSentiment =
          sentimentScores.length > 0
            ? sentimentScores.reduce((a: number, b: number) => a + b, 0) / sentimentScores.length
            : 0;

        // Trend: compare second half avg to first half avg
        const half = Math.floor(sentimentScores.length / 2);
        const firstHalf = sentimentScores.slice(0, half);
        const secondHalf = sentimentScores.slice(half);
        const firstAvg =
          firstHalf.length > 0
            ? firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length
            : 0;
        const secondAvg =
          secondHalf.length > 0
            ? secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length
            : 0;
        const sentimentTrend =
          secondAvg - firstAvg > 0.05
            ? 'positive'
            : secondAvg - firstAvg < -0.05
              ? 'negative'
              : 'neutral';

        // Anomaly: check last 2 days vs 14-day average
        const dailyAvg = totalEvents / Math.max(1, sparkline.length);
        const last2 = sparkline.slice(-2);
        const volumeSpike = last2.some((v: number) => v > dailyAvg * 2 && dailyAvg > 0);
        const sentLast2 = sentimentScores.slice(-2);
        const sentShift = sentLast2.some((s: number, i: number) => {
          const prev =
            i === 0
              ? sentimentScores.length > 2
                ? sentimentScores[sentimentScores.length - 3]
                : 0
              : sentLast2[i - 1];
          return Math.abs(s - prev) > 0.3;
        });

        let anomaly: { type: string; date: string } | null = null;
        if (volumeSpike) {
          const spikeIdx =
            last2[1] > dailyAvg * 2 ? sparklineData.length - 1 : sparklineData.length - 2;
          anomaly = { type: 'volume_spike', date: sparklineData[spikeIdx]?.date };
        } else if (sentShift) {
          anomaly = {
            type: 'sentiment_shift',
            date: sparklineData[sparklineData.length - 1]?.date
          };
        }

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          keywords,
          date_start: dateStart,
          date_end: dateEnd,
          sources: { gdelt: hasGdelt, radio: hasRadio, social: hasSocial },
          event_count: totalEvents,
          investigation_count: Number(p.investigation_count || 0),
          last_activity: p.updated_at,
          sparkline,
          avg_sentiment: Math.round(avgSentiment * 100) / 100,
          sentiment_trend: sentimentTrend,
          anomaly
        };
      })
    );

    // Summary stats
    const totalEvents = enrichedProjects.reduce((sum, p) => sum + p.event_count, 0);
    const alerts = enrichedProjects.filter((p) => p.anomaly !== null).length;

    // Activity feed: recent ingestion data across sources
    const activity = await buildActivityFeed();

    return json({
      success: true,
      projects: enrichedProjects,
      activity,
      summary: {
        total_projects: enrichedProjects.length,
        total_events: totalEvents,
        active_crawlers: 0,
        alerts
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('GET /api/home-overview error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};

async function buildActivityFeed() {
  const activities: Array<{
    type: string;
    message: string;
    project_name: string;
    project_id: number | null;
    timestamp: string;
  }> = [];

  try {
    // Recent GDELT ingestion events (daily counts from last 7 days)
    const gdeltActivity = await postgresPool.query(`
      SELECT TO_DATE(sqldate::text, 'YYYYMMDD') AS event_date, COUNT(*) AS cnt
      FROM gdelt_events
      WHERE sqldate >= CAST(REPLACE((CURRENT_DATE - INTERVAL '7 days')::text, '-', '') AS INTEGER)
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 7
    `);

    for (const row of gdeltActivity) {
      activities.push({
        type: 'data_ingestion',
        message: `${Number(row.cnt).toLocaleString()} GDELT events on ${row.event_date}`,
        project_name: 'All Projects',
        project_id: null,
        timestamp: row.event_date
      });
    }

    // Recent radio ingestion
    const radioActivity = await postgresPool.query(`
      SELECT DATE(segment_start) AS event_date, COUNT(*) AS cnt
      FROM radio_transcripts
      WHERE segment_start >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 5
    `);

    for (const row of radioActivity) {
      activities.push({
        type: 'data_ingestion',
        message: `${Number(row.cnt).toLocaleString()} radio segments on ${row.event_date}`,
        project_name: 'All Projects',
        project_id: null,
        timestamp: row.event_date
      });
    }

    // Recent social ingestion
    const socialActivity = await postgresPool.query(`
      SELECT DATE(to_timestamp(timestamp/1000)) AS event_date, COUNT(*) AS cnt
      FROM posts_with_sentiment
      WHERE to_timestamp(timestamp/1000) >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 5
    `);

    for (const row of socialActivity) {
      activities.push({
        type: 'data_ingestion',
        message: `${Number(row.cnt).toLocaleString()} social posts on ${row.event_date}`,
        project_name: 'All Projects',
        project_id: null,
        timestamp: row.event_date
      });
    }
  } catch (err) {
    console.error('Error building activity feed:', err);
  }

  // Sort all activities by timestamp desc, take top 20
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return activities.slice(0, 20);
}
