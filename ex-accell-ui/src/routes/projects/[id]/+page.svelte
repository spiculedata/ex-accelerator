<svelte:head>
  <title>{project?.name || 'Project'} - Social Explorer</title>
  <meta name="description" content="Project detail for {project?.name || 'project'}" />
</svelte:head>

<script lang="ts">
  import { workspaceTypeBadgeClass } from '$lib/utils/categoryColours';
  import { CHART } from '$lib/utils/chartColors';
  import { onMount, onDestroy } from 'svelte';
  import { typeLabel } from '$lib/utils/projectForm';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  // ---------- types ----------
  interface Anomaly {
    type: string;
    date: string;
  }

  interface Workspace {
    id: number;
    name: string;
    description: string;
    workspace_type: string;
    status: string;
    data_source_count: number;
    source_names: string[];
    source_types: string[];
    total_records: number;
    investigation_count: number;
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

  interface ProjectData {
    id: number;
    name: string;
    description: string;
    project_type: string;
    status: string;
    created_at: string;
    updated_at: string;
  }

  interface Summary {
    total_workspaces: number;
    total_records: number;
    total_data_sources: number;
    total_investigations: number;
    alerts: number;
  }

  // ---------- state ----------
  $: projectId = $page.params.id;
  let loading = true;
  let error = '';
  // Shown inline when a workspace was created but some datasets could not be linked
  let workspaceNotice = '';
  // Confirms what just happened, so creating a workspace is not silent
  let workspaceCreated = '';
  let project: ProjectData | null = null;
  let workspaces: Workspace[] = [];
  let activity: Activity[] = [];
  let summary: Summary = { total_workspaces: 0, total_records: 0, total_data_sources: 0, total_investigations: 0, alerts: 0 };
  let refreshTimer: ReturnType<typeof setInterval> | undefined;

  // create workspace form state
  let showCreateWorkspace = false;
  let newWorkspaceName = '';
  let newWorkspaceDescription = '';
  let newWorkspaceType = 'general';
  let availableDatasets: any[] = [];
  let selectedDatasets: number[] = [];
  let loadingDatasets = false;

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

  function insightText(item: any): string {
    if (item.anomaly?.type === 'volume_spike') return 'Volume spike detected';
    if (item.anomaly?.type === 'sentiment_shift') return 'Sentiment shift detected';
    if (item.sentiment_trend === 'positive') return 'Sentiment trending positive';
    if (item.sentiment_trend === 'negative') return 'Sentiment trending negative';
    return 'Steady, no significant changes';
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
        return { symbol: '\u25CF', bg: 'text-emerald-500' };
      case 'sentiment_shift':
        return { symbol: '\u25B2', bg: 'text-signal-700' };
      case 'system_health':
        return { symbol: '\u25CF', bg: 'text-red-500' };
      default:
        return { symbol: '\u25CF', bg: 'text-slate-400' };
    }
  }

  const typeBadgeColor = (t: string): string => workspaceTypeBadgeClass(t);

  // ---------- data loading ----------
  async function loadData() {
    try {
      const res = await fetch(`/api/project-overview?id=${projectId}`);
      const data = await res.json();
      if (data.success) {
        project = data.project;
        workspaces = data.workspaces;
        activity = data.activity;
        summary = data.summary;
        error = '';
      } else {
        error = data.error || 'Failed to load project';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Network error';
    } finally {
      loading = false;
    }
  }

  async function loadDatasets() {
    loadingDatasets = true;
    try {
      const response = await fetch('/api/datasets?status=available');
      const result = await response.json();
      if (result.success) {
        availableDatasets = result.datasets || [];
      }
    } catch (e) {
      console.error('Error loading datasets:', e);
    } finally {
      loadingDatasets = false;
    }
  }

  function toggleDatasetSelection(datasetId: number) {
    if (selectedDatasets.includes(datasetId)) {
      selectedDatasets = selectedDatasets.filter(id => id !== datasetId);
    } else {
      selectedDatasets = [...selectedDatasets, datasetId];
    }
  }

  async function createWorkspace() {
    if (!newWorkspaceName.trim()) return;
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: parseInt(projectId ?? '0'),
          name: newWorkspaceName,
          description: newWorkspaceDescription,
          workspace_type: newWorkspaceType
        })
      });
      const result = await response.json();
      if (result.success && result.workspace) {
        const workspaceId = result.workspace.id;
        const createdName = newWorkspaceName.trim();
        let linkProblem = '';
        if (selectedDatasets.length > 0) {
          const failures: string[] = [];
          for (const datasetId of selectedDatasets) {
            try {
              const linkResponse = await fetch('/api/datasets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'link', workspace_id: workspaceId, dataset_id: datasetId })
              });
              if (!linkResponse.ok) {
                const detail = await linkResponse.json().catch(() => ({}));
                failures.push(detail.error || `HTTP ${linkResponse.status}`);
              }
            } catch (err) {
              failures.push(err instanceof Error ? err.message : String(err));
            }
          }
          if (failures.length > 0) {
            linkProblem = `The workspace was created, but ${failures.length} dataset(s) could not be added: ${failures[0]}`;
          }
        }
        showCreateWorkspace = false;
        newWorkspaceName = '';
        newWorkspaceDescription = '';
        newWorkspaceType = 'general';
        selectedDatasets = [];
        await loadData();
        workspaceNotice = linkProblem;
        workspaceCreated = `Workspace "${createdName}" created.`;
      }
    } catch (e) {
      console.error('Error creating workspace:', e);
      error = 'Failed to create workspace. Please try again.';
    }
  }

  $: if (showCreateWorkspace && availableDatasets.length === 0) {
    loadDatasets();
  }

  // ---------- team ----------
  interface TeamMember { email: string; role: string; addedAt: string | null }
  let teamMembers: TeamMember[] = [];
  let teamCreator: string | null = null;
  let canManageTeam = false;
  let teamError = '';
  let teamNotice = '';
  let newMemberEmail = '';
  let savingMember = false;

  async function loadTeam() {
    try {
      const res = await fetch(`/api/project-members?project_id=${projectId}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      teamMembers = data.data.members;
      teamCreator = data.data.createdBy;
      canManageTeam = data.data.canManage;
      teamError = '';
    } catch (e) {
      teamError = e instanceof Error ? e.message : 'Could not load the team.';
    }
  }

  async function changeTeam(request: Promise<Response>, done: string) {
    teamNotice = '';
    savingMember = true;
    try {
      const res = await request;
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        teamError = data?.error ?? `The change failed (HTTP ${res.status}).`;
        return;
      }
      teamError = '';
      teamNotice = done;
      await loadTeam();
    } catch {
      teamError = 'Could not reach the server. Try again.';
    } finally {
      savingMember = false;
    }
  }

  async function addTeamMember() {
    const email = newMemberEmail.trim();
    if (!email) return;
    await changeTeam(
      fetch('/api/project-members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: Number(projectId), email }) }),
      `${email} can now see this project.`
    );
    if (!teamError) newMemberEmail = '';
  }

  const removeTeamMember = (email: string) =>
    changeTeam(fetch(`/api/project-members?project_id=${projectId}&email=${encodeURIComponent(email)}`, { method: 'DELETE' }), `${email} can no longer see this project.`);

  onMount(() => {
    loadData();
    loadTeam();
    refreshTimer = setInterval(loadData, 60000);
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
  });
</script>

<!-- ===== SLIM HEADER ===== -->
{#if loading}
  <header class="h-[70px] bg-white border-b border-slate-200 px-6 flex items-center shrink-0">
    <div class="flex items-center gap-3 animate-pulse">
      <div class="w-8 h-8 bg-slate-200 rounded"></div>
      <div class="h-5 bg-slate-200 rounded w-48"></div>
    </div>
  </header>
  <main class="flex-1 overflow-hidden bg-slate-50">
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
  </main>
{:else if error}
  <header class="h-[70px] bg-white border-b border-slate-200 px-6 flex items-center shrink-0">
    <button type="button" class="mr-3 p-1.5 rounded-md hover:bg-slate-100 transition-colors" onclick={() => goto('/')}>
      <svg class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
    </button>
    <h1 class="text-lg font-semibold text-slate-900">Project</h1>
  </header>
  <main class="flex-1 overflow-hidden bg-slate-50 flex items-center justify-center">
    <div class="text-center">
      <p class="text-red-600 font-medium mb-2">Error loading project</p>
      <p class="text-sm text-slate-500 mb-4">{error}</p>
      <button class="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 transition-colors" onclick={() => { loading = true; loadData(); }}>
        Retry
      </button>
    </div>
  </main>
{:else if project}
  <header class="bg-white border-b border-slate-200 px-6 shrink-0">
    <!-- Top row: back + name + type badge + stat pills -->
    <div class="flex items-center justify-between h-[42px]">
      <div class="flex items-center gap-2 min-w-0">
        <button type="button" class="p-1.5 rounded-md hover:bg-slate-100 transition-colors shrink-0" onclick={() => goto('/')}>
          <svg class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 class="text-lg font-semibold text-slate-900 truncate">{project.name}</h1>
        {#if project.project_type}
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-800 shrink-0">{typeLabel(project.project_type)}</span>
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Records: {formatCount(summary.total_records)}</span>
        <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Sources: {summary.total_data_sources}</span>
        <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Investigations: {summary.total_investigations}</span>
      </div>
    </div>
    <!-- Bottom row: description + summary -->
    <div class="flex items-center justify-between pb-2">
      <p class="text-sm text-slate-500 truncate max-w-xl">{project.description || 'No description'}</p>
      <span class="text-sm text-slate-500 shrink-0 ml-4">
        {summary.total_workspaces} workspace{summary.total_workspaces !== 1 ? 's' : ''}
        &middot; {formatCount(summary.total_records)} records
        &middot; {summary.total_data_sources} data source{summary.total_data_sources !== 1 ? 's' : ''}
      </span>
    </div>
  </header>

  <!-- ===== MAIN CONTENT (65/35) ===== -->
  <main class="flex-1 overflow-hidden bg-slate-50">
    <div class="flex flex-col lg:flex-row gap-6 p-6 h-full overflow-y-auto lg:overflow-hidden">

      <!-- ===== WORKSPACE CARDS (65%) ===== -->
      <section class="lg:w-[65%] lg:overflow-y-auto lg:pr-2">
        <!-- New Workspace button -->
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-slate-900 uppercase tracking-wider">Workspaces</h2>
          <button
            type="button"
            class="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            onclick={() => showCreateWorkspace = !showCreateWorkspace}
          >
            + New Workspace
          </button>
        </div>

        {#if workspaceCreated}
          <div role="status" class="mb-4 flex items-start justify-between gap-3 rounded-lg border border-success-300 bg-success-50 px-4 py-3 text-xs text-success-900">
            <span>{workspaceCreated}</span>
            <button type="button" class="shrink-0 font-medium underline" onclick={() => (workspaceCreated = '')}>Dismiss</button>
          </div>
        {/if}

        {#if workspaceNotice}
          <div role="alert" class="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <span>{workspaceNotice}</span>
            <button type="button" class="shrink-0 font-medium underline" onclick={() => (workspaceNotice = '')}>Dismiss</button>
          </div>
        {/if}

        <!-- Create Workspace Form (inline) -->
        {#if showCreateWorkspace}
          <div class="mb-4 p-5 bg-white rounded-xl shadow-sm border border-slate-200">
            <h3 class="text-sm font-semibold text-slate-900 mb-3">Create New Workspace</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Workspace Name *</label>
                <input bind:value={newWorkspaceName} type="text" placeholder="e.g., Twitter Analysis"
                  class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Workspace Type</label>
                <select bind:value={newWorkspaceType}
                  class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="general">General</option>
                  <option value="analysis">Analysis</option>
                  <option value="exploration">Exploration</option>
                  <option value="reporting">Reporting</option>
                </select>
              </div>
            </div>
            <div class="mt-3">
              <label class="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <textarea bind:value={newWorkspaceDescription} placeholder="Describe the purpose..." rows="2"
                class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
            </div>

            <!-- Dataset Selection -->
            <div class="mt-3">
              <label class="block text-xs font-medium text-slate-600 mb-1">
                Select Datasets (Optional)
                <span class="text-slate-400 font-normal"> - choose datasets to include</span>
              </label>
              {#if loadingDatasets}
                <div class="text-center py-4">
                  <div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                </div>
              {:else if availableDatasets.length === 0}
                <div class="bg-slate-50 rounded-md p-3 text-center">
                  <p class="text-xs text-slate-500">No datasets available. Run the ETL pipeline to ingest data.</p>
                </div>
              {:else}
                <div class="border border-slate-300 rounded-md max-h-48 overflow-y-auto">
                  {#each availableDatasets as dataset}
                    <div class="p-2.5 border-b border-slate-200 last:border-b-0 hover:bg-slate-50 cursor-pointer transition-colors"
                      onclick={() => toggleDatasetSelection(dataset.id)}>
                      <div class="flex items-start">
                        <input type="checkbox" checked={selectedDatasets.includes(dataset.id)}
                          onclick={(e) => { e.stopPropagation(); toggleDatasetSelection(dataset.id); }}
                          class="mt-0.5 h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                        <div class="ml-2 flex-1 min-w-0">
                          <div class="flex items-center justify-between gap-2">
                            <h4 class="text-xs font-medium text-slate-900 truncate">{dataset.name}</h4>
                            <span class="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 shrink-0">{dataset.dataset_type}</span>
                          </div>
                          <p class="text-[11px] text-slate-500 mt-0.5">{(dataset.record_count || 0).toLocaleString()} records</p>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
                {#if selectedDatasets.length > 0}
                  <p class="text-[11px] text-slate-500 mt-1">{selectedDatasets.length} dataset{selectedDatasets.length === 1 ? '' : 's'} selected</p>
                {/if}
              {/if}
            </div>

            <div class="mt-3 flex items-center justify-end gap-2">
              <button type="button" onclick={() => showCreateWorkspace = false}
                class="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50">Cancel</button>
              <button type="button" onclick={createWorkspace} disabled={!newWorkspaceName.trim()}
                class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Create Workspace</button>
            </div>
          </div>
        {/if}

        <!-- Workspace cards grid -->
        {#if workspaces.length === 0}
          {#if !showCreateWorkspace}
          <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p class="text-slate-600 font-medium mb-1">No workspaces yet</p>
            <p class="text-sm text-slate-500">Create a workspace to organize your analysis</p>
          </div>
          {/if}
        {:else}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {#each workspaces as ws (ws.id)}
              {@const fresh = freshness(ws.last_activity)}
              <button
                type="button"
                class="bg-white rounded-xl shadow-sm p-5 text-left transition-shadow hover:shadow-md cursor-pointer {ws.anomaly ? 'border-l-[3px] border-l-amber-400' : 'border border-transparent'}"
                onclick={() => goto(`/workspaces/${ws.id}`)}
              >
                <!-- Top: name + type badge -->
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <h3 class="text-sm font-semibold text-slate-900 truncate">{ws.name}</h3>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 {typeBadgeColor(ws.workspace_type)}">{typeLabel(ws.workspace_type)}</span>
                </div>

                <!-- Source name pills + freshness -->
                <div class="flex items-center gap-2 mb-3 overflow-hidden">
                  <div class="flex items-center gap-1 overflow-hidden">
                    {#each (ws.source_names || []).slice(0, 3) as sn}
                      <span class="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 truncate max-w-[100px]">{sn}</span>
                    {/each}
                  </div>
                  <span class="text-xs {fresh.color} shrink-0 ml-auto">{fresh.label}</span>
                </div>

                <!-- Sparkline + record count -->
                <div class="flex items-center gap-3 mb-2.5">
                  {#if ws.sparkline && ws.sparkline.length > 0}
                    <svg class="shrink-0" width="100" height="24" viewBox="0 0 100 24">
                      <polyline
                        points={sparklinePath(ws.sparkline, 100, 24)}
                        fill="none"
                        stroke={CHART.primary600}
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  {:else}
                    <div class="w-[100px] h-6 bg-slate-100 rounded"></div>
                  {/if}
                  <span class="text-xs text-slate-600 font-medium">{formatCount(ws.total_records)} records</span>
                </div>

                <!-- Insight line -->
                <p class="text-xs text-slate-500 mb-2.5 leading-snug">
                  {insightText(ws)}
                  {#if ws.anomaly}
                    <span class="inline-block ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      {ws.anomaly.type === 'volume_spike' ? 'spike' : 'shift'}
                    </span>
                  {/if}
                </p>

                <!-- Bottom row -->
                <div class="flex items-center justify-between">
                  <span class="text-xs text-slate-500">
                    {ws.investigation_count} investigation{ws.investigation_count !== 1 ? 's' : ''}
                  </span>
                  <span class="text-xs font-medium text-indigo-600">View</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <!-- ===== ACTIVITY FEED (35%) ===== -->
      <aside class="lg:w-[35%] lg:overflow-hidden flex flex-col gap-4">
        <section aria-labelledby="team-heading" class="bg-white rounded-xl shadow-sm overflow-hidden">
          <div class="px-5 pt-5 pb-3 border-b border-slate-100">
            <h2 id="team-heading" class="text-sm font-semibold text-slate-900">Team</h2>
            <p class="text-xs text-slate-500 mt-0.5">Only these people (and admins) can see this project and what is in it.</p>
          </div>
          <ul class="divide-y divide-slate-100">
            {#if teamCreator}
              <li class="px-5 py-2.5 flex items-center justify-between gap-2 text-xs">
                <span class="truncate text-slate-800">{teamCreator}</span>
                <span class="shrink-0 text-slate-500">Creator</span>
              </li>
            {/if}
            {#each teamMembers.filter((m) => m.email.toLowerCase() !== (teamCreator ?? '').toLowerCase()) as member (member.email)}
              <li class="px-5 py-2.5 flex items-center justify-between gap-2 text-xs">
                <span class="truncate text-slate-800">{member.email}</span>
                {#if canManageTeam}
                  <button type="button" onclick={() => removeTeamMember(member.email)} disabled={savingMember} class="shrink-0 text-slate-600 hover:text-danger-700 underline disabled:opacity-60" aria-label="Remove {member.email} from this project">Remove</button>
                {:else}
                  <span class="shrink-0 text-slate-500">Member</span>
                {/if}
              </li>
            {/each}
          </ul>
          {#if canManageTeam}
            <form class="px-5 py-3 border-t border-slate-100 flex gap-2" onsubmit={(event) => { event.preventDefault(); addTeamMember(); }}>
              <label class="sr-only" for="new-member-email">Email of the person to add</label>
              <input id="new-member-email" type="email" required bind:value={newMemberEmail} placeholder="colleague@company.com" autocomplete="off" class="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
              <button type="submit" disabled={savingMember} class="shrink-0 rounded-md bg-primary-700 px-3 py-1 text-xs font-medium text-white hover:bg-primary-800 disabled:opacity-60">Add</button>
            </form>
          {:else}
            <p class="px-5 py-3 border-t border-slate-100 text-xs text-slate-500">Only the creator or an admin can change the team.</p>
          {/if}
          {#if teamError}<p role="alert" class="px-5 pb-3 text-xs text-danger-700">{teamError}</p>{/if}
          {#if teamNotice}<p role="status" class="px-5 pb-3 text-xs text-success-700">{teamNotice}</p>{/if}
        </section>
        <div class="bg-white rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div class="px-5 pt-5 pb-3 border-b border-slate-100">
            <h2 class="text-sm font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div class="overflow-y-auto max-h-[calc(100vh-200px)] divide-y divide-slate-100">
            {#if activity.length === 0}
              <div class="p-5 text-center">
                <p class="text-sm text-slate-400">No recent activity</p>
              </div>
            {:else}
              {#each activity as item}
                {@const icon = activityIcon(item.type)}
                <div class="px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div class="flex items-start gap-2">
                    <span class="mt-0.5 text-xs {icon.bg}">{icon.symbol}</span>
                    <div class="min-w-0">
                      <p class="text-xs text-slate-700 leading-snug truncate">{item.message}</p>
                      <p class="text-[11px] text-slate-400 mt-0.5">{item.project_name} &middot; {relativeTime(item.timestamp)}</p>
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
          <div class="px-5 py-3 border-t border-slate-100">
            <button type="button" class="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
              View all activity
            </button>
          </div>
        </div>
      </aside>

    </div>
  </main>
{/if}
