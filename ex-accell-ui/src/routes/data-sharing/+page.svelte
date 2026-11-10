<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert, Modal } from '$lib/components/ui';
  import { formatNumber, formatDate } from '$lib/utils/formatUtils';
  import { packageIdFor } from '$lib/utils/packageId';

  let loading = true;
  let errorMessage = '';
  let successMessage = '';
  let datasets: any[] = [];
  let packages: any[] = [];
  let generatingFor: string | null = null;
  let showPreviewModal = false;
  let previewPackage: any = null;
  let previewData: any[] = [];

  // IPFS state. Sharing is opt-in (IPFS_ENABLED=true on the server); until the status is known nothing is offered.
  let ipfsEnabled = false;
  let publishingFor: string | null = null;
  let confirmPublishFor: any = null;
  let ipfsRegistry: Map<string, any> = new Map();
  let importCid = '';
  let importing = false;

  // Generating, publishing and importing are admin-only on the server; the page only offers what the person may do
  $: isAdmin = ($page.data.user as { role?: string } | null | undefined)?.role === 'admin';

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    try {
      loading = true;

      // Is peer-to-peer sharing turned on for this server?
      try {
        const statusResponse = await fetch('/api/data-sharing?action=status');
        const statusResult = await statusResponse.json();
        ipfsEnabled = statusResult.success && statusResult.data?.enabled === true;
      } catch {
        ipfsEnabled = false;
      }

      // Load available datasets from catalog
      const dsResponse = await fetch('/api/datasets?status=available');
      const dsResult = await dsResponse.json();
      if (dsResult.success) {
        datasets = dsResult.datasets || [];
      }

      // Load existing shared packages
      const pkgResponse = await fetch('/api/data-sharing?action=list');
      const pkgResult = await pkgResponse.json();
      if (pkgResult.success) {
        packages = pkgResult.packages || [];
      }

      // Load the registry of packages already published (they stay public even if sharing is turned off later)
      try {
        const regResponse = await fetch('/api/data-sharing?action=registry');
        const regResult = await regResponse.json();
        if (regResult.success) {
          ipfsRegistry = new Map((regResult.packages || []).map((p: any) => [p.package_id, p]));
        }
      } catch { /* the registry is optional */ }

      loading = false;
    } catch (error) {
      console.error('Error loading data sharing:', error);
      errorMessage = 'Failed to load data.';
      loading = false;
    }
  }

  function getIpfsInfo(pkgId: string) {
    return ipfsRegistry.get(pkgId);
  }

  async function generatePackage(dataset: any) {
    try {
      generatingFor = dataset.id;
      errorMessage = '';

      const response = await fetch('/api/data-sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: dataset.id,
          preview_rows: 100
        })
      });

      const result = await response.json();
      if (result.success) {
        await loadData(); // Refresh
      } else {
        errorMessage = result.error || 'Failed to generate package';
      }
    } catch (error) {
      errorMessage = 'Failed to generate data package';
    } finally {
      generatingFor = null;
    }
  }

  async function viewPackage(pkg: any) {
    try {
      const response = await fetch(`/api/data-sharing?action=get&id=${pkg.id}`);
      const result = await response.json();
      if (result.success) {
        previewPackage = result.datapackage;
        previewData = result.preview || [];
        showPreviewModal = true;
      }
    } catch (error) {
      errorMessage = 'Failed to load package preview';
    }
  }

  function copyShareLink(pkg: any) {
    const link = `${window.location.origin}/api/data-sharing?action=get&id=${pkg.id}`;
    navigator.clipboard.writeText(link);
  }

  /** Publishing is irreversible, so the person confirms first. */
  function askToPublish(pkg: any) {
    confirmPublishFor = pkg;
  }

  async function publishToIpfs(pkg: any) {
    confirmPublishFor = null;
    publishingFor = pkg.id;
    errorMessage = '';
    successMessage = '';
    try {
      const response = await fetch('/api/data-sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', package_id: pkg.id })
      });
      const result = await response.json();
      if (result.success) {
        successMessage = `Published to IPFS! CID: ${result.cid}`;
        await loadData();
      } else {
        errorMessage = result.error || 'Failed to publish to IPFS';
      }
    } catch (err: any) {
      errorMessage = `IPFS publish failed: ${err.message}`;
    } finally {
      publishingFor = null;
    }
  }

  function copyIpfsLink(ipfs: { cid: string; gateway_url?: string }) {
    navigator.clipboard.writeText(ipfs.gateway_url || `https://ipfs.io/ipfs/${ipfs.cid}`);
    successMessage = 'IPFS gateway URL copied!';
    setTimeout(() => successMessage = '', 3000);
  }

  function copyCid(cid: string) {
    navigator.clipboard.writeText(cid);
    successMessage = 'CID copied!';
    setTimeout(() => successMessage = '', 3000);
  }

  async function importFromIpfs() {
    if (!importCid.trim()) return;
    importing = true;
    errorMessage = '';
    successMessage = '';
    try {
      const response = await fetch('/api/data-sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', cid: importCid.trim() })
      });
      const result = await response.json();
      if (result.success) {
        successMessage = `Imported ${result.row_count.toLocaleString()} rows from IPFS as "${result.table_name}"`;
        importCid = '';
        await loadData();
      } else {
        errorMessage = result.error || 'Failed to import from IPFS';
      }
    } catch (err: any) {
      errorMessage = `IPFS import failed: ${err.message}`;
    } finally {
      importing = false;
    }
  }
</script>

<svelte:head>
  <title>Data Sharing - Social Explorer</title>
  <meta name="description" content="Share datasets and workspaces with other people." />
</svelte:head>

<PageHeader
  title="Data Sharing"
  subtitle="Share datasets using Frictionless Data standards"
/>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}
  {#if successMessage}
    <div class="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
      <div class="flex items-center">
        <svg class="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span class="text-sm text-green-800">{successMessage}</span>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  {:else}

  {#if !ipfsEnabled}
    <div class="bg-ink-50 border border-ink-200 rounded-xl p-5 mb-8" role="status" data-testid="ipfs-disabled">
      <h2 class="text-base font-semibold text-ink-900">Peer-to-peer sharing is turned off</h2>
      <p class="text-sm text-ink-700 mt-2">
        This server is not connected to the IPFS network, so packages cannot be published or imported. That is the default:
        anything published to IPFS becomes public and cannot be taken back, so an administrator turns it on deliberately
        by setting <code class="font-mono text-xs bg-white border border-ink-200 rounded px-1 py-0.5">IPFS_ENABLED=true</code>
        and restarting the app.
      </p>
      <p class="text-sm text-ink-700 mt-2">
        You can still generate Frictionless Data Packages here and share them with people who have an account on this server.
        See the <a href="https://spiculedata.github.io/social-explorer/guide/data-sharing" class="text-primary-700 underline" target="_blank" rel="noopener">data sharing guide</a> for how it works and what to consider before turning it on.
      </p>
    </div>
  {:else if !isAdmin}
    <div class="bg-ink-50 border border-ink-200 rounded-xl p-4 mb-8 text-sm text-ink-700" role="status">
      Only administrators can generate, publish or import packages. You can preview the packages below and copy their links.
    </div>
  {/if}

  <!-- Shared Packages -->
  <div class="mb-8">
    <h2 class="text-xl font-semibold text-gray-900 mb-4">Shared Data Packages</h2>

    {#if packages.length === 0}
      <div class="bg-white rounded-xl shadow-sm p-8 text-center">
        <div class="text-4xl mb-3">📦</div>
        <h3 class="text-lg font-medium text-gray-900 mb-1">No packages shared yet</h3>
        <p class="text-sm text-gray-500">Generate a data package from one of your datasets below to start sharing.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each packages as pkg}
          {@const ipfs = getIpfsInfo(pkg.id)}
          <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200 hover:border-purple-300 transition-colors">
            <div class="flex items-start justify-between mb-3">
              <div>
                <h3 class="text-sm font-semibold text-gray-900">{pkg.title || pkg.name}</h3>
                <p class="text-xs text-gray-500 mt-1">{formatNumber(pkg.totalRows)} records, {pkg.previewRows} preview</p>
              </div>
              <div class="flex items-center gap-1.5">
                {#if ipfs}
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    IPFS
                  </span>
                {/if}
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Ready
                </span>
              </div>
            </div>
            <p class="text-xs text-gray-500 mb-3 line-clamp-2">{pkg.description || ''}</p>

            {#if ipfs}
              <div class="bg-indigo-50 rounded-lg p-2.5 mb-3 border border-indigo-100">
                <div class="flex items-center justify-between">
                  <div class="min-w-0 flex-1 mr-2">
                    <div class="text-xs font-medium text-indigo-700">IPFS CID</div>
                    <div class="text-xs text-indigo-600 font-mono truncate" title={ipfs.cid}>{ipfs.cid}</div>
                  </div>
                  <div class="flex items-center gap-1">
                    <button on:click={() => copyCid(ipfs.cid)} class="p-1 text-indigo-500 hover:text-indigo-700 rounded" title="Copy CID">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                      </svg>
                    </button>
                    <button on:click={() => copyIpfsLink(ipfs)} class="p-1 text-indigo-500 hover:text-indigo-700 rounded" title="Copy gateway URL">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            <div class="flex items-center space-x-2">
              <button on:click={() => viewPackage(pkg)} class="text-xs text-purple-600 hover:text-purple-800 font-medium">Preview</button>
              <span class="text-gray-300">|</span>
              <button on:click={() => copyShareLink(pkg)} class="text-xs text-blue-600 hover:text-blue-800 font-medium">Copy Link</button>
              {#if !ipfs && pkg.publishable && ipfsEnabled && isAdmin}
                <span class="text-gray-300">|</span>
                <button
                  on:click={() => askToPublish(pkg)}
                  disabled={publishingFor === pkg.id}
                  class="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                >
                  {publishingFor === pkg.id ? 'Publishing...' : 'Publish to IPFS'}
                </button>
              {/if}
            </div>
            <div class="text-xs text-gray-500 mt-2">Created {formatDate(pkg.created)}</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Import from IPFS -->
  {#if ipfsEnabled && isAdmin}
  <div class="mb-8">
    <h2 class="text-xl font-semibold text-gray-900 mb-4">Import from IPFS</h2>
    <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
      <p class="text-sm text-gray-600 mb-4">Paste an IPFS CID to import a Frictionless Data Package shared by another user or organization. The package comes from the public network: only import CIDs from people you trust.</p>
      <div class="flex gap-3">
        <input
          type="text"
          bind:value={importCid}
          placeholder="Enter IPFS CID (e.g. bafybeig6xv5nwph...)"
          disabled={importing}
          class="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono disabled:opacity-50"
        />
        <button
          on:click={importFromIpfs}
          disabled={importing || !importCid.trim()}
          class="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {#if importing}
            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Fetching...
          {:else}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
            Fetch & Import
          {/if}
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-2">The CID will be resolved from the IPFS network. This may take a moment for the first fetch.</p>
    </div>
  </div>
  {/if}

  <!-- Available Datasets to Share -->
  <div>
    <h2 class="text-xl font-semibold text-gray-900 mb-4">Available Datasets</h2>
    <p class="text-sm text-gray-500 mb-4">Select a dataset to generate a Frictionless Data Package with schema and preview data.</p>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dataset</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Records</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each datasets.filter(d => d.table_name) as dataset}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3">
                <div class="text-sm font-medium text-gray-900">{dataset.name}</div>
                <div class="text-xs text-gray-500">{dataset.table_name}</div>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  {dataset.dataset_type}
                </span>
              </td>
              <td class="px-4 py-3 text-right text-sm">{formatNumber(parseInt(dataset.record_count) || 0)}</td>
              <td class="px-4 py-3 text-right">
                {#if packages.some(p => p.id === packageIdFor(dataset.name, dataset.id))}
                  <span class="text-xs text-green-600 font-medium">Shared</span>
                {:else if !isAdmin}
                  <span class="text-xs text-ink-500">Admins only</span>
                {:else}
                  <button
                    on:click={() => generatePackage(dataset)}
                    disabled={generatingFor === dataset.id}
                    class="px-3 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors disabled:opacity-50">
                    {generatingFor === dataset.id ? 'Generating...' : 'Generate Package'}
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  {/if}
</div>

<!-- Publish confirmation: the data leaves this server for good -->
<Modal
  open={confirmPublishFor !== null}
  title="Publish to the public IPFS network?"
  description={confirmPublishFor ? `"${confirmPublishFor.title || confirmPublishFor.name}" (${formatNumber(confirmPublishFor.totalRows)} records) will be exported in full and published.` : ''}
  onclose={() => (confirmPublishFor = null)}
>
  <div class="bg-danger-50 border border-danger-200 rounded-lg p-4 text-sm text-danger-900 space-y-2">
    <p class="font-semibold">This cannot be undone.</p>
    <p>
      Anyone with the content identifier (CID) can download the whole dataset from any IPFS node or gateway, with no
      sign-in. Copies may be kept by other nodes indefinitely, so the data cannot be withdrawn later.
    </p>
    <p>Check first that the data holds no personal information you may not share and that its licence allows publication.</p>
  </div>
  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-2">
      <button type="button" on:click={() => (confirmPublishFor = null)} class="px-4 py-2 text-sm text-ink-700 bg-ink-100 hover:bg-ink-200 rounded-lg" data-autofocus>
        Cancel
      </button>
      <button type="button" on:click={() => publishToIpfs(confirmPublishFor)} class="px-4 py-2 text-sm font-medium text-white bg-danger-600 hover:bg-danger-700 rounded-lg">
        Publish publicly
      </button>
    </div>
  </svelte:fragment>
</Modal>

<!-- Preview Modal -->
{#if showPreviewModal && previewPackage}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" on:click|self={() => showPreviewModal = false}>
    <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[85vh] overflow-y-auto">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">{previewPackage.title}</h3>
        <p class="text-sm text-gray-500 mt-1">{previewPackage.description}</p>
        <div class="flex items-center space-x-4 mt-2 text-xs text-gray-500">
          <span>v{previewPackage.version}</span>
          <span>{previewPackage.resources?.length || 0} resources</span>
          <span>Created {formatDate(previewPackage.created)}</span>
        </div>
      </div>

      <!-- Schema -->
      <div class="p-6 border-b border-gray-200">
        <h4 class="text-sm font-medium text-gray-700 mb-2">Schema ({previewPackage.resources?.[0]?.schema?.fields?.length || 0} fields)</h4>
        <div class="flex flex-wrap gap-2">
          {#each (previewPackage.resources?.[0]?.schema?.fields || []) as field}
            <span class="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100">
              <span class="font-medium text-gray-900">{field.name}</span>
              <span class="text-gray-500 ml-1">({field.type})</span>
            </span>
          {/each}
        </div>
      </div>

      <!-- Preview Data -->
      {#if previewData.length > 0}
        <div class="p-6">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Preview Data ({previewData.length} rows)</h4>
          <div class="overflow-x-auto">
            <table class="min-w-full text-xs">
              <thead class="bg-gray-50">
                <tr>
                  {#each Object.keys(previewData[0]).slice(0, 8) as key}
                    <th class="px-2 py-1 text-left font-medium text-gray-500">{key}</th>
                  {/each}
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each previewData.slice(0, 10) as row}
                  <tr>
                    {#each Object.keys(row).slice(0, 8) as key}
                      <td class="px-2 py-1 text-gray-700 truncate max-w-32">{row[key]}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <div class="p-6 border-t border-gray-200 flex justify-between">
        <button on:click={() => showPreviewModal = false} class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
          Close
        </button>
        <button on:click={() => {
          const blob = new Blob([JSON.stringify(previewPackage, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'datapackage.json';
          a.click();
          URL.revokeObjectURL(url);
        }} class="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg font-medium">
          Download datapackage.json
        </button>
      </div>
    </div>
  </div>
{/if}
