<svelte:head>
  <title>Home - Social Explorer</title>
  <meta name="description" content="Social Explorer - project overview and activity feed" />
</svelte:head>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { insightText, needsFirstRun, sourceNames } from '$lib/utils/homeProject';
  import { goto } from '$app/navigation';

  // ---------- types ----------
  interface ProjectSource {
    gdelt: boolean;
    radio: boolean;
    social: boolean;
  }

  interface Anomaly {
    type: string;
    date: string;
  }

  interface Project {
    id: number;
    name: string;
    description: string;
    keywords: string[];
    date_start: string;
    date_end: string;
    sources: ProjectSource;
    event_count: number;
    workspace_count: number;
    investigation_count: number;
    project_type: string;
    last_activity: string;
    sparkline: number[];
    avg_sentiment: number;
    sentiment_trend: 'positive' | 'negative' | 'neutral';
    anomaly: Anomaly | null;
  }

  interface Activity {
    type: string;
    message: string;
    project_name: string;
    project_id: number | null;
    timestamp: string;
  }

  interface Summary {
    total_projects: number;
    total_events: number;
    alerts: number;
  }

  // ---------- state ----------
  let loading = true;
  let error = '';
  let projects: Project[] = [];
  let activity: Activity[] = [];
  let summary: Summary = { total_projects: 0, total_events: 0, alerts: 0 };
  let refreshTimer: ReturnType<typeof setInterval> | undefined;

  // ---------- helpers ----------
  function sparklinePath(values: number[], width: number, height: number): string {
    if (values.length === 0) return '';
    const max = Math.max(...values, 1);
    const step = width / Math.max(1, values.length - 1);
    return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step},${height - (v / max) * height}`).join(' ');
  }

  function freshness(dateStr: string): { label: string; color: string } {
    const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
    if (hours < 24) return { label: 'just now', color: 'text-emerald-600' };
    if (hours < 168) return { label: `${Math.floor(hours / 24)}d ago`, color: 'text-signal-700' };
    return { label: `${Math.floor(hours / 168)}w ago`, color: 'text-slate-400' };
  }

  function formatCount(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  function relativeTime(dateStr: string): string {
    const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
    if (hours < 1) return 'just now';
    if (hours < 24) return `${Math.floor(hours)}h ago`;
    if (hours < 168) return `${Math.floor(hours / 24)}d ago`;
    return `${Math.floor(hours / 168)}w ago`;
  }

  function activityIcon(type: string): { symbol: string; bg: string } {
    switch (type) {
      case 'data_ingestion':
        return { symbol: '●', bg: 'text-emerald-500' };
      case 'sentiment_shift':
        return { symbol: '▲', bg: 'text-signal-700' };
      case 'system_health':
        return { symbol: '●', bg: 'text-red-500' };
      default:
        return { symbol: '●', bg: 'text-slate-400' };
    }
  }

  // ---------- data loading ----------
  async function loadData() {
    try {
      const res = await fetch('/api/home-overview');
      const data = await res.json();
      if (data.success) {
        projects = data.projects;
        activity = data.activity;
        summary = data.summary;
        error = '';
      } else {
        error = data.error || 'Failed to load data';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Network error';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadData();
    refreshTimer = setInterval(loadData, 60000);
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
  });
</script>

<!-- ===== HEADER ===== -->
<header class="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
  <div class="flex items-center gap-3">
    <h1 class="text-lg font-semibold text-slate-900">Social Explorer</h1>
    {#if !loading}
      <span class="text-sm text-slate-500">
        {summary.total_projects} project{summary.total_projects !== 1 ? 's' : ''} · {formatCount(summary.total_events)} recent events
      </span>
    {/if}
  </div>

  <div class="flex items-center gap-3">
    {#if !loading}
      <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
        Recent events: {formatCount(summary.total_events)}
      </span>
      <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium {summary.alerts > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">
        Alerts: {summary.alerts}
      </span>
    {/if}
  </div>
</header>

<!-- ===== MAIN CONTENT ===== -->
<main class="flex-1 overflow-hidden bg-slate-50">
  {#if loading}
    <!-- Loading skeleton -->
    <div class="flex flex-col lg:flex-row gap-6 p-6 h-full">
      <div class="lg:w-[65%] space-y-4">
        {#each [1, 2, 3, 4] as _}
          <div class="bg-white rounded-xl shadow-sm p-5 animate-pulse">
            <div class="h-5 bg-slate-200 rounded w-1/3 mb-3"></div>
            <div class="h-3 bg-slate-200 rounded w-2/3 mb-4"></div>
            <div class="h-6 bg-slate-200 rounded w-24 mb-3"></div>
            <div class="h-3 bg-slate-200 rounded w-1/2"></div>
          </div>
        {/each}
      </div>
      <div class="lg:w-[35%]">
        <div class="bg-white rounded-xl shadow-sm p-5 animate-pulse">
          <div class="h-5 bg-slate-200 rounded w-1/2 mb-4"></div>
          {#each [1, 2, 3, 4, 5] as _}
            <div class="mb-4">
              <div class="h-3 bg-slate-200 rounded w-3/4 mb-2"></div>
              <div class="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else if error}
    <div class="flex items-center justify-center h-full">
      <div class="text-center">
        <p class="text-red-600 font-medium mb-2">Error loading data</p>
        <p class="text-sm text-slate-500 mb-4">{error}</p>
        <button class="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 transition-colors" onclick={() => { loading = true; loadData(); }}>
          Retry
        </button>
      </div>
    </div>
  {:else}
    <div class="flex flex-col lg:flex-row gap-6 p-6 h-full overflow-y-auto lg:overflow-hidden">

      <!-- ===== PROJECT CARDS ===== -->
      <section class="lg:w-[65%] lg:overflow-y-auto lg:pr-2">
        {#if needsFirstRun(projects)}
          <!-- First run: say what this is and what to do, until a project has a workspace -->
          <div class="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="text-base font-semibold text-slate-900">Start here</h2>
            <p class="mt-1 text-sm text-slate-600">
              Social Explorer analyses social media posts, news events and images: sentiment, topics, languages and engagement, with investigations you can annotate and export.
            </p>
            <ol class="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <li class="rounded-lg bg-slate-50 p-3"><span class="font-semibold text-slate-900">1. Create a project</span><br /><a class="text-indigo-700 underline" href="/projects/new">New project</a></li>
              <li class="rounded-lg bg-slate-50 p-3"><span class="font-semibold text-slate-900">2. Link data in a workspace</span><br /><span class="text-slate-600">Open the project, add a workspace and choose its datasets.</span></li>
              <li class="rounded-lg bg-slate-50 p-3"><span class="font-semibold text-slate-900">3. Open an analysis</span><br /><a class="text-indigo-700 underline" href="/text-analytics/sentiment-analysis">Sentiment Analysis</a></li>
            </ol>
          </div>
        {/if}
        {#if projects.length === 0}
          <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p class="text-slate-600 font-medium mb-1">No projects yet</p>
            <p class="text-sm text-slate-500">Create a project to get started</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {#each projects as project (project.id)}
              {@const fresh = freshness(project.last_activity)}
              <button
                type="button"
                class="bg-white rounded-xl shadow-sm p-5 text-left transition-shadow hover:shadow-md cursor-pointer {project.anomaly ? 'border-l-[3px] border-l-amber-400' : 'border border-transparent'}"
                onclick={() => goto(`/projects/${project.id}`)}
              >
                <!-- Top row: name + source dots -->
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <h3 class="text-sm font-semibold text-slate-900 truncate">{project.name}</h3>
                  <div class="flex items-center gap-1 shrink-0">
                    {#each sourceNames(project.sources) as name}
                      <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{name}</span>
                    {:else}
                      <span class="text-[10px] text-slate-500">No data linked</span>
                    {/each}
                  </div>
                </div>

                <!-- Keyword pills + freshness -->
                <div class="flex items-center gap-2 mb-3 overflow-hidden">
                  <div class="flex items-center gap-1 overflow-hidden">
                    {#each project.keywords.slice(0, 3) as kw}
                      <span class="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 truncate max-w-[100px]">{kw}</span>
                    {/each}
                  </div>
                  <span class="text-xs {fresh.color} shrink-0 ml-auto">{fresh.label}</span>
                </div>

                <!-- Sparkline + event count -->
                <div class="flex items-center gap-3 mb-2.5">
                  {#if project.sparkline.length > 0}
                    <svg class="shrink-0" width="100" height="24" viewBox="0 0 100 24">
                      <polyline
                        points={sparklinePath(project.sparkline, 100, 24)}
                        fill="none"
                        stroke="#6366f1"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  {/if}
                  <span class="text-xs text-slate-600 font-medium">{formatCount(project.event_count)} events</span>
                </div>

                <!-- Insight line -->
                <p class="text-xs text-slate-500 mb-2.5 leading-snug">
                  {insightText(project)}
                  {#if project.anomaly}
                    <span class="inline-block ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      {project.anomaly.type === 'volume_spike' ? 'spike' : 'shift'}
                    </span>
                  {/if}
                </p>

                <!-- Bottom row -->
                <div class="flex items-center justify-between">
                  {#if project.workspace_count > 0}
                    <span class="text-xs text-slate-500">{project.workspace_count} workspace{project.workspace_count !== 1 ? 's' : ''}</span>
                  {/if}
                  {#if project.investigation_count > 0}
                    <span class="text-xs text-slate-500">{project.workspace_count > 0 ? ' · ' : ''}{project.investigation_count} investigation{project.investigation_count !== 1 ? 's' : ''}</span>
                  {:else if project.workspace_count === 0}
                    <span class="text-xs text-slate-400">No workspaces</span>
                  {/if}
                  <span class="text-xs font-medium text-indigo-600">View</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <!-- ===== ACTIVITY FEED ===== -->
      <aside class="lg:w-[35%] lg:overflow-hidden flex flex-col">
        <div class="bg-white rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div class="px-5 pt-5 pb-3 border-b border-slate-100">
            <h2 class="text-sm font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div class="overflow-y-auto max-h-[calc(100vh-200px)] divide-y divide-slate-100">
            {#if activity.length === 0}
              <div class="p-5 text-center">
                <p class="text-sm text-slate-500">No recent activity</p>
              </div>
            {:else}
              {#each activity as item}
                {@const icon = activityIcon(item.type)}
                <div class="px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div class="flex items-start gap-2">
                    <span class="mt-0.5 text-xs {icon.bg}">{icon.symbol}</span>
                    <div class="min-w-0">
                      <p class="text-xs text-slate-700 leading-snug truncate">{item.message}</p>
                      <p class="text-[11px] text-slate-400 mt-0.5">{item.project_name} · {relativeTime(item.timestamp)}</p>
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </aside>

    </div>
  {/if}
</main>
