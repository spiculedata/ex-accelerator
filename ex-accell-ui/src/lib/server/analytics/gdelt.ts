import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import { queryErrorResponse } from '$lib/server/queryErrors';
import type { AnalyticsContext, AnalyticsHandler } from './types';

async function gdeltSummary({ url }: AnalyticsContext): Promise<Response> {
  try {
    const dateStart = url.searchParams.get('dateStart');
    const dateEnd = url.searchParams.get('dateEnd');
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Convert YYYY-MM-DD to YYYYMM for monthly materialized view
    if (dateStart) {
      conditions.push(`year_month >= $${paramIndex}`);
      params.push(parseInt(dateStart.replace(/-/g, '').substring(0, 6)));
      paramIndex++;
    }
    if (dateEnd) {
      conditions.push(`year_month <= $${paramIndex}`);
      params.push(parseInt(dateEnd.replace(/-/g, '').substring(0, 6)));
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Use pre-aggregated materialized view (44 rows vs 23M)
    const data = await executeQuery(`
      SELECT
        SUM(events) as total_events,
        MAX(countries) as countries,
        SUM(events * avg_goldstein) / NULLIF(SUM(events), 0) as avg_goldstein,
        SUM(events * avg_tone) / NULLIF(SUM(events), 0) as avg_tone,
        SUM(events * avg_articles) / NULLIF(SUM(events), 0) as avg_articles,
        MIN(date_min) as date_min,
        MAX(date_max) as date_max
      FROM gdelt_summary_monthly ${where}
    `, params);

    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('GDELT summary', error, []);
  }
}

async function gdeltByCountry({ url }: AnalyticsContext): Promise<Response> {
  try {
    const dateStart = url.searchParams.get('dateStart');
    const dateEnd = url.searchParams.get('dateEnd');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dateStart) {
      conditions.push(`year_month >= $${paramIndex}`);
      params.push(parseInt(dateStart.replace(/-/g, '').substring(0, 6)));
      paramIndex++;
    }
    if (dateEnd) {
      conditions.push(`year_month <= $${paramIndex}`);
      params.push(parseInt(dateEnd.replace(/-/g, '').substring(0, 6)));
      paramIndex++;
    }

    params.push(limit);
    const limitParam = `$${paramIndex}`;
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Use pre-aggregated materialized view (6250 rows vs 23M)
    const data = await executeQuery(`
      SELECT country, SUM(events) as events,
             SUM(events * avg_goldstein) / NULLIF(SUM(events), 0) as avg_goldstein,
             SUM(events * avg_tone) / NULLIF(SUM(events), 0) as avg_tone
      FROM gdelt_country_monthly ${where}
      GROUP BY country
      ORDER BY events DESC
      LIMIT ${limitParam}
    `, params);

    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('GDELT by country', error, []);
  }
}

async function gdeltByEventtype({ url, type }: AnalyticsContext): Promise<Response> {
  try {
    const dateStart = url.searchParams.get('dateStart');
    const dateEnd = url.searchParams.get('dateEnd');
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dateStart) {
      conditions.push(`year_month >= $${paramIndex}`);
      params.push(parseInt(dateStart.replace(/-/g, '').slice(0, 6)));
      paramIndex++;
    }
    if (dateEnd) {
      conditions.push(`year_month <= $${paramIndex}`);
      params.push(parseInt(dateEnd.replace(/-/g, '').slice(0, 6)));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const data = await executeQuery(`
      SELECT eventrootcode as code,
             CASE eventrootcode
               WHEN '1' THEN 'Public Statements & Speeches'
               WHEN '2' THEN 'Appeals & Requests'
               WHEN '3' THEN 'Cooperation & Agreements'
               WHEN '4' THEN 'Consultations & Meetings'
               WHEN '5' THEN 'Diplomatic Actions'
               WHEN '6' THEN 'Material Cooperation & Aid'
               WHEN '7' THEN 'Providing Aid & Assistance'
               WHEN '8' THEN 'Concessions & Yielding'
               WHEN '9' THEN 'Investigations & Monitoring'
               WHEN '10' THEN 'Demands & Pressure'
               WHEN '11' THEN 'Criticism & Disapproval'
               WHEN '12' THEN 'Rejection & Refusal'
               WHEN '13' THEN 'Threats & Intimidation'
               WHEN '14' THEN 'Protests & Demonstrations'
               WHEN '15' THEN 'Military Posturing'
               WHEN '16' THEN 'Sanctions & Reduced Relations'
               WHEN '17' THEN 'Coercion & Repression'
               WHEN '18' THEN 'Assault & Physical Violence'
               WHEN '19' THEN 'Armed Conflict & Fighting'
               WHEN '20' THEN 'Conventional Military Force'
               ELSE 'Other (' || eventrootcode || ')'
             END as event_type,
             SUM(events) as events,
             SUM(events * avg_goldstein) / NULLIF(SUM(events), 0) as avg_goldstein
      FROM gdelt_eventtype_monthly
      ${whereClause}
      GROUP BY eventrootcode
      ORDER BY events DESC
    `, params);

    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('GDELT by event type', error, []);
  }
}

async function gdeltTimeline({ url }: AnalyticsContext): Promise<Response> {
  try {
    const dateStart = url.searchParams.get('dateStart');
    const dateEnd = url.searchParams.get('dateEnd');
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dateStart) {
      conditions.push(`sqldate >= $${paramIndex}`);
      params.push(parseInt(dateStart.replace(/-/g, '')));
      paramIndex++;
    }
    if (dateEnd) {
      conditions.push(`sqldate <= $${paramIndex}`);
      params.push(parseInt(dateEnd.replace(/-/g, '')));
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Use materialized view for timeline (pre-aggregated, much faster)
    const data = await executeQuery(`
      SELECT sqldate as date, event_count as events,
             avg_goldstein, avg_tone
      FROM gdelt_daily_stats ${where}
      ORDER BY sqldate
    `, params);

    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('GDELT timeline', error, []);
  }
}

async function gdeltTopActors({ url }: AnalyticsContext): Promise<Response> {
  try {
    const dateStart = url.searchParams.get('dateStart');
    const dateEnd = url.searchParams.get('dateEnd');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dateStart) {
      conditions.push(`year_month >= $${paramIndex}`);
      params.push(parseInt(dateStart.replace(/-/g, '').slice(0, 6)));
      paramIndex++;
    }
    if (dateEnd) {
      conditions.push(`year_month <= $${paramIndex}`);
      params.push(parseInt(dateEnd.replace(/-/g, '').slice(0, 6)));
      paramIndex++;
    }

    params.push(limit);
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const data = await executeQuery(`
      SELECT actor1name as actor, SUM(mentions) as mentions,
             SUM(mentions * avg_tone) / NULLIF(SUM(mentions), 0) as avg_tone
      FROM gdelt_actors_monthly
      ${whereClause}
      GROUP BY actor1name
      ORDER BY mentions DESC
      LIMIT $${paramIndex}
    `, params);

    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('GDELT top actors', error, []);
  }
}

async function gdeltCountryDetail({ url }: AnalyticsContext): Promise<Response> {
  try {
    const country = url.searchParams.get('country');
    const dateStart = url.searchParams.get('dateStart');
    const dateEnd = url.searchParams.get('dateEnd');

    if (!country) return json({ success: false, error: 'country parameter required' }, { status: 400 });

    // Build conditions for both raw table and materialized views
    const rawConditions: string[] = ['actiongeo_countrycode = $1'];
    const rawParams: any[] = [country];
    let rawParamIndex = 2;

    const mvConditions: string[] = ['country = $1'];
    const mvParams: any[] = [country];
    let mvParamIndex = 2;

    if (dateStart) {
      rawConditions.push(`sqldate >= $${rawParamIndex}`);
      rawParams.push(parseInt(dateStart.replace(/-/g, '')));
      rawParamIndex++;

      mvConditions.push(`year_month >= $${mvParamIndex}`);
      mvParams.push(parseInt(dateStart.replace(/-/g, '').substring(0, 6)));
      mvParamIndex++;
    }
    if (dateEnd) {
      rawConditions.push(`sqldate <= $${rawParamIndex}`);
      rawParams.push(parseInt(dateEnd.replace(/-/g, '')));
      rawParamIndex++;

      mvConditions.push(`year_month <= $${mvParamIndex}`);
      mvParams.push(parseInt(dateEnd.replace(/-/g, '').substring(0, 6)));
      mvParamIndex++;
    }

    const rawWhere = rawConditions.join(' AND ');
    const mvWhere = mvConditions.join(' AND ');

    // Use materialized view for summary + timeline (fast), raw table for actors + events
    const [summary, actors, eventTypes, toneTrend, keyEvents] = await Promise.all([
      // Summary from materialized view (instant)
      executeQuery(`
        SELECT SUM(events) as total_events,
               SUM(events * avg_goldstein) / NULLIF(SUM(events), 0) as avg_goldstein,
               SUM(events * avg_tone) / NULLIF(SUM(events), 0) as avg_tone,
               0 as unique_actors
        FROM gdelt_country_monthly WHERE ${mvWhere}
      `, mvParams),
      // Actors from raw table (needs row-level data, limit 15)
      executeQuery(`
        SELECT actor1name as actor, COUNT(*) as mentions, AVG(avgtone) as avg_tone
        FROM gdelt_events WHERE ${rawWhere} AND actor1name IS NOT NULL AND actor1name != ''
        GROUP BY actor1name ORDER BY mentions DESC LIMIT 15
      `, rawParams),
      executeQuery(`
        SELECT eventrootcode as code,
               CASE eventrootcode
                 WHEN '1' THEN 'Public Statements & Speeches'
                 WHEN '2' THEN 'Appeals & Requests'
                 WHEN '3' THEN 'Cooperation & Agreements'
                 WHEN '4' THEN 'Consultations & Meetings'
                 WHEN '5' THEN 'Diplomatic Actions'
                 WHEN '6' THEN 'Material Cooperation & Aid'
                 WHEN '7' THEN 'Providing Aid & Assistance'
                 WHEN '8' THEN 'Concessions & Yielding'
                 WHEN '9' THEN 'Investigations & Monitoring'
                 WHEN '10' THEN 'Demands & Pressure'
                 WHEN '11' THEN 'Criticism & Disapproval'
                 WHEN '12' THEN 'Rejection & Refusal'
                 WHEN '13' THEN 'Threats & Intimidation'
                 WHEN '14' THEN 'Protests & Demonstrations'
                 WHEN '15' THEN 'Military Posturing'
                 WHEN '16' THEN 'Sanctions & Reduced Relations'
                 WHEN '17' THEN 'Coercion & Repression'
                 WHEN '18' THEN 'Assault & Physical Violence'
                 WHEN '19' THEN 'Armed Conflict & Fighting'
                 WHEN '20' THEN 'Conventional Military Force'
                 ELSE 'Other (' || eventrootcode || ')'
               END as event_type,
               COUNT(*) as events
        FROM gdelt_events WHERE ${rawWhere} AND eventrootcode IS NOT NULL
        GROUP BY eventrootcode ORDER BY events DESC
      `, rawParams),
      // Timeline from raw table (daily granularity for detailed trends)
      executeQuery(`
        SELECT sqldate as date, COUNT(*) as events,
               AVG(avgtone) as avg_tone, AVG(goldsteinscale) as avg_goldstein
        FROM gdelt_events WHERE ${rawWhere}
        GROUP BY sqldate ORDER BY sqldate
      `, rawParams),
      // Key events from raw table (limited to 10, fast with index)
      executeQuery(`
        SELECT globaleventid, actor1name, actor2name, eventrootcode, goldsteinscale,
               avgtone, numarticles, sourceurl, sqldate,
               actiongeo_fullname
        FROM gdelt_events WHERE ${rawWhere}
        ORDER BY numarticles DESC NULLS LAST LIMIT 10
      `, rawParams)
    ]);

    return json({ success: true, data: { summary: summary[0], actors, eventTypes, toneTrend, keyEvents } });
  } catch (error) {
    return queryErrorResponse('GDELT country detail', error, {});
  }
}

async function gdeltConflicts({ url }: AnalyticsContext): Promise<Response> {
  try {
    const dateStart = url.searchParams.get('dateStart');
    const dateEnd = url.searchParams.get('dateEnd');
    const conditions: string[] = ['conflict_events > 0'];
    const params: any[] = [];
    let paramIndex = 1;

    if (dateStart) {
      conditions.push(`year_month >= $${paramIndex}`);
      params.push(parseInt(dateStart.replace(/-/g, '').substring(0, 6)));
      paramIndex++;
    }
    if (dateEnd) {
      conditions.push(`year_month <= $${paramIndex}`);
      params.push(parseInt(dateEnd.replace(/-/g, '').substring(0, 6)));
      paramIndex++;
    }

    const where = conditions.join(' AND ');

    // Use pre-aggregated materialized view
    const data = await executeQuery(`
      SELECT country, country as location,
             SUM(conflict_events) as conflict_events,
             SUM(events * avg_goldstein) / NULLIF(SUM(events), 0) as avg_goldstein,
             SUM(events * avg_tone) / NULLIF(SUM(events), 0) as avg_tone,
             0 as violent_events
      FROM gdelt_country_monthly WHERE ${where}
      GROUP BY country
      ORDER BY conflict_events DESC LIMIT 20
    `, params);

    return json({ success: true, data });
  } catch (error) {
    return queryErrorResponse('GDELT conflicts', error, []);
  }
}

async function gdeltSearch({ url }: AnalyticsContext): Promise<Response> {
  try {
    const query = url.searchParams.get('q');
    const dateStart = url.searchParams.get('dateStart');
    const dateEnd = url.searchParams.get('dateEnd');

    if (!query) return json({ success: false, error: 'q parameter required' }, { status: 400 });

    const conditions: string[] = [`(LOWER(actor1name) LIKE '%' || LOWER($1) || '%' OR LOWER(actor2name) LIKE '%' || LOWER($1) || '%' OR LOWER(actiongeo_fullname) LIKE '%' || LOWER($1) || '%')`];
    const params: any[] = [query];
    let paramIndex = 2;

    if (dateStart) {
      conditions.push(`sqldate >= $${paramIndex}`);
      params.push(parseInt(dateStart.replace(/-/g, '')));
      paramIndex++;
    }
    if (dateEnd) {
      conditions.push(`sqldate <= $${paramIndex}`);
      params.push(parseInt(dateEnd.replace(/-/g, '')));
      paramIndex++;
    }

    const where = conditions.join(' AND ');

    const [summary, events] = await Promise.all([
      executeQuery(`
        SELECT COUNT(*) as total, AVG(goldsteinscale) as avg_goldstein, AVG(avgtone) as avg_tone,
               COUNT(DISTINCT actiongeo_countrycode) as countries
        FROM gdelt_events WHERE ${where}
      `, params),
      executeQuery(`
        SELECT globaleventid, actor1name, actor2name, eventrootcode, goldsteinscale,
               avgtone, numarticles, sourceurl, sqldate, actiongeo_fullname, actiongeo_countrycode
        FROM gdelt_events WHERE ${where}
        ORDER BY numarticles DESC NULLS LAST LIMIT 50
      `, params)
    ]);

    return json({ success: true, data: { summary: summary[0], events } });
  } catch (error) {
    return queryErrorResponse('GDELT search', error, {});
  }
}

async function gdeltRefreshViews(_ctx: AnalyticsContext): Promise<Response> {
  try {
    const views = [
      'gdelt_summary_monthly',
      'gdelt_country_monthly',
      'gdelt_eventtype_monthly',
      'gdelt_actors_monthly',
      'gdelt_daily_stats'
    ];
    const results: string[] = [];
    for (const view of views) {
      try {
        await executeQuery(`REFRESH MATERIALIZED VIEW ${view}`);
        results.push(`${view}: refreshed`);
      } catch (e: any) {
        results.push(`${view}: ${e.message || 'failed'}`);
      }
    }
    return json({ success: true, data: results, message: 'Materialized views refreshed' });
  } catch (error) {
    console.error('GDELT refresh views failed:', error);
    return json({ success: false, error: 'Failed to refresh materialized views' }, { status: 500 });
  }
}

export const gdeltHandlers: Record<string, AnalyticsHandler> = {
  'gdelt-summary': gdeltSummary,
  'gdelt-by-country': gdeltByCountry,
  'gdelt-by-eventtype': gdeltByEventtype,
  'gdelt-timeline': gdeltTimeline,
  'gdelt-top-actors': gdeltTopActors,
  'gdelt-country-detail': gdeltCountryDetail,
  'gdelt-conflicts': gdeltConflicts,
  'gdelt-search': gdeltSearch,
  'gdelt-refresh-views': gdeltRefreshViews
};
