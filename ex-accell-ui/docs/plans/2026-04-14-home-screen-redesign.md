# Home Screen Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic launcher home page with an informative project portfolio view (cards with sparklines, sentiment, anomalies) plus a live activity feed sidebar.

**Architecture:** Single API endpoint (`GET /api/home-overview`) returns all data in one call. Page component renders a slim header bar, a 65/35 split with project cards grid left and scrollable activity feed right. Light theme. Auto-refreshes every 60 seconds.

**Tech Stack:** SvelteKit server endpoint, PostgreSQL queries via `postgresPool`, inline SVG sparklines, Tailwind CSS.

---

### Task 1: API Endpoint — Project Overview Query

**Files:**
- Create: `src/routes/api/home-overview/+server.ts`

**Step 1: Create the endpoint with project data query**

```typescript
// src/routes/api/home-overview/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';

export const GET: RequestHandler = async () => {
  try {
    // Get all investigations grouped by their keywords/date config
    // Each investigation acts as a "project" for the home overview
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
        const keywords = config.keywords || [];
        const dateStart = config.dateStart || '';
        const dateEnd = config.dateEnd || '';

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
            sentiment_trend: 'neutral',
            anomaly: null
          };
        }

        const keywordsArray = keywords.map((k: string) => '%' + k.trim() + '%');

        // 14-day sparkline + source presence + sentiment
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
        `, [dateStart, dateEnd, keywordsArray]);

        // Compute derived values from sparkline data
        const sparkline = sparklineData.map((d: any) =>
          Number(d.gdelt_events) + Number(d.radio_segments) + Number(d.social_posts)
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

        const avgSentiment = sentimentScores.length > 0
          ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
          : 0;

        // Trend: compare last 7 days avg to first 7 days avg
        const half = Math.floor(sentimentScores.length / 2);
        const firstHalf = sentimentScores.slice(0, half);
        const secondHalf = sentimentScores.slice(half);
        const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
        const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
        const sentimentTrend = (secondAvg - firstAvg) > 0.05 ? 'positive'
          : (secondAvg - firstAvg) < -0.05 ? 'negative' : 'neutral';

        // Anomaly: check last 2 days vs 14-day average
        const dailyAvg = totalEvents / Math.max(1, sparkline.length);
        const last2 = sparkline.slice(-2);
        const volumeSpike = last2.some((v: number) => v > dailyAvg * 2 && dailyAvg > 0);
        const sentLast2 = sentimentScores.slice(-2);
        const sentShift = sentLast2.some((s, i) => {
          const prev = i === 0 ? (sentimentScores.length > 2 ? sentimentScores[sentimentScores.length - 3] : 0) : sentLast2[i - 1];
          return Math.abs(s - prev) > 0.3;
        });

        let anomaly = null;
        if (volumeSpike) {
          const spikeIdx = last2[1] > dailyAvg * 2 ? sparklineData.length - 1 : sparklineData.length - 2;
          anomaly = { type: 'volume_spike', date: sparklineData[spikeIdx]?.date };
        } else if (sentShift) {
          anomaly = { type: 'sentiment_shift', date: sparklineData[sparklineData.length - 1]?.date };
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
    const alerts = enrichedProjects.filter(p => p.anomaly !== null).length;

    // Activity feed: recent crawler activity + computed anomaly events
    const activity = await buildActivityFeed();

    return json({
      success: true,
      projects: enrichedProjects,
      activity,
      summary: {
        total_projects: enrichedProjects.length,
        total_events: totalEvents,
        active_crawlers: 0, // TODO: wire to Dapr job state when available
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
  const activities: any[] = [];

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
```

**Step 2: Verify the endpoint works**

Run: `npm run build`
Expected: Compiles without errors

**Step 3: Commit**

```bash
git add "src/routes/api/home-overview/+server.ts"
git commit -m "feat(home): add /api/home-overview endpoint with project sparklines, sentiment, anomalies"
```

---

### Task 2: Home Page — Header Component

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Replace the entire `+page.svelte` with new structure — header section first**

Strip out all existing code. Replace the `<script>` block with the new data loading logic and the template with the slim header bar. The header shows branding, summary line, and stat pills.

Key data loading:
```typescript
let data: any = null;
let loading = true;

async function loadOverview() {
  try {
    const res = await fetch('/api/home-overview');
    const result = await res.json();
    if (result.success) data = result;
  } catch (e) {
    console.error('Failed to load overview:', e);
  } finally {
    loading = false;
  }
}

onMount(() => {
  loadOverview();
  // Auto-refresh every 60 seconds
  const interval = setInterval(loadOverview, 60000);
  return () => clearInterval(interval);
});
```

Header template: white bar with left branding + summary, right stat pills. Alerts pill turns amber when `data.summary.alerts > 0`.

**Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add "src/routes/+page.svelte"
git commit -m "feat(home): rewrite home page with slim header and overview data loading"
```

---

### Task 3: Home Page — Project Cards Grid

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Add the project cards section**

Below the header, add a flex container split `lg:w-[65%]` left for cards, `lg:w-[35%]` right for feed (placeholder for now).

Each project card renders:
- Top: name + source dots (amber/violet/sky, filled or hollow)
- Second row: keyword pills (max 3) + freshness badge
- Middle: inline SVG sparkline + event count
- Insight line: computed from `sentiment_trend` and `anomaly`
- Bottom: investigation count + "View" link
- Left border amber accent if anomaly present
- Whole card clickable → `goto(`/investigations/${project.id}`)`

Sparkline as inline SVG polyline:
```typescript
function sparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const step = width / Math.max(1, values.length - 1);
  return values.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${i * step},${height - (v / max) * height}`
  ).join(' ');
}
```

Freshness helper:
```typescript
function freshness(dateStr: string): { label: string; color: string } {
  const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  if (hours < 24) return { label: 'just now', color: 'text-emerald-600' };
  if (hours < 168) return { label: `${Math.floor(hours / 24)}d ago`, color: 'text-amber-600' };
  return { label: `${Math.floor(hours / 168)}w ago`, color: 'text-slate-400' };
}
```

Insight generator:
```typescript
function insightText(project: any): string {
  if (project.anomaly?.type === 'volume_spike') return `Volume spike on ${formatDate(project.anomaly.date)}`;
  if (project.anomaly?.type === 'sentiment_shift') return `Sentiment shifted on ${formatDate(project.anomaly.date)}`;
  if (project.sentiment_trend === 'positive') return 'Sentiment trending positive';
  if (project.sentiment_trend === 'negative') return 'Sentiment trending negative';
  return 'Steady, no significant changes';
}
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add "src/routes/+page.svelte"
git commit -m "feat(home): add project cards grid with sparklines, sentiment, anomalies"
```

---

### Task 4: Home Page — Activity Feed Sidebar

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Add the activity feed in the right column**

Replace the placeholder right column with the scrollable activity feed. Header "Recent Activity" with muted last-refresh timestamp.

Each activity item:
- Icon: green dot for `data_ingestion`, amber triangle for `sentiment_shift`, green check / red x for `system_health`
- Line 1: message text (bold if analytical shift)
- Line 2: project name + relative time in muted text
- Clickable → navigates to project if `project_id` is set

The feed container uses `overflow-y-auto` and a fixed `max-h-[calc(100vh-200px)]` so it scrolls independently.

"View all activity" link at bottom (can just link to `/dashboards` for now).

**Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add "src/routes/+page.svelte"
git commit -m "feat(home): add activity feed sidebar with event type coding"
```

---

### Task 5: Responsive Layout + Polish

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Add responsive breakpoints**

- Desktop (`lg:`): 65/35 side-by-side layout, 2-column card grid
- Tablet (`md:`): full-width stacked, 2-column card grid, feed below
- Mobile: 1-column cards, feed below

**Step 2: Add loading skeleton**

While `loading` is true, show skeleton placeholders matching the card layout — pulsing grey rectangles for header stats, card shapes, and feed items.

**Step 3: Add empty state**

If `data.projects.length === 0`, show a friendly empty state: "No investigations yet — create your first one to start tracking." with a button to `/investigations`.

**Step 4: Run build to verify**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add "src/routes/+page.svelte"
git commit -m "feat(home): responsive layout, loading skeletons, empty state"
```

---

### Task 6: Clean Up Old Code

**Files:**
- Modify: `src/routes/+page.svelte`
- Potentially remove: `src/lib/services/overviewDb.ts` (if no longer imported anywhere)

**Step 1: Verify old imports are removed**

Ensure `overviewDb`, `currentProject`, `loadCurrentProject` imports are gone from `+page.svelte`. Check if `overviewDb` is used elsewhere:

Run: `grep -r "overviewDb" src/ --include="*.svelte" --include="*.ts" -l`

If only the old home page used it, it can be deleted.

**Step 2: Run full build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add -u
git commit -m "chore(home): remove unused overviewDb service and old home page code"
```

---

### Task 7: Save to Cognee

**Step 1: Save the new home screen architecture to Cognee**

Use `mcp__cognee__cognify` to document the new home page design: the `/api/home-overview` endpoint, project card data shape, activity feed, sparkline computation, anomaly detection logic.

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/routes/api/home-overview/+server.ts` |
| Rewrite | `src/routes/+page.svelte` |
| Maybe delete | `src/lib/services/overviewDb.ts` |

## Verification

1. `npm run build` passes
2. Navigate to `/` — see slim header with stats
3. Project cards show with sparklines, keywords, source dots, freshness, insight text
4. Anomaly cards have amber left border
5. Activity feed scrolls independently, shows typed events
6. Click project card → navigates to investigation
7. Page auto-refreshes every 60 seconds
8. Responsive: works on mobile (1-col stacked)
