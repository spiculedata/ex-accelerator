<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { currentProject, loadCurrentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { getStatusColor } from '$lib/utils/colorUtils';
  import { formatNumber } from '$lib/utils/formatUtils';
  import { Modal } from '$lib/components/ui';
  import { normalizeDataset, unlinkedDatasets } from '$lib/utils/datasetRows';

  $: workspaceId = $page.url.searchParams.get('workspace');

  let loading = true;
  let errorMessage = '';
  let dataSources: any[] = [];
  let availableDatasets: any[] = [];
  let allDatasets: any[] = [];
  let workflows: any[] = [];
  let dataStats = {
    totalRecordsCapture: 0,
    activeConnections: 0,
    totalDatasets: 0,
    activeWorkflows: 0,
    totalStorageUsed: '—',
    lastCaptureUpdate: '—'
  };

  let showAddSourceModal = false;
  // Linking a dataset: which one is in flight, a message for the modal, and a confirmation for the page
  let linkingId: number | null = null;
  let linkError = '';
  let linkNotice = '';
  let showPreviewModal = false;
  let showRadioConfigModal = false;
  let showCrawlerModal = false;
  let previewDataset: any = null;

  let selectedDataset: any = null;
  let selectedWorkflow: any = null;

  // Crawler state
  let crawlerConfig = {
    platform: 'bluesky',
    urls: '',
    crawlId: '',
    maxPosts: 1000,
    maxDepth: 1,
    timeAgo: '30d',
    skipMedia: true,
    samplingMethod: 'channel',
    youtubeApiKey: ''
  };
  let crawlerStatus = '';

  // WavePulse radio state
  let wavePulseStatus: any = { status: 'offline' };
  let radioConfig = {
    radioStreams: [
      { url: 'https://ice42.securenetsystems.net/WGSV', radioName: 'WGSV', state: 'VA', timeSlots: [{ start: '00:00', end: '23:59' }] }
    ],
    device: 'cpu',
    computeType: 'float32',
    whisperModel: 'large-v3',
    enableTranscription: true,
    enableClassification: false,
    huggingFaceToken: '',
    geminiApiKey: ''
  };

  // Active tab state — supports deep linking: /data-management?tab=workflows
  let activeTab = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('tab') || 'capture') : 'capture';

  onMount(async () => {
    await loadCurrentProject();
    if (!$currentProject) {
      goto('/projects');
      return;
    }
    await loadData();
    // The workspace page's "Link dataset" button arrives with ?link=1 and goes straight to the dialog
    if (workspaceId && $page.url.searchParams.get('link') === '1') openAddSourceModal();
  });

  async function loadData() {
    try {
      loading = true;
      errorMessage = '';

      // Load datasets for current workspace (if scoped)
      const dsParams = workspaceId ? `?workspace_id=${workspaceId}` : '';
      const dsResponse = await fetch(`/api/datasets${dsParams}`);
      const dsResult = await dsResponse.json();
      if (dsResult.success) {
        availableDatasets = (dsResult.datasets || []).map(normalizeDataset);
      }

      // Load all available datasets (for the "add source" modal)
      const allDsResponse = await fetch('/api/datasets?status=available');
      const allDsResult = await allDsResponse.json();
      if (allDsResult.success) {
        allDatasets = (allDsResult.datasets || []).map(normalizeDataset);
      }

      // Load workflows
      const wfResponse = await fetch('/api/workflows');
      const wfResult = await wfResponse.json();
      if (wfResult.success) {
        workflows = wfResult.workflows || [];
      }

      // Build data sources from datasets
      dataSources = availableDatasets.map((ds: any) => {
        const isRadio = ds.dataset_type === 'radio';
        const isGdelt = ds.dataset_type?.startsWith('gdelt');
        return {
          id: ds.id,
          name: ds.name,
          description: ds.description || '',
          icon: isRadio ? '📻' : isGdelt ? '🌍' : ds.source_platform === 'bluesky' ? '🦋' : ds.dataset_type === 'social_media' ? '📱' : '📊',
          color: isRadio ? 'rose' : isGdelt ? 'amber' : ds.source_platform === 'bluesky' ? 'sky' : 'blue',
          status: isRadio ? (wavePulseStatus.status === 'running' ? 'recording' : 'idle') : (ds.status === 'available' ? 'connected' : ds.status),
          lastSync: ds.last_updated,
          recordsCaptured: parseInt(ds.record_count) || 0,
          datasetType: ds.dataset_type,
          sourcePlatform: ds.source_platform,
          isRadio
        };
      });

      // Calculate stats
      dataStats = {
        totalRecordsCapture: dataSources.reduce((sum: number, s: any) => sum + s.recordsCaptured, 0),
        activeConnections: dataSources.filter((s: any) => s.status === 'connected').length,
        totalDatasets: availableDatasets.length,
        activeWorkflows: workflows.filter((w: any) => w.status === 'running').length,
        totalStorageUsed: formatNumber(dataSources.reduce((sum: number, s: any) => sum + s.recordsCaptured, 0)) + ' records',
        lastCaptureUpdate: dataSources[0]?.lastSync || '—'
      };

      loading = false;
    } catch (error) {
      console.error('Error loading data management data:', error);
      errorMessage = 'Failed to load data. Please try again.';
      loading = false;
    }
  }

  function openAddSourceModal() {
    // A fresh dialog starts clean: no old error, and the earlier confirmation has done its job
    linkError = '';
    linkNotice = '';
    showAddSourceModal = true;
  }

  function handleImportDataset() {
    showCrawlerModal = true;
  }

  async function handleLinkDataset(dataset: any) {
    if (linkingId !== null) return;
    linkingId = dataset.id;
    linkError = '';
    try {
      const response = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link',
          workspace_id: parseInt(workspaceId || '0'),
          dataset_id: dataset.id,
          added_by: 'user',
          settings: {}
        })
      });
      const result = await response.json();
      if (result.success) {
        showAddSourceModal = false;
        linkNotice = `Linked "${dataset.name}" to this workspace.`;
        await loadData();
      } else {
        linkError = result.error || 'We could not link that dataset. Try again.';
      }
    } catch (error) {
      linkError = 'We could not link that dataset. Try again.';
    } finally {
      linkingId = null;
    }
  }

  function handlePreviewDataset(dataset: any) {
    previewDataset = dataset;
    showPreviewModal = true;
  }

  function handleConfigureSource(source: any) {
    if (source.isRadio) {
      showRadioConfigModal = true;
      return;
    }
    if (workspaceId) {
      goto(`/workspaces/${workspaceId}`);
    } else {
      goto('/projects');
    }
  }

  function getStatusIcon(status: string) {
    const icons: Record<string, string> = {
      'connected': '🟢',
      'paused': '🟡', 
      'disconnected': '⚫',
      'error': '🔴',
      'ready': '✅',
      'processing': '⏳',
      'running': '🔄',
      'completed': '🎉',
      'draft': '📝'
    };
    return icons[status] || '●';
  }

  function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleString();
  }

  function createWorkflowFromDataset(dataset: any) {
    selectedDataset = dataset;
    goto(`/data-management/workflow-builder?dataset=${dataset.id}`);
  }

  function editWorkflow(workflow: any) {
    goto(`/data-management/workflow-builder?workflow=${encodeURIComponent(workflow.id)}`);
  }

  // ─── WavePulse Radio Functions ───────────────────────────────────────────

  async function checkWavePulseStatus() {
    try {
      const response = await fetch('/api/wavepulse?action=status');
      const result = await response.json();
      wavePulseStatus = result.success ? result : { status: 'offline' };
    } catch {
      wavePulseStatus = { status: 'offline' };
    }
  }

  async function startRadioRecording() {
    try {
      errorMessage = '';
      const response = await fetch('/api/wavepulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', config: radioConfig })
      });
      const result = await response.json();
      if (!result.success) {
        errorMessage = result.error || 'Failed to start radio recording';
      }
      showRadioConfigModal = false;
      await checkWavePulseStatus();
    } catch (error) {
      errorMessage = 'Failed to connect to radio service';
    }
  }

  async function stopRadioRecording() {
    try {
      await fetch('/api/wavepulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      await checkWavePulseStatus();
    } catch {
      errorMessage = 'Failed to stop radio recording';
    }
  }

  function addRadioStream() {
    radioConfig.radioStreams = [...radioConfig.radioStreams, { url: '', radioName: '', state: '', timeSlots: [{ start: '00:00', end: '23:59' }] }];
  }

  function removeRadioStream(index: number) {
    radioConfig.radioStreams = radioConfig.radioStreams.filter((_: any, i: number) => i !== index);
  }

  function handleConfigureRadio() {
    showRadioConfigModal = true;
  }

  // ─── Crawler Functions ────────────────────────────────────────────────

  async function startCrawl() {
    try {
      crawlerStatus = 'starting';
      const urls = crawlerConfig.urls.split(/[,\n]/).map(u => u.trim()).filter(Boolean);
      if (urls.length === 0) {
        errorMessage = 'Please enter at least one URL or channel';
        crawlerStatus = '';
        return;
      }

      const response = await fetch('/api/crawler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...crawlerConfig,
          urls,
          crawlId: crawlerConfig.crawlId || `${crawlerConfig.platform}-${Date.now()}`
        })
      });
      const result = await response.json();
      if (result.success) {
        crawlerStatus = 'scheduled';
        showCrawlerModal = false;
        setTimeout(() => { crawlerStatus = ''; }, 5000);
      } else {
        errorMessage = result.error || 'Failed to schedule crawl';
        crawlerStatus = '';
      }
    } catch (error) {
      errorMessage = 'Failed to connect to crawler service';
      crawlerStatus = '';
    }
  }

  // Poll WavePulse status
  let statusInterval: ReturnType<typeof setInterval>;
  onMount(() => {
    checkWavePulseStatus();
    statusInterval = setInterval(checkWavePulseStatus, 15000);
    return () => clearInterval(statusInterval);
  });
</script>

<svelte:head>
  <title>Data Management - Social Explorer</title>
  <meta name="description" content="Unified data capture and processing platform for social media analytics" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <PageHeader
    title="Data Management"
    subtitle="Capture, process, and transform your social media data with unified workflows"
    accentColor="teal">
    <svelte:fragment slot="icon">
      <div class="w-16 h-16 bg-gradient-to-br from-teal-400 to-cyan-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
        </svg>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="actions">
      <button
        on:click={() => goto('/data-management/workflow-builder')}
        class="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg">
        Create Workflow
      </button>
    </svelte:fragment>
  </PageHeader>

  {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

  {#if loading}
    <div class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
        <p class="text-gray-500">Loading data management...</p>
      </div>
    </div>
  {:else}

    <!-- Pipeline Overview -->
    <div class="bg-white rounded-xl shadow-sm p-4 mb-6 overflow-x-auto">
      <div class="flex items-center justify-between min-w-[600px]">
        <button on:click={() => activeTab = 'capture'} class="flex flex-col items-center px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors {activeTab === 'capture' ? 'bg-blue-50' : ''}">
          <span class="text-2xl mb-1">📡</span>
          <span class="text-xs font-medium text-gray-700">Sources</span>
          <span class="text-lg font-bold text-blue-600">{dataSources.length}</span>
        </button>
        <div class="flex-shrink-0 w-8 h-0.5 bg-gray-300"></div>
        <button on:click={() => activeTab = 'capture'} class="flex flex-col items-center px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          <span class="text-2xl mb-1">⚡</span>
          <span class="text-xs font-medium text-gray-700">Jobs</span>
          <span class="text-lg font-bold text-amber-600">{dataStats.activeWorkflows}</span>
        </button>
        <div class="flex-shrink-0 w-8 h-0.5 bg-gray-300"></div>
        <button class="flex flex-col items-center px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          <span class="text-2xl mb-1">💾</span>
          <span class="text-xs font-medium text-gray-700">Records</span>
          <span class="text-lg font-bold text-emerald-600">{formatNumber(dataStats.totalRecordsCapture)}</span>
        </button>
        <div class="flex-shrink-0 w-8 h-0.5 bg-gray-300"></div>
        <button on:click={() => { activeTab = 'workflows'; linkNotice = ''; }} class="flex flex-col items-center px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors {activeTab === 'workflows' ? 'bg-blue-50' : ''}">
          <span class="text-2xl mb-1">⚙️</span>
          <span class="text-xs font-medium text-gray-700">Workflows</span>
          <span class="text-lg font-bold text-purple-600">{workflows.length}</span>
        </button>
        <div class="flex-shrink-0 w-8 h-0.5 bg-gray-300"></div>
        <button on:click={() => activeTab = 'datasets'} class="flex flex-col items-center px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors {activeTab === 'datasets' ? 'bg-blue-50' : ''}">
          <span class="text-2xl mb-1">📦</span>
          <span class="text-xs font-medium text-gray-700">Datasets</span>
          <span class="text-lg font-bold text-indigo-600">{availableDatasets.length}</span>
        </button>
        <div class="flex-shrink-0 w-8 h-0.5 bg-gray-300"></div>
        <div class="flex flex-col items-center px-4 py-2">
          <span class="text-2xl mb-1">📊</span>
          <span class="text-xs font-medium text-gray-700">Analytics</span>
          <span class="text-lg font-bold text-green-600">✓</span>
        </div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="bg-white rounded-xl shadow-sm mb-4">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8 px-6">
          <button
            on:click={() => activeTab = 'capture'}
            class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'capture' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            Data Sources ({dataSources.length})
          </button>
          <button
            on:click={() => activeTab = 'datasets'}
            class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'datasets' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            Datasets ({availableDatasets.length})
          </button>
          <button
            on:click={() => activeTab = 'workflows'}
            class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'workflows' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            Processing Workflows ({workflows.length})
          </button>
        </nav>
      </div>

      <div class="p-6">
        <div role="status" aria-live="polite">
          {#if linkNotice}
            <p class="mb-4 rounded-lg border border-success-200 bg-success-50 px-4 py-2 text-sm text-ink-900">{linkNotice}</p>
          {/if}
        </div>
        {#if activeTab === 'capture'}
          <!-- Data Sources -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Data Sources</h3>
            <div class="flex space-x-2">
              <button on:click={openAddSourceModal} class="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                Link dataset
              </button>
              <button on:click={handleImportDataset} class="px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors">
                Start Crawl
              </button>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Records</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each dataSources as source}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3">
                      <div class="flex items-center">
                        <span class="text-xl mr-3">{source.icon}</span>
                        <div>
                          <div class="text-sm font-medium text-gray-900">{source.name}</div>
                          <div class="text-xs text-gray-500 truncate max-w-xs">{source.description?.substring(0, 60) || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{source.datasetType || source.sourcePlatform || '—'}</span>
                    </td>
                    <td class="px-4 py-3 text-right text-sm font-medium text-gray-900">{formatNumber(source.recordsCaptured)}</td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {
                        source.status === 'connected' || source.status === 'available' ? 'bg-green-100 text-green-700' :
                        source.status === 'recording' ? 'bg-blue-100 text-blue-700' :
                        source.status === 'idle' ? 'bg-gray-100 text-gray-600' :
                        'bg-yellow-100 text-yellow-700'
                      }">
                        {source.status}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end space-x-2">
                        {#if source.isRadio}
                          <button on:click={() => handleConfigureSource(source)} class="text-xs text-blue-600 hover:text-blue-800 font-medium">Configure</button>
                        {:else}
                          <button on:click={() => handlePreviewDataset(source)} class="text-xs text-blue-600 hover:text-blue-800 font-medium">Preview</button>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

        {:else if activeTab === 'datasets'}
          <!-- Available Datasets -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Available Datasets</h3>
            <button on:click={handleImportDataset} class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              Start crawl
            </button>
          </div>

          <div class="bg-white rounded-xl shadow-sm overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dataset</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Records</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each availableDatasets as dataset}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3">
                      <div class="text-sm font-medium text-gray-900">{dataset.name}</div>
                      {#if dataset.columns && dataset.columns.length > 0}
                        <div class="flex flex-wrap gap-1 mt-1">
                          {#each dataset.columns.slice(0, 3) as column}
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{column}</span>
                          {/each}
                          {#if dataset.columns.length > 3}
                            <span class="text-xs text-gray-400">+{dataset.columns.length - 3}</span>
                          {/if}
                        </div>
                      {/if}
                    </td>
                    <td class="px-4 py-3">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{dataset.dataset_type || dataset.type || 'unknown'}</span>
                    </td>
                    <td class="px-4 py-3 text-right text-sm font-medium text-gray-900">{formatNumber(parseInt(dataset.record_count) || dataset.records || 0)}</td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getStatusColor(dataset.status)}">
                        {dataset.status}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-xs text-gray-500">
                      {#if dataset.created || dataset.last_updated}
                        {formatTimestamp(dataset.created || dataset.last_updated).split(',')[0]}
                      {:else}
                        —
                      {/if}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end space-x-2">
                        <button on:click={() => createWorkflowFromDataset(dataset)} class="text-xs text-teal-600 hover:text-teal-800 font-medium">Process</button>
                        <button on:click={() => handlePreviewDataset(dataset)} class="text-xs text-blue-600 hover:text-blue-800 font-medium">Preview</button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

        {:else if activeTab === 'workflows'}
          <!-- Processing Workflows -->
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">Processing Workflows</h2>
              <button 
                on:click={() => goto('/data-management/workflow-builder')}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                New Workflow
              </button>
            </div>

            <div class="space-y-4">
              {#each workflows as workflow}
                <div class="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                      <h3 class="font-medium text-gray-900 mb-1">{workflow.name}</h3>
                      <p class="text-sm text-gray-600 mb-2">{workflow.description}</p>
                      <div class="flex items-center space-x-4 text-sm text-gray-500">
                        {#if workflow.steps}<span>📊 {workflow.steps} steps</span>{/if}
                        {#if workflow.recordsProcessed}
                          <span>📈 {workflow.recordsProcessed.toLocaleString()} records</span>
                        {/if}
                        {#if workflow.created}<span>📅 {formatTimestamp(workflow.created)}</span>{/if}
                      </div>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(workflow.status)}">
                        {getStatusIcon(workflow.status)} {workflow.status}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center justify-between mb-4">
                    <div class="text-sm">
                      <span class="text-gray-600">Input:</span>
                      <span class="font-medium text-gray-900 ml-1">{workflow.inputSource || workflow.input_source || '—'}</span>
                      <span class="text-gray-400 mx-2">→</span>
                      <span class="text-gray-600">Output:</span>
                      <span class="font-medium text-gray-900 ml-1">{workflow.outputDataset || workflow.output_dataset || '—'}</span>
                    </div>
                  </div>

                  {#if workflow.status === 'running' && workflow.progress}
                    <div class="mb-4">
                      <div class="flex justify-between text-sm mb-1">
                        <span class="text-gray-600">Progress</span>
                        <span class="text-gray-900 font-medium">{workflow.progress}%</span>
                      </div>
                      <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-teal-600 h-2 rounded-full transition-all duration-300" style="width: {workflow.progress}%"></div>
                      </div>
                    </div>
                  {/if}

                  <div class="flex items-center justify-between">
                    <div class="flex space-x-2">
                      {#if workflow.status === 'draft'}
                        <button 
                          on:click={() => editWorkflow(workflow)}
                          class="text-sm text-blue-600 hover:text-blue-800 font-medium">{workflow.status === 'draft' ? 'Open in builder' : 'Edit'}</button>
                        <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">Run</button>
                      {:else if workflow.status === 'running'}
                        <button class="text-sm text-red-600 hover:text-red-800 font-medium">Stop</button>
                        <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">View Logs</button>
                      {:else if workflow.status === 'completed'}
                        <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">View Results</button>
                        <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">Download</button>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

  {/if}
  </div>

<Modal open={showAddSourceModal} title="Link a dataset" description="Choose a dataset to add to this workspace. It then scopes the dashboards and analysis." onclose={() => (showAddSourceModal = false)}>
  {#if linkError}
    <p role="alert" class="mb-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-ink-900">{linkError}</p>
  {/if}
  <ul class="space-y-2">
    {#each unlinkedDatasets(allDatasets, availableDatasets) as dataset (dataset.id)}
      <li>
        <button
          type="button"
          on:click={() => handleLinkDataset(dataset)}
          disabled={linkingId !== null}
          class="w-full rounded-lg border border-ink-200 p-4 text-left transition-colors hover:border-primary-300 hover:bg-primary-50 disabled:opacity-60"
        >
          <div class="font-medium text-ink-900">{dataset.name}{#if linkingId === dataset.id}<span class="ml-2 text-sm font-normal text-ink-600">Linking…</span>{/if}</div>
          <div class="mt-1 text-sm text-ink-600">{String(dataset.description ?? '').substring(0, 80)}</div>
          <div class="mt-2 flex items-center space-x-3 text-xs text-ink-500">
            <span>{dataset.dataset_type}</span>
            <span>{formatNumber(parseInt(String(dataset.record_count)) || 0)} records</span>
          </div>
        </button>
      </li>
    {:else}
      <li class="py-4 text-center text-sm text-ink-600">Every available dataset is already linked to this workspace.</li>
    {/each}
  </ul>
  <svelte:fragment slot="footer">
    <button type="button" on:click={() => (showAddSourceModal = false)} class="w-full rounded-lg bg-ink-100 px-4 py-2 text-sm text-ink-700 hover:bg-ink-200">Close</button>
  </svelte:fragment>
</Modal>

<Modal open={showPreviewModal} title={previewDataset?.name ?? 'Dataset'} description="What this dataset contains" onclose={() => (showPreviewModal = false)}>
  {#if previewDataset}
    <dl class="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
      <dt class="text-ink-500">Description</dt><dd class="col-span-2 text-ink-900">{previewDataset.description || 'No description'}</dd>
      <dt class="text-ink-500">Type</dt><dd class="col-span-2 text-ink-900">{previewDataset.dataset_type || previewDataset.type || 'unknown'}</dd>
      {#if previewDataset.source_platform}<dt class="text-ink-500">Platform</dt><dd class="col-span-2 text-ink-900">{previewDataset.source_platform}</dd>{/if}
      <dt class="text-ink-500">Records</dt><dd class="col-span-2 text-ink-900">{formatNumber(parseInt(String(previewDataset.record_count)) || previewDataset.records || 0)}</dd>
      {#if previewDataset.date_range_start}<dt class="text-ink-500">Date range</dt><dd class="col-span-2 text-ink-900">{String(previewDataset.date_range_start).slice(0, 10)} to {String(previewDataset.date_range_end ?? '').slice(0, 10)}</dd>{/if}
      <dt class="text-ink-500">{previewDataset.workspace_id ? 'Link status' : 'Status'}</dt><dd class="col-span-2 text-ink-900">{previewDataset.status}</dd>
    </dl>
  {/if}
  <svelte:fragment slot="footer">
    <button type="button" on:click={() => (showPreviewModal = false)} class="w-full rounded-lg bg-ink-100 px-4 py-2 text-sm text-ink-700 hover:bg-ink-200">Close</button>
  </svelte:fragment>
</Modal>

{#if showRadioConfigModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" on:click|self={() => showRadioConfigModal = false}>
    <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
      <div class="p-6 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Radio Stream Configuration</h3>
            <p class="text-sm text-gray-500 mt-1">Configure radio stations to record and transcribe</p>
          </div>
          <div class="flex items-center space-x-2">
            {#if wavePulseStatus.status === 'running'}
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Recording</span>
            {:else if wavePulseStatus.status === 'offline'}
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Service Offline</span>
            {:else}
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{wavePulseStatus.status}</span>
            {/if}
          </div>
        </div>
      </div>

      <div class="p-6 space-y-6">
        <!-- Radio Streams -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <label class="text-sm font-medium text-gray-700">Radio Stations</label>
            <button on:click={addRadioStream} class="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add Station</button>
          </div>
          {#each radioConfig.radioStreams as stream, i}
            <div class="border border-gray-200 rounded-lg p-4 mb-3">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-gray-600">Station {i + 1}</span>
                {#if radioConfig.radioStreams.length > 1}
                  <button on:click={() => removeRadioStream(i)} class="text-sm text-red-500 hover:text-red-700">Remove</button>
                {/if}
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div class="col-span-2">
                  <label class="block text-xs text-gray-500 mb-1">Stream URL</label>
                  <input bind:value={stream.url} type="text" placeholder="https://..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Station Name</label>
                  <input bind:value={stream.radioName} type="text" placeholder="WGSV" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
              <div class="grid grid-cols-3 gap-3 mt-2">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">State</label>
                  <input bind:value={stream.state} type="text" placeholder="VA" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Record From</label>
                  <input bind:value={stream.timeSlots[0].start} type="time" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Record Until</label>
                  <input bind:value={stream.timeSlots[0].end} type="time" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Transcription Settings -->
        <div>
          <label class="text-sm font-medium text-gray-700 mb-3 block">Transcription Settings</label>
          <div class="grid grid-cols-2 gap-4">
            <label class="flex items-center space-x-2">
              <input type="checkbox" bind:checked={radioConfig.enableTranscription} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span class="text-sm text-gray-700">Enable Transcription</span>
            </label>
            <label class="flex items-center space-x-2">
              <input type="checkbox" bind:checked={radioConfig.enableClassification} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span class="text-sm text-gray-700">Enable Classification</span>
            </label>
          </div>
        </div>

        <!-- API Keys (optional) -->
        <div>
          <label class="text-sm font-medium text-gray-700 mb-3 block">API Keys (Optional)</label>
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">HuggingFace Token (for speaker diarization)</label>
              <input bind:value={radioConfig.huggingFaceToken} type="password" placeholder="hf_..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Gemini API Key (for content classification)</label>
              <input bind:value={radioConfig.geminiApiKey} type="password" placeholder="AI..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
        </div>

        <!-- Status Info -->
        {#if wavePulseStatus.status === 'running'}
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center">
              <div class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              <span class="text-sm font-medium text-green-800">Recording Active</span>
            </div>
            <div class="mt-2 text-sm text-green-700">
              <p>Streams: {wavePulseStatus.active_streams?.length || 0}</p>
              <p>Recordings: {wavePulseStatus.recordings_count || 0}</p>
              <p>Transcripts: {wavePulseStatus.transcripts_count || 0}</p>
            </div>
          </div>
        {:else if wavePulseStatus.status === 'offline'}
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
            Radio service is starting up. This may take a moment on first launch.
          </div>
        {:else if wavePulseStatus.status === 'idle'}
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            Radio service is ready. Configure your stations above and click Start Recording.
          </div>
        {/if}
      </div>

      <div class="p-6 border-t border-gray-200 flex justify-between">
        <button on:click={() => showRadioConfigModal = false} class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
          Cancel
        </button>
        <div class="flex space-x-3">
          {#if wavePulseStatus.status === 'running'}
            <button on:click={stopRadioRecording} class="px-4 py-2 text-sm text-red-700 bg-red-100 hover:bg-red-200 rounded-lg font-medium">
              Stop Recording
            </button>
          {:else}
            <button on:click={startRadioRecording}
              class="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
              {wavePulseStatus.status === 'offline' ? 'Start Recording (service starting...)' : 'Start Recording'}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showCrawlerModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" on:click|self={() => showCrawlerModal = false}>
    <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">Start Crawl Job</h3>
        <p class="text-sm text-gray-500 mt-1">Configure and launch a social media crawl</p>
      </div>

      <div class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Platform</label>
          <select bind:value={crawlerConfig.platform} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="bluesky">Bluesky</option>
            <option value="youtube">YouTube</option>
            <option value="telegram">Telegram</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {crawlerConfig.platform === 'bluesky' ? 'Handles or DIDs' : crawlerConfig.platform === 'youtube' ? 'Channel URLs' : 'Channel Names'}
          </label>
          <textarea bind:value={crawlerConfig.urls} rows="3" placeholder="One per line or comma-separated"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
          <p class="text-xs text-gray-400 mt-1">
            {crawlerConfig.platform === 'bluesky' ? 'e.g. user.bsky.social or "firehose" for full network' : crawlerConfig.platform === 'youtube' ? 'e.g. UCxxxxxxx or channel URLs' : 'e.g. @channelname'}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Max Posts</label>
            <input bind:value={crawlerConfig.maxPosts} type="number" min="10" max="100000"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
            <select bind:value={crawlerConfig.timeAgo} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="365d">Last year</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Crawl ID (optional)</label>
          <input bind:value={crawlerConfig.crawlId} type="text" placeholder="auto-generated if empty"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        {#if crawlerConfig.platform === 'youtube'}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">YouTube API Key</label>
            <input bind:value={crawlerConfig.youtubeApiKey} type="password" placeholder="AIza..."
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        {/if}

        <label class="flex items-center space-x-2">
          <input type="checkbox" bind:checked={crawlerConfig.skipMedia} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <span class="text-sm text-gray-700">Skip media downloads (faster)</span>
        </label>

        {#if crawlerStatus === 'scheduled'}
          <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            Crawl job scheduled successfully
          </div>
        {/if}
      </div>

      <div class="p-6 border-t border-gray-200 flex justify-between">
        <button on:click={() => showCrawlerModal = false} class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
          Cancel
        </button>
        <button on:click={startCrawl} disabled={crawlerStatus === 'starting'}
          class="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50">
          {crawlerStatus === 'starting' ? 'Scheduling...' : 'Start Crawl'}
        </button>
      </div>
    </div>
  </div>
{/if}

</div>