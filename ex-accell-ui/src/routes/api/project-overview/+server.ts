// Project Overview API Endpoint
// Returns all data needed for the project detail page in one round trip:
// project details, enriched workspace data (sparklines, sentiment, anomalies), activity feed, summary stats

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';

export const GET: RequestHandler = async ({ url }) => {
  const projectId = url.searchParams.get('id');

  if (!projectId) {
    return json({ success: false, error: 'Missing required parameter: id' }, { status: 400 });
  }

  const id = parseInt(projectId, 10);
  if (isNaN(id)) {
    return json({ success: false, error: 'Invalid project id' }, { status: 400 });
  }

  try {
    // 1. Get project details
    const projects = await postgresPool.query(
      `SELECT id, name, description, project_type, status, created_at, updated_at
       FROM projects WHERE id = $1`,
      [id]
    );

    if (!projects.length) {
      return json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];

    // 2. Get workspaces with data source + investigation counts
    const workspaces = await postgresPool.query(
      `
      SELECT
        w.id,
        w.name,
        w.description,
        w.workspace_type,
        w.status,
        w.created_at,
        w.updated_at,
        COALESCE(ds.data_source_count, 0) AS data_source_count,
        COALESCE(ds.source_names, '{}') AS source_names,
        COALESCE(ds.source_types, '{}') AS source_types,
        COALESCE(ds.total_records, 0) AS total_records,
        COALESCE(inv.investigation_count, 0) AS investigation_count,
        GREATEST(w.updated_at, ds.last_sync) AS last_activity
      FROM workspaces w
      LEFT JOIN (
        SELECT workspace_id,
          COUNT(*) AS data_source_count,
          ARRAY_AGG(DISTINCT source_name) AS source_names,
          ARRAY_AGG(DISTINCT source_type) AS source_types,
          SUM(record_count) AS total_records,
          MAX(last_sync) AS last_sync
        FROM workspace_data_sources
        WHERE status = 'active'
        GROUP BY workspace_id
      ) ds ON ds.workspace_id = w.id
      LEFT JOIN (
        SELECT workspace_id, COUNT(*) AS investigation_count
        FROM investigations
        GROUP BY workspace_id
      ) inv ON inv.workspace_id = w.id
      WHERE w.project_id = $1
      ORDER BY w.updated_at DESC
      `,
      [id]
    );

    // 3. Get all investigations for this project's workspaces (for sparkline keywords)
    const workspaceIds = workspaces.map((w: any) => w.id);
    let investigations: any[] = [];
    if (workspaceIds.length > 0) {
      investigations = await postgresPool.query(
        `SELECT id, workspace_id, query_config FROM investigations WHERE workspace_id = ANY($1)`,
        [workspaceIds]
      );
    }

    // 4. Enrich each workspace with sparkline, sentiment, anomaly
    const enrichedWorkspaces = await Promise.all(
      workspaces.map(async (w: any) => {
        const wsInvestigations = investigations.filter((i: any) => i.workspace_id === w.id);
        const allKeywords = new Set<string>();
        let dateStart = '';
        let dateEnd = '';

        for (const inv of wsInvestigations) {
          const config = inv.query_config || {};
          for (const kw of config.keywords || []) allKeywords.add(kw);
          if (!dateStart || (config.dateStart && config.dateStart < dateStart))
            dateStart = config.dateStart || '';
          if (!dateEnd || (config.dateEnd && config.dateEnd > dateEnd))
            dateEnd = config.dateEnd || '';
        }

        const keywords = [...allKeywords];
        const sourceTypes: string[] = Array.isArray(w.source_types) ? w.source_types : [];

        // Base workspace fields
        const base = {
          id: w.id,
          name: w.name,
          description: w.description,
          workspace_type: w.workspace_type,
          status: w.status,
          data_source_count: Number(w.data_source_count || 0),
          source_names: Array.isArray(w.source_names) ? w.source_names : [],
          source_types: sourceTypes,
          total_records: Number(w.total_records || 0),
          investigation_count: Number(w.investigation_count || 0),
          last_activity: w.last_activity || w.updated_at
        };

        if (!keywords.length || !dateStart || !dateEnd) {
          return {
            ...base,
            sparkline: [],
            avg_sentiment: 0,
            sentiment_trend: 'neutral' as const,
            anomaly: null
          };
        }

        const keywordsArray = keywords.map((k: string) => '%' + k.trim() + '%');

        // 14-day sparkline query across GDELT + radio + social
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
            WHERE sqldate >= CAST(TO_CHAR(GREATEST($1::date, CURRENT_DATE - INTERVAL '13 days')::date, 'YYYYMMDD') AS INTEGER)
              AND sqldate <= CAST(TO_CHAR(LEAST($2::date, CURRENT_DATE)::date, 'YYYYMMDD') AS INTEGER)
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

        // Compute sparkline values (total events per day)
        const sparkline = sparklineData.map(
          (d: any) => Number(d.gdelt_events) + Number(d.radio_segments) + Number(d.social_posts)
        );
        const totalEvents = sparkline.reduce((a: number, b: number) => a + b, 0);

        // Fused sentiment per day
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

        // Trend: second half avg vs first half avg
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

        // Anomaly detection: volume >2x daily avg or sentiment swing >0.3 in last 48h
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
          ...base,
          sparkline,
          avg_sentiment: Math.round(avgSentiment * 100) / 100,
          sentiment_trend: sentimentTrend,
          anomaly
        };
      })
    );

    // 5. Activity feed scoped to this project's keywords
    const activity = await buildActivityFeed(id);

    // 6. Summary stats
    const totalRecords = enrichedWorkspaces.reduce((sum, w) => sum + w.total_records, 0);
    const totalDataSources = enrichedWorkspaces.reduce((sum, w) => sum + w.data_source_count, 0);
    const totalInvestigations = enrichedWorkspaces.reduce(
      (sum, w) => sum + w.investigation_count,
      0
    );
    const alerts = enrichedWorkspaces.filter((w) => w.anomaly !== null).length;

    return json({
      success: true,
      project,
      workspaces: enrichedWorkspaces,
      activity,
      summary: {
        total_workspaces: enrichedWorkspaces.length,
        total_records: totalRecords,
        total_data_sources: totalDataSources,
        total_investigations: totalInvestigations,
        alerts
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('GET /api/project-overview error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};

async function buildActivityFeed(projectId: number) {
  const activities: Array<{
    type: string;
    message: string;
    project_name: string;
    project_id: number;
    timestamp: string;
  }> = [];

  try {
    // Get project name for activity entries
    const projectRows = await postgresPool.query(
      `SELECT name FROM projects WHERE id = $1`,
      [projectId]
    );
    const projectName = projectRows[0]?.name || 'Unknown';

    // Get keywords from all investigations belonging to this project
    const invRows = await postgresPool.query(
      `SELECT i.query_config
       FROM investigations i
       JOIN workspaces w ON i.workspace_id = w.id
       WHERE w.project_id = $1`,
      [projectId]
    );

    const allKeywords = new Set<string>();
    for (const inv of invRows) {
      const config = inv.query_config || {};
      for (const kw of config.keywords || []) allKeywords.add(kw);
    }

    const keywords = [...allKeywords];
    if (!keywords.length) return activities;

    const keywordsArray = keywords.map((k: string) => '%' + k.trim() + '%');

    // Recent GDELT ingestion events (last 7 days, filtered by project keywords)
    const gdeltActivity = await postgresPool.query(
      `
      SELECT TO_DATE(sqldate::text, 'YYYYMMDD') AS event_date, COUNT(*) AS cnt
      FROM gdelt_events
      WHERE sqldate >= CAST(TO_CHAR((CURRENT_DATE - INTERVAL '7 days')::date, 'YYYYMMDD') AS INTEGER)
        AND (actor1name ILIKE ANY($1::text[]) OR actor2name ILIKE ANY($1::text[])
             OR actiongeo_fullname ILIKE ANY($1::text[]))
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 7
      `,
      [keywordsArray]
    );

    for (const row of gdeltActivity) {
      activities.push({
        type: 'data_ingestion',
        message: `${Number(row.cnt).toLocaleString()} GDELT events on ${row.event_date}`,
        project_name: projectName,
        project_id: projectId,
        timestamp: row.event_date
      });
    }

    // Recent radio ingestion
    const radioActivity = await postgresPool.query(
      `
      SELECT DATE(segment_start) AS event_date, COUNT(*) AS cnt
      FROM radio_transcripts
      WHERE segment_start >= CURRENT_DATE - INTERVAL '7 days'
        AND transcript ILIKE ANY($1::text[])
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 5
      `,
      [keywordsArray]
    );

    for (const row of radioActivity) {
      activities.push({
        type: 'data_ingestion',
        message: `${Number(row.cnt).toLocaleString()} radio segments on ${row.event_date}`,
        project_name: projectName,
        project_id: projectId,
        timestamp: row.event_date
      });
    }

    // Recent social ingestion
    const socialActivity = await postgresPool.query(
      `
      SELECT DATE(to_timestamp(timestamp/1000)) AS event_date, COUNT(*) AS cnt
      FROM posts_with_sentiment
      WHERE to_timestamp(timestamp/1000) >= CURRENT_DATE - INTERVAL '7 days'
        AND text ILIKE ANY($1::text[])
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 5
      `,
      [keywordsArray]
    );

    for (const row of socialActivity) {
      activities.push({
        type: 'data_ingestion',
        message: `${Number(row.cnt).toLocaleString()} social posts on ${row.event_date}`,
        project_name: projectName,
        project_id: projectId,
        timestamp: row.event_date
      });
    }
  } catch (err) {
    console.error('Error building project activity feed:', err);
  }

  // Sort by timestamp desc, top 20
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return activities.slice(0, 20);
}
