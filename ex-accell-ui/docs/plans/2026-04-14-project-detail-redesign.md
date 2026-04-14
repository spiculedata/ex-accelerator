# Project Detail + Workspace Detail Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `/projects/[id]` as a workspace portfolio (matching the home page pattern) and create a new `/workspaces/[id]` page showing data source details.

**Architecture:** Two new API endpoints return enriched data in single calls. Project page uses same 65/35 layout as home (workspace cards left, activity feed right). Workspace page is full-width showing data sources and investigations.

**Tech Stack:** SvelteKit server endpoints, PostgreSQL via `postgresPool`, inline SVG sparklines, Tailwind CSS only.

---

### Task 1: Project Overview API Endpoint

**Files:**
- Create: `src/routes/api/project-overview/+server.ts`

**Step 1: Create the endpoint**

```typescript
// src/routes/api/project-overview/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const projectId = url.searchParams.get('id');
    if (!projectId) {
      return json({ success: false, error: 'id parameter required' }, { status: 400 });
    }

    // Project details
    const projects = await postgresPool.query(
      'SELECT * FROM projects WHERE id = $1', [parseInt(projectId)]
    );
    if (projects.length === 0) {
      return json({ success: false, error: 'Project not found' }, { status: 404 });
    }
    const project = projects[0];

    // Workspaces with data sources, investigations, record counts
    const workspaces = await postgresPool.query(`
      SELECT
        w.id, w.name, w.description, w.workspace_type, w.status,
        w.created_at, w.updated_at,
        COALESCE(ds.record_count, 0) AS total_records,
        COALESCE(ds.source_count, 0) AS data_source_count,
        COALESCE(ds.source_names, '{}') AS source_names,
        COALESCE(ds.source_types, '{}') AS source_types,
        COALESCE(inv.investigation_count, 0) AS investigation_count
      FROM workspaces w
      LEFT JOIN (
        SELECT workspace_id,
          SUM(record_count) AS record_count,
          COUNT(*) AS source_count,
          ARRAY_AGG(DISTINCT source_name) AS source_names,
          ARRAY_AGG(DISTINCT source_type) AS source_types
        FROM workspace_data_sources WHERE status = 'active'
        GROUP BY workspace_id
      ) ds ON ds.workspace_id = w.id
      LEFT JOIN (
        SELECT workspace_id, COUNT(*) AS investigation_count
        FROM investigations GROUP BY workspace_id
      ) inv ON inv.workspace_id = w.id
      WHERE w.project_id = $1
      ORDER BY w.updated_at DESC
    `, [parseInt(projectId)]);

    // Enrich each workspace with sparkline + sentiment (using workspace data source types to query)
    const enrichedWorkspaces = await Promise.all(
      workspaces.map(async (w: any) => {
        const sourceTypes: string[] = Array.isArray(w.source_types) ? w.source_types : [];
        const hasSocial = sourceTypes.some((t: string) =>
          ['twitter', 'reddit', 'telegram', 'youtube', 'facebook', 'instagram', 'bluesky'].includes(t)
        );

        // Get investigations for this workspace to extract keywords for sparkline
        const investigations = await postgresPool.query(
          'SELECT query_config FROM investigations WHERE workspace_id = $1', [w.id]
        );

        const allKeywords = new Set<string>();
        let dateStart = '';
        let dateEnd = '';
        for (const inv of investigations) {
          const config = inv.query_config || {};
          for (const kw of (config.keywords || [])) allKeywords.add(kw);
          if (!dateStart || (config.dateStart && config.dateStart < dateStart)) dateStart = config.dateStart || '';
          if (!dateEnd || (config.dateEnd && config.dateEnd > dateEnd)) dateEnd = config.dateEnd || '';
        }
        const keywords = [...allKeywords];

        let sparkline: number[] = [];
        let avgSentiment = 0;
        let sentimentTrend = 'neutral';
        let anomaly: { type: string; date: string } | null = null;

        if (keywords.length > 0 && dateStart && dateEnd) {
          const keywordsArray = keywords.map((k: string) => '%' + k.trim() + '%');
          try {
            const sparklineData = await postgresPool.query(`
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
            `, [dateStart, dateEnd, keywordsArray]);

            sparkline = sparklineData.map((d: any) =>
              Number(d.gdelt_events) + Number(d.radio_segments) + Number(d.social_posts)
            );

            const sentimentScores = sparklineData.map((d: any) => {
              const sources: number[] = [];
              if (Number(d.gdelt_events) > 0) sources.push(Number(d.gdelt_tone) / 10);
              const rTotal = Number(d.radio_segments);
              if (rTotal > 0) sources.push((Number(d.radio_pos) - Number(d.radio_neg)) / rTotal);
              const sTotal = Number(d.social_posts);
              if (sTotal > 0) sources.push((Number(d.social_pos) - Number(d.social_neg)) / sTotal);
              return sources.length > 0 ? sources.reduce((a, b) => a + b, 0) / sources.length : 0;
            });

            avgSentiment = sentimentScores.length > 0
              ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length : 0;

            const half = Math.floor(sentimentScores.length / 2);
            const firstAvg = half > 0 ? sentimentScores.slice(0, half).reduce((a, b) => a + b, 0) / half : 0;
            const secondAvg = half > 0 ? sentimentScores.slice(half).reduce((a, b) => a + b, 0) / sentimentScores.slice(half).length : 0;
            sentimentTrend = (secondAvg - firstAvg) > 0.05 ? 'positive' : (secondAvg - firstAvg) < -0.05 ? 'negative' : 'neutral';

            const totalEvents = sparkline.reduce((a, b) => a + b, 0);
            const dailyAvg = totalEvents / Math.max(1, sparkline.length);
            const last2 = sparkline.slice(-2);
            if (last2.some(v => v > dailyAvg * 2 && dailyAvg > 0)) {
              const idx = last2[1] > dailyAvg * 2 ? sparklineData.length - 1 : sparklineData.length - 2;
              anomaly = { type: 'volume_spike', date: sparklineData[idx]?.date };
            } else {
              const sentLast2 = sentimentScores.slice(-2);
              if (sentLast2.some((s, i) => {
                const prev = i === 0 ? (sentimentScores.length > 2 ? sentimentScores[sentimentScores.length - 3] : 0) : sentLast2[i - 1];
                return Math.abs(s - prev) > 0.3;
              })) {
                anomaly = { type: 'sentiment_shift', date: sparklineData[sparklineData.length - 1]?.date };
              }
            }
          } catch (err) {
            console.error('Sparkline query failed for workspace', w.id, err);
          }
        }

        return {
          id: w.id,
          name: w.name,
          description: w.description,
          workspace_type: w.workspace_type,
          status: w.status,
          data_source_count: Number(w.data_source_count),
          source_names: Array.isArray(w.source_names) ? w.source_names : [],
          source_types: Array.isArray(w.source_types) ? w.source_types : [],
          total_records: Number(w.total_records),
          investigation_count: Number(w.investigation_count),
          last_activity: w.updated_at,
          sparkline,
          avg_sentiment: Math.round(avgSentiment * 100) / 100,
          sentiment_trend: sentimentTrend,
          anomaly
        };
      })
    );

    // Activity feed scoped to this project's data
    // For now, reuse global activity (project-scoped filtering can come later)
    const activity = await buildProjectActivityFeed();

    const totalRecords = enrichedWorkspaces.reduce((sum, w) => sum + w.total_records, 0);
    const totalDataSources = enrichedWorkspaces.reduce((sum, w) => sum + w.data_source_count, 0);
    const totalInvestigations = enrichedWorkspaces.reduce((sum, w) => sum + w.investigation_count, 0);
    const alerts = enrichedWorkspaces.filter(w => w.anomaly !== null).length;

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

async function buildProjectActivityFeed() {
  const activities: any[] = [];
  try {
    const gdelt = await postgresPool.query(`
      SELECT TO_DATE(sqldate::text, 'YYYYMMDD') AS event_date, COUNT(*) AS cnt
      FROM gdelt_events
      WHERE sqldate >= CAST(TO_CHAR((CURRENT_DATE - INTERVAL '7 days')::date, 'YYYYMMDD') AS INTEGER)
      GROUP BY 1 ORDER BY 1 DESC LIMIT 7
    `);
    for (const row of gdelt) {
      activities.push({ type: 'data_ingestion', message: `${Number(row.cnt).toLocaleString()} GDELT events`, project_name: 'GDELT', project_id: null, timestamp: row.event_date });
    }
    const radio = await postgresPool.query(`
      SELECT DATE(segment_start) AS event_date, COUNT(*) AS cnt
      FROM radio_transcripts WHERE segment_start >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY 1 ORDER BY 1 DESC LIMIT 5
    `);
    for (const row of radio) {
      activities.push({ type: 'data_ingestion', message: `${Number(row.cnt).toLocaleString()} radio segments`, project_name: 'Radio', project_id: null, timestamp: row.event_date });
    }
    const social = await postgresPool.query(`
      SELECT DATE(to_timestamp(timestamp/1000)) AS event_date, COUNT(*) AS cnt
      FROM posts_with_sentiment WHERE to_timestamp(timestamp/1000) >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY 1 ORDER BY 1 DESC LIMIT 5
    `);
    for (const row of social) {
      activities.push({ type: 'data_ingestion', message: `${Number(row.cnt).toLocaleString()} social posts`, project_name: 'Social', project_id: null, timestamp: row.event_date });
    }
  } catch (err) {
    console.error('Error building project activity feed:', err);
  }
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return activities.slice(0, 20);
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add "src/routes/api/project-overview/+server.ts"
git commit -m "feat(projects): add /api/project-overview endpoint with workspace sparklines"
```

---

### Task 2: Workspace Overview API Endpoint

**Files:**
- Create: `src/routes/api/workspace-overview/+server.ts`

**Step 1: Create the endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const workspaceId = url.searchParams.get('id');
    if (!workspaceId) {
      return json({ success: false, error: 'id parameter required' }, { status: 400 });
    }

    // Workspace with project info
    const workspaces = await postgresPool.query(`
      SELECT w.*, p.name AS project_name, p.id AS project_id
      FROM workspaces w
      JOIN projects p ON p.id = w.project_id
      WHERE w.id = $1
    `, [parseInt(workspaceId)]);

    if (workspaces.length === 0) {
      return json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }
    const workspace = workspaces[0];

    // Data sources
    const dataSources = await postgresPool.query(`
      SELECT id, source_type, source_name, status, record_count,
        connection_details, last_sync, created_at
      FROM workspace_data_sources
      WHERE workspace_id = $1
      ORDER BY created_at DESC
    `, [parseInt(workspaceId)]);

    // Investigations
    const investigations = await postgresPool.query(`
      SELECT id, name, description, query_config, created_at, updated_at
      FROM investigations
      WHERE workspace_id = $1
      ORDER BY updated_at DESC
    `, [parseInt(workspaceId)]);

    const totalRecords = dataSources.reduce((sum: number, ds: any) => sum + Number(ds.record_count || 0), 0);

    return json({
      success: true,
      workspace,
      data_sources: dataSources,
      investigations,
      summary: {
        total_records: totalRecords,
        total_data_sources: dataSources.length,
        total_investigations: investigations.length
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('GET /api/workspace-overview error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add "src/routes/api/workspace-overview/+server.ts"
git commit -m "feat(workspaces): add /api/workspace-overview endpoint"
```

---

### Task 3: Rewrite Project Detail Page

**Files:**
- Rewrite: `src/routes/projects/[id]/+page.svelte`

**Step 1: Complete rewrite of the project detail page**

Replace the entire file. The new page:
- Fetches from `GET /api/project-overview?id={id}`
- Renders a slim header (back arrow + project name + type badge + description + summary stats + stat pills)
- 65/35 layout: workspace cards grid left, activity feed right
- Each workspace card has: name, type badge, data source pills, freshness, sparkline, record count, insight line, investigation count, anomaly accent
- Cards click → `/workspaces/{id}`
- Activity feed: same pattern as home page
- Loading skeleton, error state, empty state
- Auto-refresh every 60 seconds
- Tailwind CSS only, light theme

Use the same helper functions as the home page (sparklinePath, freshness, insightText, formatCount, relativeTime).

**Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add "src/routes/projects/[id]/+page.svelte"
git commit -m "feat(projects): redesign project detail with workspace cards and activity feed"
```

---

### Task 4: Create Workspace Detail Page

**Files:**
- Create: `src/routes/workspaces/[id]/+page.svelte`

**Step 1: Create the workspace detail page**

New page that:
- Fetches from `GET /api/workspace-overview?id={id}`
- Slim header: back arrow (→ `/projects/{project_id}`) + workspace name + type badge + description + summary line
- Full-width content area with two sections:

**Data Sources section:** Cards for each data source showing:
- Source name + source type with platform colour (twitter=sky, reddit=orange, telegram=sky, youtube=red)
- Status badge (active=green, paused=amber, error=red)
- Record count formatted
- Last sync timestamp
- Connection health indicator dot

**Investigations section:** List of investigations with:
- Name (clickable → `/investigations/{id}`)
- Keywords as pills
- Date range
- Last updated timestamp

Action buttons: "New Investigation" + "Add Data Source"
Loading skeleton, error state, empty states for each section
Tailwind CSS only, light theme

**Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add "src/routes/workspaces/[id]/+page.svelte"
git commit -m "feat(workspaces): create workspace detail page with data sources and investigations"
```

---

### Task 5: Update Home Page Card Navigation

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Ensure home page project cards navigate to `/projects/{id}`**

Verify the home page card onclick goes to `/projects/${project.id}` (already done in earlier fix). Also update the "View" link in the card bottom row to be consistent.

**Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit (if changes needed)**

```bash
git add "src/routes/+page.svelte"
git commit -m "fix(home): ensure project cards navigate to project detail page"
```

---

### Task 6: Save to Cognee

**Step 1: Save the project/workspace page architecture to Cognee**

Use `mcp__cognee__cognify` to document the new navigation flow: home → project detail → workspace detail → investigation, with the API endpoints and data shapes.

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/routes/api/project-overview/+server.ts` |
| Create | `src/routes/api/workspace-overview/+server.ts` |
| Rewrite | `src/routes/projects/[id]/+page.svelte` |
| Create | `src/routes/workspaces/[id]/+page.svelte` |
| Maybe modify | `src/routes/+page.svelte` |

## Verification

1. `npm run build` passes
2. Navigate to `/` — project cards show, click one → `/projects/{id}`
3. Project page shows workspace cards with sparklines, source pills, activity feed
4. Click workspace card → `/workspaces/{id}`
5. Workspace page shows data sources with status, investigations list
6. Back arrow navigates up the hierarchy correctly
7. Responsive on mobile (stacks)
