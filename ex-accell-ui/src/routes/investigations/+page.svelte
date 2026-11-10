<script lang="ts">
  import { onMount } from 'svelte';
  import { formatDay } from '$lib/utils/dayFormat';
  import { commitKeywords } from '$lib/utils/keywords';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  interface Investigation {
    id: string;
    name: string;
    description: string;
    keywords: string[];
    date_start: string;
    date_end: string;
    sources: string[];
    created_at: string;
    updated_at: string;
  }

  let investigations: Investigation[] = [];
  let loading = true;
  let showNewModal = false;

  // New investigation form state
  let newName = '';
  let newDescription = '';
  let newKeywordsInput = '';
  let newKeywords: string[] = [];
  let newDateStart = '';
  let newDateEnd = '';
  let newSources = { gdelt: true, radio: true, social: true };
  let createError = '';
  let creating = false;
  let createInWorkspace: number | null = null;

  // Opened from a workspace page (?workspace=<id>): create the investigation inside that workspace
  // Reactive: the page is reused on same-route navigation, so a stale workspace must not stick
  $: workspaceParam = Number.parseInt($page.url.searchParams.get('workspace') ?? '', 10);
  $: workspaceId = Number.isInteger(workspaceParam) && workspaceParam > 0 ? workspaceParam : null;

  // Opened from a workspace: list only that workspace's investigations and name it, so it is clear whose they are
  let workspaceName = '';
  async function loadWorkspaceName(id: number | null) {
    workspaceName = '';
    if (!id) return;
    try {
      const response = await fetch(`/api/workspace-overview?id=${id}`);
      const result = await response.json();
      if (result.success) workspaceName = result.workspace?.name ?? '';
    } catch {
      // The name is a convenience; the list and form still work without it
    }
  }

  // "Show all" drops ?workspace=, which is a same-page navigation: reload the list and the name when it changes
  let loadedWorkspace: number | null | undefined;
  $: if (mounted && workspaceId !== loadedWorkspace) {
    loadedWorkspace = workspaceId;
    void loadWorkspaceName(workspaceId);
    void loadInvestigations();
  }

  let mounted = false;
  onMount(async () => {
    mounted = true;
    loadedWorkspace = workspaceId;
    await loadWorkspaceName(workspaceId);
    await loadInvestigations();
    if (workspaceId) {
      openModal();
      createInWorkspace = workspaceId;
    }
  });

  async function loadInvestigations() {
    loading = true;
    try {
      const response = await fetch(workspaceId ? `/api/investigations?workspace_id=${workspaceId}` : '/api/investigations');
      const result = await response.json();
      if (result.success) {
        // The list returns the query inside query_config; the cards read keywords, dates and sources directly
        investigations = (result.investigations || []).map((inv: any) => ({
          ...inv,
          keywords: inv.keywords ?? inv.query_config?.keywords ?? [],
          date_start: inv.date_start ?? inv.query_config?.dateStart ?? '',
          date_end: inv.date_end ?? inv.query_config?.dateEnd ?? '',
          sources: inv.sources ?? inv.query_config?.sources ?? []
        }));
      }
    } catch (error) {
      console.error('Error loading investigations:', error);
    } finally {
      loading = false;
    }
  }

  function addKeyword() {
    newKeywords = commitKeywords(newKeywords, newKeywordsInput);
    newKeywordsInput = '';
  }

  function removeKeyword(keyword: string) {
    newKeywords = newKeywords.filter((k: string) => k !== keyword);
  }

  function handleKeywordsKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addKeyword();
    }
  }

  function openModal() {
    newName = '';
    newDescription = '';
    newKeywordsInput = '';
    newKeywords = [];
    newDateStart = '';
    newDateEnd = '';
    newSources = { gdelt: true, radio: true, social: true };
    createInWorkspace = null;
    showNewModal = true;
  }

  function closeModal() {
    showNewModal = false;
  }

  // A reversed range is caught here, before the request, so the message sits beside the dates
  $: rangeError = newDateStart && newDateEnd && newDateStart > newDateEnd ? 'The start date is after the end date.' : '';

  async function createInvestigation() {
    // Create is disabled while the range is wrong; the message is beside the dates
    if (!newName.trim() || rangeError) return;
    // A keyword typed but not confirmed with Enter or a comma still counts
    newKeywords = commitKeywords(newKeywords, newKeywordsInput);
    newKeywordsInput = '';
    creating = true;
    createError = '';
    try {
      const sources: string[] = [];
      if (newSources.gdelt) sources.push('gdelt');
      if (newSources.radio) sources.push('radio');
      if (newSources.social) sources.push('social');

      const response = await fetch('/api/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim(),
          keywords: newKeywords,
          date_start: newDateStart,
          date_end: newDateEnd,
          sources,
          ...(createInWorkspace ? { workspace_id: createInWorkspace } : {})
        })
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.success && result.investigation) {
        goto(`/investigations/${result.investigation.id}`);
      } else {
        createError = result.error || `Could not create the investigation (HTTP ${response.status})`;
      }
    } catch (error) {
      console.error('Error creating investigation:', error);
      createError = 'Could not create the investigation. Please try again.';
    } finally {
      creating = false;
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  function getSourceBadgeColor(source: string): string {
    switch (source) {
      case 'gdelt': return 'bg-amber-100 text-amber-800';
      case 'radio': return 'bg-emerald-100 text-emerald-800';
      case 'social': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getSourceLabel(source: string): string {
    switch (source) {
      case 'gdelt': return 'GDELT';
      case 'radio': return 'Radio';
      case 'social': return 'Social';
      default: return source;
    }
  }
</script>

<svelte:head>
  <title>Research Investigations - Social Explorer</title>
  <meta name="description" content="Cross-dataset research investigations" />
</svelte:head>

<!-- Header -->
<div class="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10">
          <svg class="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-white">Research Investigations</h1>
          <p class="text-sm text-indigo-300">
            {#if workspaceId}In workspace: {workspaceName || `#${workspaceId}`} · <a href="/investigations" class="underline hover:text-white">Show all</a>{:else}Cross-dataset correlation analysis{/if}
          </p>
        </div>
      </div>
      <button
        on:click={openModal}
        class="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Investigation
      </button>
    </div>
  </div>
</div>

<!-- Content -->
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {#if loading}
    <div class="flex items-center justify-center py-20">
      <svg class="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <span class="ml-3 text-gray-600">Loading investigations...</span>
    </div>
  {:else if investigations.length === 0}
    <!-- Empty state -->
    <div class="text-center py-20">
      <div class="mx-auto w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">No investigations yet</h3>
      <p class="text-gray-500 max-w-md mx-auto mb-6">
        Create one to start exploring cross-dataset correlations.
      </p>
      <button
        on:click={openModal}
        class="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Create Your First Investigation
      </button>
    </div>
  {:else}
    <!-- Investigation cards grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {#each investigations as investigation}
        <button
          on:click={() => goto(`/investigations/${investigation.id}`)}
          class="text-left bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all p-6 group"
        >
          <div class="flex items-start justify-between mb-3">
            <h3 class="text-lg font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
              {investigation.name}
            </h3>
            <span class="text-xs text-gray-500 whitespace-nowrap ml-4">
              {formatDate(investigation.created_at)}
            </span>
          </div>

          {#if investigation.description}
            <p class="text-sm text-gray-600 mb-4 line-clamp-2">{investigation.description}</p>
          {/if}

          <!-- Keywords -->
          {#if investigation.keywords && investigation.keywords.length > 0}
            <div class="flex flex-wrap gap-1.5 mb-4">
              {#each investigation.keywords as keyword, ki}
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  {keyword}
                </span>
              {/each}
            </div>
          {/if}

          <!-- Date range and sources -->
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-1.5 text-xs text-gray-500">
              {#if investigation.date_start || investigation.date_end}
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{formatDay(investigation.date_start, { year: true })} - {formatDay(investigation.date_end, { year: true })}</span>
              {/if}
            </div>
            <div class="flex items-center space-x-1.5">
              {#each (investigation.sources || []) as source, si}
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getSourceBadgeColor(source)}">
                  {getSourceLabel(source)}
                </span>
              {/each}
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<!-- New Investigation Modal -->
{#if showNewModal}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
      <!-- Backdrop -->
      <button
        class="fixed inset-0 bg-black/50 transition-opacity"
        on:click={closeModal}
        aria-label="Close modal"
      ></button>

      <!-- Modal -->
      <div class="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 z-10">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-xl font-bold text-gray-900">New Investigation</h2>
            {#if createInWorkspace}
              <p class="mt-0.5 text-sm text-ink-600">Will be created in workspace: <span class="font-medium text-ink-900">{workspaceName || `#${createInWorkspace}`}</span></p>
            {/if}
          </div>
          <button on:click={closeModal} class="text-gray-500 hover:text-gray-600 transition-colors" aria-label="Close modal">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-5">
          <!-- Title -->
          <div>
            <label for="inv-name" class="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              id="inv-name"
              type="text"
              bind:value={newName}
              placeholder="e.g., Ukraine Conflict Media Analysis"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>

          <!-- Description -->
          <div>
            <label for="inv-desc" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              id="inv-desc"
              bind:value={newDescription}
              rows="3"
              placeholder="Describe the research question or hypothesis..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
            ></textarea>
          </div>

          <!-- Keywords -->
          <div>
            <label for="inv-keywords" class="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
            <div class="flex items-center space-x-2">
              <input
                id="inv-keywords"
                type="text"
                bind:value={newKeywordsInput}
                on:keydown={handleKeywordsKeydown}
                placeholder="Type keyword and press Enter or comma"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
              <button
                on:click={addKeyword}
                class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            {#if newKeywords.length > 0}
              <div class="flex flex-wrap gap-1.5 mt-2">
                {#each newKeywords as keyword, nki}
                  <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    {keyword}
                    <button
                      on:click={() => removeKeyword(keyword)}
                      class="ml-1.5 text-indigo-500 hover:text-indigo-700"
                      aria-label="Remove {keyword}"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Date Range -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="inv-date-start" class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                id="inv-date-start"
                type="date"
                bind:value={newDateStart}
                aria-invalid={rangeError ? 'true' : undefined}
                aria-describedby="inv-date-hint"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
            <div>
              <label for="inv-date-end" class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                id="inv-date-end"
                type="date"
                bind:value={newDateEnd}
                aria-invalid={rangeError ? 'true' : undefined}
                aria-describedby="inv-date-hint"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
          </div>
          <p id="inv-date-hint" class="-mt-2 text-xs {rangeError ? 'text-danger-700' : 'text-ink-500'}">
            {rangeError || 'Leave both blank to use the last 90 days. The end date is included.'}
          </p>

          <!-- Sources -->
          <div>
            <span class="block text-sm font-medium text-gray-700 mb-2">Data Sources</span>
            <div class="flex items-center space-x-6">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" bind:checked={newSources.gdelt} class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span class="text-sm text-gray-700">GDELT Events</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" bind:checked={newSources.radio} class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span class="text-sm text-gray-700">Radio Transcripts</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" bind:checked={newSources.social} class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span class="text-sm text-gray-700">Social Media</span>
              </label>
            </div>
          </div>
        </div>

        {#if createError}
          <p role="alert" class="mt-4 text-sm text-red-600">{createError}</p>
        {/if}

        <!-- Actions -->
        <div class="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
          <button
            on:click={closeModal}
            class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            on:click={createInvestigation}
            disabled={!newName.trim() || creating || !!rangeError}
            class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {#if creating}
              <span class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Creating...
              </span>
            {:else}
              Create
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
