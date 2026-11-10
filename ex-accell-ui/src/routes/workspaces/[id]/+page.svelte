<svelte:head>
  <title>{workspace?.name || 'Workspace'} - Social Explorer</title>
  <meta name="description" content="Workspace detail for {workspace?.name || 'workspace'}" />
</svelte:head>

<script lang="ts">
  import { platformBadgeClass, platformDotClass, workspaceTypeBadgeClass } from '$lib/utils/categoryColours';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  export const ssr = false;

  // ---------- types ----------
  interface DataSource {
    kind: 'capture' | 'dataset';
    id: number;
    source_type: string;
    source_name: string;
    status: string;
    record_count: number;
    last_sync: string;
    created_at: string;
  }

  interface Investigation {
    id: number;
    name: string;
    description: string;
    query_config: any;
    created_at: string;
    updated_at: string;
  }

  interface WorkspaceData {
    id: number;
    name: string;
    description: string;
    workspace_type: string;
    project_id: number;
    project_name: string;
    status: string;
    created_at: string;
  }

  interface SummaryData {
    total_records: number;
    total_data_sources: number;
    total_investigations: number;
  }

  // ---------- state ----------
  $: workspaceId = $page.params.id;
  let loading = true;
  let error = '';
  let workspace: WorkspaceData | null = null;
  let dataSources: DataSource[] = [];
  let investigations: Investigation[] = [];
  let summary: SummaryData = { total_records: 0, total_data_sources: 0, total_investigations: 0 };

  // ---------- helpers ----------
  function formatCount(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  function relativeTime(dateStr: string): string {
    if (!dateStr) return '--';
    const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
    if (hours < 1) return 'just now';
    if (hours < 24) return `${Math.floor(hours)}h ago`;
    if (hours < 168) return `${Math.floor(hours / 24)}d ago`;
    return `${Math.floor(hours / 168)}w ago`;
  }

  // A source type may be "twitter_posts" or similar, so find the platform name inside it
  const PLATFORM_NAMES = ['twitter', 'reddit', 'telegram', 'youtube', 'facebook', 'instagram', 'bluesky', 'linkedin', 'tiktok'];
  function platformOf(sourceType: string): string | undefined {
    const t = (sourceType || '').toLowerCase();
    return PLATFORM_NAMES.find((name) => t.includes(name));
  }
  const platformColor = (sourceType: string): string => platformDotClass(platformOf(sourceType));
  const platformTextColor = (sourceType: string): string => platformBadgeClass(platformOf(sourceType));

  function statusBadge(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'active': return 'bg-emerald-100 text-emerald-800';
      case 'paused': return 'bg-amber-100 text-amber-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  const typeBadgeColor = (t: string): string => workspaceTypeBadgeClass(t);

  // ---------- data loading ----------
  async function loadData() {
    try {
      const res = await fetch(`/api/workspace-overview?id=${workspaceId}`);
      const data = await res.json();
      if (data.success) {
        workspace = data.workspace;
        dataSources = data.data_sources;
        investigations = data.investigations;
        summary = data.summary;
        error = '';
      } else {
        error = data.error || 'Failed to load workspace';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Network error';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadData();
  });
</script>

<!-- ===== SLIM HEADER ===== -->
{#if loading}
  <header class="bg-white border-b border-slate-200 px-6 shrink-0">
    <div class="flex items-center h-[42px] animate-pulse">
      <div class="w-8 h-8 bg-slate-200 rounded mr-3"></div>
      <div class="h-5 bg-slate-200 rounded w-48"></div>
    </div>
    <div class="pb-2 animate-pulse">
      <div class="h-3 bg-slate-200 rounded w-64"></div>
    </div>
  </header>
  <main class="flex-1 overflow-y-auto bg-slate-50 p-6">
    <div class="max-w-5xl mx-auto space-y-6">
      {#each [1, 2, 3] as _}
        <div class="bg-white rounded-xl shadow-sm p-5 animate-pulse">
          <div class="h-5 bg-slate-200 rounded w-1/3 mb-3"></div>
          <div class="h-3 bg-slate-200 rounded w-2/3 mb-4"></div>
          <div class="h-6 bg-slate-200 rounded w-24"></div>
        </div>
      {/each}
    </div>
  </main>
{:else if error}
  <header class="h-[70px] bg-white border-b border-slate-200 px-6 flex items-center shrink-0">
    <button type="button" class="mr-3 p-1.5 rounded-md hover:bg-slate-100 transition-colors" onclick={() => goto('/')}>
      <svg class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
    </button>
    <h1 class="text-lg font-semibold text-slate-900">Workspace</h1>
  </header>
  <main class="flex-1 overflow-hidden bg-slate-50 flex items-center justify-center">
    <div class="text-center">
      <p class="text-red-600 font-medium mb-2">Error loading workspace</p>
      <p class="text-sm text-slate-500 mb-4">{error}</p>
      <button class="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 transition-colors" onclick={() => { loading = true; loadData(); }}>
        Retry
      </button>
    </div>
  </main>
{:else if workspace}
  <header class="bg-white border-b border-slate-200 px-6 shrink-0">
    <!-- Top row: back + name + type badge -->
    <div class="flex items-center h-[42px]">
      <button type="button" class="mr-3 p-1.5 rounded-md hover:bg-slate-100 transition-colors shrink-0" onclick={() => goto(`/projects/${workspace.project_id}`)}>
        <svg class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <h1 class="text-lg font-semibold text-slate-900 truncate">{workspace.name}</h1>
      <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 {typeBadgeColor(workspace.workspace_type)}">{workspace.workspace_type}</span>
    </div>
    <!-- Bottom row: description + summary -->
    <div class="flex items-center justify-between pb-2">
      <p class="text-sm text-slate-500 truncate max-w-xl">{workspace.description || 'No description'}</p>
      <span class="text-sm text-slate-500 shrink-0 ml-4">
        {summary.total_data_sources} data source{summary.total_data_sources !== 1 ? 's' : ''}
        &middot; {formatCount(summary.total_records)} records
        &middot; {summary.total_investigations} investigation{summary.total_investigations !== 1 ? 's' : ''}
      </span>
    </div>
  </header>

  <!-- ===== MAIN CONTENT (full width) ===== -->
  <main class="flex-1 overflow-y-auto bg-slate-50">
    <div class="max-w-5xl mx-auto p-6 space-y-8">

      <!-- ===== DATA SOURCES SECTION ===== -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold text-slate-900 uppercase tracking-wider">Data Sources</h2>
            <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{dataSources.length}</span>
          </div>
          <button
            type="button"
            class="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            onclick={() => goto(`/data-management?workspace=${workspaceId}&link=1`)}
          >
            Link dataset
          </button>
        </div>

        {#if dataSources.length === 0}
          <div class="bg-white rounded-xl shadow-sm p-8 text-center">
            <div class="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-3">
              <svg class="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <p class="text-slate-600 font-medium mb-1">No data sources</p>
            <p class="text-sm text-slate-400">Add a data source to start analyzing data</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each dataSources as ds (`${ds.kind}-${ds.id}`)}
              <div class="bg-white rounded-xl shadow-sm p-5 border border-transparent">
                <!-- Name + type -->
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0 {platformColor(ds.source_type)}"></span>
                    <h3 class="text-sm font-semibold text-slate-900 truncate">{ds.source_name}</h3>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium {platformTextColor(ds.source_type)}">{ds.source_type}</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium {statusBadge(ds.status)}">{ds.status}</span>
                  </div>
                </div>
                <!-- Stats -->
                <div class="flex items-center justify-between text-xs text-slate-500">
                  <span class="font-medium text-slate-700">{formatCount(ds.record_count)} records</span>
                  <span>Last sync: {relativeTime(ds.last_sync)}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <!-- ===== INVESTIGATIONS SECTION ===== -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold text-slate-900 uppercase tracking-wider">Investigations</h2>
            <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{investigations.length}</span>
          </div>
        </div>

        {#if investigations.length === 0}
          <div class="bg-white rounded-xl shadow-sm p-8 text-center">
            <div class="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-3">
              <svg class="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p class="text-slate-600 font-medium mb-1">No investigations yet</p>
            <p class="text-sm text-slate-400 mb-4">Create an investigation to start analyzing this workspace's data</p>
            <button
              type="button"
              class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              onclick={() => goto(`/investigations?workspace=${workspaceId}`)}
            >
              Create Investigation
            </button>
          </div>
        {:else}
          <div class="bg-white rounded-xl shadow-sm overflow-hidden">
            <div class="divide-y divide-slate-100">
              {#each investigations as inv}
                {@const config = inv.query_config || {}}
                {@const keywords = config.keywords || []}
                {@const dateStart = config.dateStart || ''}
                {@const dateEnd = config.dateEnd || ''}
                <button
                  type="button"
                  class="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                  onclick={() => goto(`/investigations/${inv.id}`)}
                >
                  <div class="min-w-0 flex-1">
                    <h3 class="text-sm font-semibold text-slate-900 truncate">{inv.name}</h3>
                    <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                      {#each keywords.slice(0, 4) as kw}
                        <span class="inline-block rounded bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">{kw}</span>
                      {/each}
                      {#if keywords.length > 4}
                        <span class="text-[11px] text-slate-400">+{keywords.length - 4} more</span>
                      {/if}
                      {#if dateStart && dateEnd}
                        <span class="text-[11px] text-slate-400">{dateStart} - {dateEnd}</span>
                      {/if}
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-[11px] text-slate-400">{relativeTime(inv.updated_at)}</p>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </section>

    </div>
  </main>
{/if}
