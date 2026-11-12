<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { currentProject, loadCurrentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import CrawlerModal from '$lib/components/data-management/CrawlerModal.svelte';
  import DataSourcesTab from '$lib/components/data-management/DataSourcesTab.svelte';
  import DatasetPreviewModal from '$lib/components/data-management/DatasetPreviewModal.svelte';
  import DatasetsTab from '$lib/components/data-management/DatasetsTab.svelte';
  import LinkDatasetModal from '$lib/components/data-management/LinkDatasetModal.svelte';
  import PipelineOverview from '$lib/components/data-management/PipelineOverview.svelte';
  import RadioConfigModal from '$lib/components/data-management/RadioConfigModal.svelte';
  import WorkflowsTab from '$lib/components/data-management/WorkflowsTab.svelte';
  import {
    fetchAvailableDatasets,
    fetchWavePulseStatus,
    fetchWorkflows,
    fetchWorkspaceDatasets,
    linkDatasetToWorkspace,
    scheduleCrawl,
    startWavePulse,
    stopWavePulse
  } from '$lib/services/dataManagementApi';
  import {
    EMPTY_DATA_STATS,
    buildCrawlRequest,
    buildDataSources,
    computeDataStats,
    defaultCrawlerConfig,
    defaultRadioConfig,
    parseCrawlerUrls,
    type DataRow,
    type DataSource,
    type WavePulseStatus
  } from '$lib/utils/dataManagement';
  import { unlinkedDatasets, type DatasetRow } from '$lib/utils/datasetRows';

  const WAVEPULSE_POLL_MS = 15000;
  const CRAWL_NOTICE_MS = 5000;

  $: workspaceId = $page.url.searchParams.get('workspace');

  let loading = true;
  let errorMessage = '';
  let dataSources: DataSource[] = [];
  let availableDatasets: DatasetRow[] = [];
  let allDatasets: DatasetRow[] = [];
  let workflows: DataRow[] = [];
  let dataStats = { ...EMPTY_DATA_STATS };

  let showAddSourceModal = false;
  // Linking a dataset: which one is in flight, a message for the modal, and a confirmation for the page
  let linkingId: number | null = null;
  let linkError = '';
  let linkNotice = '';
  let showPreviewModal = false;
  let showRadioConfigModal = false;
  let showCrawlerModal = false;
  let previewDataset: DataRow | null = null;

  // Crawler state
  let crawlerConfig = defaultCrawlerConfig();
  let crawlerStatus = '';

  // WavePulse radio state
  let wavePulseStatus: WavePulseStatus = { status: 'offline' };
  let radioConfig = defaultRadioConfig();

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
      const workspaceDatasets = await fetchWorkspaceDatasets(workspaceId);
      if (workspaceDatasets) availableDatasets = workspaceDatasets;

      // Load all available datasets (for the "add source" modal)
      const catalog = await fetchAvailableDatasets();
      if (catalog) allDatasets = catalog;

      // Load workflows
      const loadedWorkflows = await fetchWorkflows();
      if (loadedWorkflows) workflows = loadedWorkflows;

      dataSources = buildDataSources(availableDatasets, wavePulseStatus);
      dataStats = computeDataStats(dataSources, availableDatasets, workflows);

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

  async function handleLinkDataset(dataset: DatasetRow) {
    if (linkingId !== null) return;
    linkingId = dataset.id;
    linkError = '';
    try {
      const result = await linkDatasetToWorkspace(workspaceId, dataset.id);
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

  function handlePreviewDataset(dataset: DataRow) {
    previewDataset = dataset;
    showPreviewModal = true;
  }

  function handleConfigureSource(source: DataSource) {
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

  function createWorkflowFromDataset(dataset: DataRow) {
    goto(`/data-management/workflow-builder?dataset=${dataset.id}`);
  }

  function editWorkflow(workflow: DataRow) {
    goto(`/data-management/workflow-builder?workflow=${encodeURIComponent(workflow.id)}`);
  }

  // ─── WavePulse Radio Functions ───────────────────────────────────────────

  async function checkWavePulseStatus() {
    wavePulseStatus = await fetchWavePulseStatus();
  }

  async function startRadioRecording() {
    try {
      errorMessage = '';
      const result = await startWavePulse(radioConfig);
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
      await stopWavePulse();
      await checkWavePulseStatus();
    } catch {
      errorMessage = 'Failed to stop radio recording';
    }
  }

  // ─── Crawler Functions ────────────────────────────────────────────────

  async function startCrawl() {
    try {
      crawlerStatus = 'starting';
      const urls = parseCrawlerUrls(crawlerConfig.urls);
      if (urls.length === 0) {
        errorMessage = 'Please enter at least one URL or channel';
        crawlerStatus = '';
        return;
      }

      const result = await scheduleCrawl(buildCrawlRequest(crawlerConfig, urls));
      if (result.success) {
        crawlerStatus = 'scheduled';
        showCrawlerModal = false;
        setTimeout(() => { crawlerStatus = ''; }, CRAWL_NOTICE_MS);
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
    statusInterval = setInterval(checkWavePulseStatus, WAVEPULSE_POLL_MS);
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
    subtitle="Capture, process, and transform your social media data with unified workflows">
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

    <PipelineOverview
      sourceCount={dataSources.length}
      activeWorkflowCount={dataStats.activeWorkflows}
      totalRecords={dataStats.totalRecordsCapture}
      workflowCount={workflows.length}
      datasetCount={availableDatasets.length}
      bind:activeTab
      bind:linkNotice
    />

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
          <DataSourcesTab
            {dataSources}
            onLinkDataset={openAddSourceModal}
            onStartCrawl={() => showCrawlerModal = true}
            onConfigureSource={handleConfigureSource}
            onPreviewSource={handlePreviewDataset}
          />
        {:else if activeTab === 'datasets'}
          <DatasetsTab
            datasets={availableDatasets}
            onStartCrawl={() => showCrawlerModal = true}
            onProcessDataset={createWorkflowFromDataset}
            onPreviewDataset={handlePreviewDataset}
          />
        {:else if activeTab === 'workflows'}
          <WorkflowsTab
            {workflows}
            onNewWorkflow={() => goto('/data-management/workflow-builder')}
            onOpenInBuilder={editWorkflow}
          />
        {/if}
      </div>
    </div>

  {/if}
  </div>

<LinkDatasetModal
  open={showAddSourceModal}
  datasets={unlinkedDatasets(allDatasets, availableDatasets)}
  {linkingId}
  {linkError}
  onLink={handleLinkDataset}
  onClose={() => (showAddSourceModal = false)}
/>

<DatasetPreviewModal open={showPreviewModal} dataset={previewDataset} onClose={() => (showPreviewModal = false)} />

{#if showRadioConfigModal}
  <RadioConfigModal
    bind:radioConfig
    {wavePulseStatus}
    onStart={startRadioRecording}
    onStop={stopRadioRecording}
    onClose={() => showRadioConfigModal = false}
  />
{/if}

{#if showCrawlerModal}
  <CrawlerModal
    bind:crawlerConfig
    {crawlerStatus}
    onStart={startCrawl}
    onClose={() => showCrawlerModal = false}
  />
{/if}

</div>
