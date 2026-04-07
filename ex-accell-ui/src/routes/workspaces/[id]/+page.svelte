<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { formatDate, formatRelativeTime, formatTimestamp } from '$lib/utils/formatUtils';

  // Get workspace ID from URL
  $: workspaceId = $page.params.id;

  let workspace: any = null;
  let project: any = null;
  let linkedDatasets: any[] = [];
  let availableDatasets: any[] = [];
  let loading = true;
  let errorMessage = '';
  let showAddDatasets = false;
  let selectedDatasets: number[] = [];
  let loadingDatasets = false;

  onMount(async () => {
    await loadWorkspace();
  });

  async function loadWorkspace() {
    loading = true;
    try {
      // Load workspace details
      const workspaceResponse = await fetch(`/api/workspaces?id=${workspaceId}`);
      const workspaceResult = await workspaceResponse.json();

      if (workspaceResult.success && workspaceResult.workspace) {
        workspace = workspaceResult.workspace;

        // Load parent project
        const projectResponse = await fetch(`/api/projects?id=${workspace.project_id}`);
        const projectResult = await projectResponse.json();
        if (projectResult.success) {
          project = projectResult.project;
        }

        // Load linked datasets
        await loadLinkedDatasets();
      } else {
        // Workspace not found
        goto('/projects');
      }
    } catch (error) {
      console.error('Error loading workspace:', error);
      errorMessage = 'Failed to load workspace. Redirecting to projects.';
      goto('/projects');
    } finally {
      loading = false;
    }
  }

  async function loadLinkedDatasets() {
    try {
      const response = await fetch(`/api/datasets?workspace_id=${workspaceId}`);
      const result = await response.json();
      if (result.success) {
        linkedDatasets = result.datasets || [];
      }
    } catch (error) {
      console.error('Error loading linked datasets:', error);
      errorMessage = 'Failed to load linked datasets. Please try again.';
    }
  }

  async function loadAvailableDatasets() {
    loadingDatasets = true;
    try {
      const response = await fetch('/api/datasets?status=available');
      const result = await response.json();
      if (result.success) {
        // Filter out already linked datasets
        const linkedIds = linkedDatasets.map(d => d.dataset_id);
        availableDatasets = (result.datasets || []).filter(
          (d: any) => !linkedIds.includes(d.id)
        );
      }
    } catch (error) {
      console.error('Error loading available datasets:', error);
      errorMessage = 'Failed to load available datasets. Please try again.';
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

  async function addSelectedDatasets() {
    if (selectedDatasets.length === 0) return;

    try {
      // Link selected datasets
      for (const datasetId of selectedDatasets) {
        await fetch('/api/datasets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'link',
            workspace_id: parseInt(workspaceId ?? '0'),
            dataset_id: datasetId,
            added_by: 'current_user@example.com' // TODO: Get from auth
          })
        });
      }

      // Reload linked datasets
      await loadLinkedDatasets();

      // Reset form
      showAddDatasets = false;
      selectedDatasets = [];
      availableDatasets = [];
    } catch (error) {
      console.error('Error adding datasets:', error);
      errorMessage = 'Failed to add datasets to workspace. Please try again.';
    }
  }

  async function unlinkDataset(datasetId: number) {
    if (!confirm('Are you sure you want to remove this dataset from the workspace?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/datasets?action=unlink&workspace_id=${workspaceId}&dataset_id=${datasetId}`,
        { method: 'DELETE' }
      );

      const result = await response.json();
      if (result.success) {
        // Reload linked datasets
        await loadLinkedDatasets();
      }
    } catch (error) {
      console.error('Error unlinking dataset:', error);
      errorMessage = 'Failed to remove dataset from workspace. Please try again.';
    }
  }

  // Load available datasets when add form is shown
  $: if (showAddDatasets && availableDatasets.length === 0) {
    loadAvailableDatasets();
  }
</script>

<svelte:head>
  <title>{workspace ? workspace.name : 'Workspace'} | ex-accell</title>
</svelte:head>

<main class="min-h-screen bg-gray-50 pt-16">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if loading}
      <div class="flex items-center justify-center h-64">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    {:else if workspace}
      {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}
      <!-- Breadcrumbs -->
      <nav class="flex items-center space-x-2 text-sm text-gray-600 mb-6">
        <a href="/projects" class="hover:text-blue-600 transition-colors">Projects</a>
        <span>/</span>
        <a href="/projects/{project?.id}" class="hover:text-blue-600 transition-colors">{project?.name}</a>
        <span>/</span>
        <span class="text-gray-900 font-medium">{workspace.name}</span>
      </nav>

      <!-- Workspace Header -->
      <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-3 mb-2">
              <h1 class="text-3xl font-bold text-gray-900">{workspace.name}</h1>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {workspace.workspace_type}
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium {workspace.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                {workspace.status}
              </span>
            </div>
            {#if workspace.description}
              <p class="text-gray-600 mt-2">{workspace.description}</p>
            {/if}
            <div class="flex items-center mt-4 space-x-4 text-sm text-gray-500">
              <span>Created {formatDate(workspace.created_at)}</span>
              {#if workspace.created_by}
                <span>• by {workspace.created_by}</span>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Workspace Overview Stats — derived from actual linked datasets -->
      {@const totalRecords = linkedDatasets.reduce((sum, d) => sum + (parseInt(d.record_count) || 0), 0)}
      {@const activeCount = linkedDatasets.filter(d => d.status === 'active').length}
      {@const dataTypes = [...new Set(linkedDatasets.map(d => d.dataset_type).filter(Boolean))]}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-500">Total Records</span>
            <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
              </svg>
            </div>
          </div>
          <div class="text-2xl font-bold text-gray-900">{totalRecords.toLocaleString()}</div>
          <p class="text-xs text-gray-500 mt-1">across {linkedDatasets.length} dataset{linkedDatasets.length !== 1 ? 's' : ''}</p>
        </div>

        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-500">Datasets</span>
            <div class="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
              </svg>
            </div>
          </div>
          <div class="text-2xl font-bold text-gray-900">{linkedDatasets.length}</div>
          <p class="text-xs text-gray-500 mt-1">{activeCount} active</p>
        </div>

        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-500">Data Types</span>
            <div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
              </svg>
            </div>
          </div>
          <div class="text-2xl font-bold text-gray-900">{dataTypes.length}</div>
          <p class="text-xs text-gray-500 mt-1">{dataTypes.join(', ') || 'none'}</p>
        </div>

        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-500">Last Updated</span>
            <div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
          <div class="text-lg font-bold text-gray-900">{formatDate(workspace.updated_at) || '—'}</div>
          <p class="text-xs text-gray-500 mt-1">{formatRelativeTime(workspace.updated_at) || ''}</p>
        </div>
      </div>

      <!-- Datasets Section -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Datasets</h2>
            <p class="text-sm text-gray-600 mt-1">
              Manage datasets linked to this workspace ({linkedDatasets.length})
            </p>
          </div>
          <button
            on:click={() => showAddDatasets = !showAddDatasets}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            + Add Datasets
          </button>
        </div>

        <!-- Add Datasets Form -->
        {#if showAddDatasets}
          <div class="mb-6 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Add Datasets to Workspace</h3>

            {#if loadingDatasets}
              <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p class="text-sm text-gray-600 mt-2">Loading available datasets...</p>
              </div>
            {:else if availableDatasets.length === 0}
              <div class="bg-gray-50 rounded-md p-6 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                </svg>
                <p class="text-sm text-gray-600 mt-3">No additional datasets available</p>
                <p class="text-xs text-gray-500 mt-1">All available datasets are already linked to this workspace</p>
              </div>
            {:else}
              <div class="border border-gray-300 rounded-md max-h-96 overflow-y-auto">
                {#each availableDatasets as dataset}
                  <div
                    class="p-4 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                    on:click={() => toggleDatasetSelection(dataset.id)}>
                    <div class="flex items-start">
                      <input
                        type="checkbox"
                        checked={selectedDatasets.includes(dataset.id)}
                        on:click|stopPropagation={() => toggleDatasetSelection(dataset.id)}
                        class="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div class="ml-3 flex-1">
                        <div class="flex items-center justify-between">
                          <h4 class="text-sm font-medium text-gray-900">{dataset.name}</h4>
                          <div class="flex items-center space-x-2">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {dataset.dataset_type}
                            </span>
                            {#if dataset.source_platform}
                              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                {dataset.source_platform}
                              </span>
                            {/if}
                          </div>
                        </div>
                        {#if dataset.description}
                          <p class="text-xs text-gray-600 mt-1">{dataset.description}</p>
                        {/if}
                        <div class="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                          <span>{(parseInt(dataset.record_count) || 0).toLocaleString()} records</span>
                          {#if dataset.date_range_start && dataset.date_range_end}
                            <span>• {formatDate(dataset.date_range_start)} - {formatDate(dataset.date_range_end)}</span>
                          {/if}
                          <span>• {dataset.schema_name}.{dataset.table_name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
              {#if selectedDatasets.length > 0}
                <p class="text-sm text-gray-600 mt-3">
                  {selectedDatasets.length} dataset{selectedDatasets.length === 1 ? '' : 's'} selected
                </p>
              {/if}
            {/if}

            <div class="mt-4 flex items-center justify-end space-x-3">
              <button
                on:click={() => { showAddDatasets = false; selectedDatasets = []; }}
                class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                on:click={addSelectedDatasets}
                disabled={selectedDatasets.length === 0}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Add {selectedDatasets.length > 0 ? selectedDatasets.length : ''} Dataset{selectedDatasets.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        {/if}

        <!-- Dataset Breakdown -->
        {#if linkedDatasets.length > 0}
          <div class="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
            <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Dataset Breakdown</h3>
            <div class="space-y-3">
              {#each linkedDatasets as dataset}
                {@const maxRecords = Math.max(...linkedDatasets.map(d => parseInt(d.record_count) || 0), 1)}
                <div class="flex items-center gap-3">
                  <div class="w-32 text-sm text-gray-700 truncate font-medium" title={dataset.dataset_name}>{dataset.dataset_name}</div>
                  <div class="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      class="h-full rounded-full {dataset.dataset_type === 'gdelt_events' ? 'bg-amber-500' : dataset.dataset_type === 'radio' ? 'bg-purple-500' : 'bg-blue-500'}"
                      style="width: {Math.max(((parseInt(dataset.record_count) || 0) / maxRecords) * 100, 2)}%"
                    ></div>
                  </div>
                  <div class="w-24 text-right text-sm text-gray-600">{(parseInt(dataset.record_count) || 0).toLocaleString()}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Linked Datasets List -->
        {#if linkedDatasets.length === 0}
          <div class="bg-white rounded-xl shadow-sm p-8 text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
            </svg>
            <p class="mt-2 text-sm font-medium text-gray-900">No datasets linked</p>
            <p class="text-xs text-gray-600 mt-1">Add datasets to start analyzing data in this workspace</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {#each linkedDatasets as dataset}
              <div class="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between mb-3">
                  <div class="flex-1">
                    <h3 class="text-base font-semibold text-gray-900">{dataset.dataset_name}</h3>
                    <div class="flex items-center mt-2 space-x-2">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {dataset.dataset_type}
                      </span>
                      {#if dataset.source_platform}
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {dataset.source_platform}
                        </span>
                      {/if}
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {dataset.status}
                      </span>
                    </div>
                  </div>
                  <button
                    on:click={() => unlinkDataset(dataset.dataset_id)}
                    class="text-red-600 hover:text-red-800 transition-colors p-2 hover:bg-red-50 rounded-md"
                    title="Remove dataset">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>

                {#if dataset.description}
                  <p class="text-sm text-gray-600 mb-3">{dataset.description}</p>
                {/if}

                <div class="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                  <div>
                    <p class="text-xs text-gray-500">Records</p>
                    <p class="text-sm font-medium text-gray-900">{(parseInt(dataset.record_count) || 0).toLocaleString()}</p>
                  </div>
                  {#if dataset.date_range_start && dataset.date_range_end}
                    <div>
                      <p class="text-xs text-gray-500">Date Range</p>
                      <p class="text-sm font-medium text-gray-900">
                        {formatDate(dataset.date_range_start)} - {formatDate(dataset.date_range_end)}
                      </p>
                    </div>
                  {/if}
                </div>

                <div class="mt-3 pt-3 border-t border-gray-100">
                  <p class="text-xs text-gray-500">Added {formatDate(dataset.added_at)}</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Analytics Applications -->
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-6">Analytics Applications</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Dashboards -->
          <a
            href="/dashboards?workspace={workspaceId}"
            class="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-6 border border-gray-200">
            <div class="flex items-center justify-between mb-3">
              <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
              </div>
              <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Active</span>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-1">Dashboards</h3>
            <p class="text-sm text-gray-600">Real-time analytics and visualizations</p>
          </a>

          <!-- Text Analytics -->
          <a
            href="/text-analytics?workspace={workspaceId}"
            class="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-6 border border-gray-200">
            <div class="flex items-center justify-between mb-3">
              <div class="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <span class="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">Ready</span>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-1">Text Analytics</h3>
            <p class="text-sm text-gray-600">NLP and sentiment analysis</p>
          </a>

          <!-- Data Management -->
          <a
            href="/data-management?workspace={workspaceId}"
            class="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-6 border border-gray-200">
            <div class="flex items-center justify-between mb-3">
              <div class="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                </svg>
              </div>
              <span class="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">Active</span>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-1">Data Management</h3>
            <p class="text-sm text-gray-600">Query and export data</p>
          </a>
        </div>
        {#if linkedDatasets.length === 0}
          <div class="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-amber-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div>
                <p class="text-sm font-medium text-amber-800">No datasets linked</p>
                <p class="text-xs text-amber-700 mt-1">Add datasets above to enable analytics applications for this workspace.</p>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="text-center py-12">
        <p class="text-gray-600">Workspace not found</p>
      </div>
    {/if}
  </div>
</main>
