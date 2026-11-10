<script lang="ts">
  import { page } from '$app/stores';
  import DataUnavailable from '$lib/components/ui/DataUnavailable.svelte';
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';
  import ModelTierSelector from '$lib/components/ui/ModelTierSelector.svelte';

  let selectedTier = 'fast';
  let loading = true;
  let errorMessage = '';
  let unavailable = false;
  let stats: { topClasses: any[]; cooccurrence: any[] } = { topClasses: [], cooccurrence: [] };
  let results: any[] = [];
  let imageUrl = '';
  let analyzing = false;
  let singleResult: any = null;
  let selectedImage: any = null; // For detail view with bounding boxes

  let classesChart: any = null;
  let currentPage = 0;
  const pageSize = 10;

  $: totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  $: pagedResults = results.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  async function loadData() {
    loading = true;
    errorMessage = '';
    try {
      const [statsRes, resultsRes] = await Promise.all([
        fetch('/api/image-processing?action=object-stats'),
        fetch('/api/image-processing?action=object-results&limit=20')
      ]);

      const statsData = await statsRes.json();

      unavailable = !!statsData.meta?.unavailable;
      const resultsData = await resultsRes.json();

      if (statsData.success && statsData.data) {
        stats = {
          topClasses: statsData.data.topClasses || [],
          cooccurrence: statsData.data.cooccurrence || []
        };
      } else {
        errorMessage = statsData.error || 'Failed to load object detection stats';
      }

      if (resultsData.success) {
        results = Array.isArray(resultsData.data) ? resultsData.data : resultsData.data?.results || [];
      }
    } catch (err: any) {
      errorMessage = err.message;
    } finally {
      loading = false;
      await initCharts();
    }
  }

  async function analyzeImage() {
    if (!imageUrl.trim()) return;
    analyzing = true;
    singleResult = null;
    errorMessage = '';
    try {
      const res = await fetch('/api/image-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', image_url: imageUrl, tier: selectedTier })
      });
      const data = await res.json();
      if (data.success && data.data) {
        singleResult = data.data;
      } else {
        errorMessage = data.error || 'Failed to analyze image';
      }
    } catch (err: any) {
      errorMessage = err.message;
    } finally {
      analyzing = false;
    }
  }

  async function initCharts() {
    if (stats.topClasses.length === 0) return;
    await waitForEcharts();

    const container = document.getElementById('classes-chart');
    if (!container) return;
    classesChart = initChart(container);
    if (!classesChart) return;

    const top15 = stats.topClasses.slice(0, 15);
    classesChart.setOption({
      title: { text: 'Top 15 Object Classes', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 10, right: 50, top: 40, bottom: 20, containLabel: true },
      xAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      yAxis: {
        type: 'category',
        data: top15.map((c: any) => c.object_class || c.className || c.name || '?').reverse(),
        axisLabel: { fontSize: 11 },
        axisTick: { show: false },
        axisLine: { show: false }
      },
      series: [{
        type: 'bar',
        data: top15.map((c: any) => parseInt(c.count || c.frequency)).reverse(),
        itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', fontSize: 10, color: '#666' }
      }]
    });
  }

  function truncateUrl(url: string, maxLen: number = 50): string {
    if (!url) return '';
    return url.length > maxLen ? url.slice(0, maxLen) + '...' : url;
  }

  onMount(() => { loadData(); });
</script>

<svelte:head>
  <title>Object Detection - Social Explorer</title>
  <meta name="description" content="YOLOv8 powered object detection and identification" />
</svelte:head>

<PageHeader
  title="Object Detection"
  subtitle="YOLOv8 powered object identification"
  accentColor="blue"
/>

<div class="max-w-7xl xl:max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}
  {#if unavailable}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <DataUnavailable
        title="No images have been analysed yet"
        description="This page fills in once images have been processed. You can try the analysis on a single image below." />
    </div>
  {/if}

  <!-- Analyze Panel -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Analyze an Image</h2>
    <div class="flex flex-col sm:flex-row gap-3">
      <input
        type="text"
        bind:value={imageUrl}
        placeholder="Enter image URL to detect objects..."
        class="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        on:keydown={(e) => e.key === 'Enter' && analyzeImage()}
      />
      </div>
      <div class="mb-3">
        <ModelTierSelector tool="objects" bind:selectedTier disabled={analyzing} />
      <button
        on:click={analyzeImage}
        disabled={analyzing || !imageUrl.trim()}
        class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
      >
        {#if analyzing}
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          Detecting...
        {:else}
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
          </svg>
          Detect Objects
        {/if}
      </button>
    </div>

    {#if singleResult}
      {@const analysis = singleResult.analysis || singleResult}
      <div class="mt-5 border border-blue-100 bg-blue-50 rounded-lg p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-blue-900">Detection Results</h3>
          {#if analysis.status === 'queued'}
            <span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Queued for batch processing</span>
          {/if}
        </div>
        {#if analysis.description}
          <p class="text-sm text-gray-700 mb-3">{analysis.description}</p>
        {/if}
        {#if analysis._note}
          <p class="text-xs text-blue-600 mb-3 bg-blue-100 rounded p-2">{analysis._note}</p>
        {/if}
        {#if analysis.tags && analysis.tags.length > 0}
          <div class="mb-3">
            <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</span>
            <div class="flex flex-wrap gap-1.5 mt-1">
              {#each analysis.tags as tag}
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{tag}</span>
              {/each}
            </div>
          </div>
        {/if}
        {#if analysis.objects && analysis.objects.length > 0}
          <div>
            <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">Objects Detected</span>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
              {#each analysis.objects as obj}
                <div class="bg-white rounded-lg px-3 py-2 border border-blue-200 text-sm">
                  <span class="font-medium text-gray-900">{typeof obj === 'string' ? obj : obj.label || obj.name}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center space-y-4">
        <div class="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
        <p class="text-gray-500 text-sm">Loading object detection data...</p>
      </div>
    </div>
  {:else}
    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Objects Detected</p>
        <p class="text-2xl font-bold text-gray-900">{formatNumber(stats.topClasses.reduce((sum, c) => sum + parseInt(c.count || c.frequency || 0), 0))}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Unique Object Classes</p>
        <p class="text-2xl font-bold text-gray-900">{formatNumber(stats.topClasses.length)}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Images with Objects</p>
        <p class="text-2xl font-bold text-gray-900">{formatNumber(results.length)}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Avg Objects / Image</p>
        <p class="text-2xl font-bold text-gray-900">
          {results.length > 0 ? (stats.topClasses.reduce((sum, c) => sum + parseInt(c.count || 0), 0) / results.length).toFixed(1) : '0'}
        </p>
      </div>
    </div>

    <!-- Chart and Co-occurrence -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Top Classes Chart -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 class="text-sm font-semibold text-gray-900 mb-3">Top Object Classes</h3>
        {#if stats.topClasses.length > 0}
          <div id="classes-chart" class="w-full h-96"></div>
        {:else}
          <div class="flex items-center justify-center h-96 text-gray-500 text-sm">
            No object class data available
          </div>
        {/if}
      </div>

      <!-- Co-occurrence Table -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 class="text-sm font-semibold text-gray-900 mb-3">Object Co-occurrence</h3>
        {#if stats.cooccurrence.length > 0}
          <div class="overflow-auto max-h-96">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200">
                  <th class="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Object A</th>
                  <th class="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Object B</th>
                  <th class="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Co-occurrences</th>
                </tr>
              </thead>
              <tbody>
                {#each stats.cooccurrence as pair, i}
                  <tr class="border-b border-gray-100 {i % 2 === 0 ? 'bg-gray-50' : ''}">
                    <td class="py-2 px-3 text-gray-900 font-medium">{pair.class1 || pair.objectA}</td>
                    <td class="py-2 px-3 text-gray-900 font-medium">{pair.class2 || pair.objectB}</td>
                    <td class="py-2 px-3 text-right text-gray-600">{formatNumber(parseInt(pair.co_count || pair.count || 0))}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="flex items-center justify-center h-96 text-gray-500 text-sm">
            No co-occurrence data available
          </div>
        {/if}
      </div>
    </div>

    <!-- Results Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-gray-900">Analyzed Images</h3>
        {#if results.length > 0}
          <span class="text-xs text-gray-500">{results.length} image{results.length !== 1 ? 's' : ''}</span>
        {/if}
      </div>

      {#if results.length > 0}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                <th class="text-center py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Objects</th>
                <th class="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Detected Classes</th>
                <th class="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Analyzed</th>
              </tr>
            </thead>
            <tbody>
              {#each pagedResults as result, i}
                {@const objects = Array.isArray(result.objects) ? result.objects : []}
                <tr
                  class="border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer {i % 2 === 0 ? 'bg-gray-50/50' : ''}"
                  on:click={() => selectedImage = result}
                >
                  <td class="py-2 px-3">
                    <div class="flex items-center gap-3">
                      <img src={result.image_url} alt="" class="w-12 h-9 rounded object-cover bg-gray-100 flex-shrink-0" on:error={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <span class="text-xs text-gray-500 font-mono truncate max-w-40" title={result.image_url}>
                        {result.image_url?.split('/').pop() || '—'}
                      </span>
                    </div>
                  </td>
                  <td class="py-2 px-3 text-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {result.object_count || objects.length}
                    </span>
                  </td>
                  <td class="py-2 px-3">
                    <div class="flex flex-wrap gap-1">
                      {#each objects.slice(0, 5) as obj}
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                          {obj.class || obj.label || obj.name}
                          <span class="ml-1 text-gray-500">{Math.round((obj.confidence || 0) * 100)}%</span>
                        </span>
                      {/each}
                      {#if objects.length > 5}
                        <span class="text-xs text-gray-500">+{objects.length - 5} more</span>
                      {/if}
                    </div>
                  </td>
                  <td class="py-2 px-3 text-right text-gray-500 text-xs whitespace-nowrap">
                    {result.analyzed_at ? new Date(result.analyzed_at).toLocaleDateString() : '-'}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        {#if totalPages > 1}
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <button
              on:click={() => currentPage = Math.max(0, currentPage - 1)}
              disabled={currentPage === 0}
              class="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Previous
            </button>
            <span class="text-sm text-gray-500">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              on:click={() => currentPage = Math.min(totalPages - 1, currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              class="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        {/if}
      {:else}
        <div class="flex flex-col items-center justify-center py-16 text-gray-500">
          <svg class="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p class="text-sm font-medium">No analyzed images yet</p>
          <p class="text-xs mt-1">Use the panel above to analyze an image, or check back after processing.</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Detail Modal with Bounding Box Overlay -->
{#if selectedImage}
  {@const objects = Array.isArray(selectedImage.objects) ? selectedImage.objects : []}
  <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" on:click|self={() => selectedImage = null}>
    <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Object Detection Results</h3>
          <p class="text-xs text-gray-500 mt-1">{objects.length} object{objects.length !== 1 ? 's' : ''} detected</p>
        </div>
        <button on:click={() => selectedImage = null} class="text-gray-500 hover:text-gray-600 p-1">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="p-5">
        <!-- Image with bounding boxes -->
        <div class="relative inline-block w-full mb-4">
          <img
            src={selectedImage.image_url}
            alt="Analyzed image"
            class="w-full rounded-lg"
            on:error={(e) => { e.currentTarget.alt = 'Image could not be loaded'; }}
          />
          <!-- Bounding box overlays -->
          {#each objects as obj, i}
            {@const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']}
            {@const color = colors[i % colors.length]}
            {@const bbox = obj.bbox || []}
            {#if bbox.length === 4}
              <!-- bbox is normalized [cx, cy, w, h] — convert to left/top/width/height percentages -->
              <div
                class="absolute border-2 rounded-sm pointer-events-none"
                style="
                  left: {(bbox[0] - bbox[2] / 2) * 100}%;
                  top: {(bbox[1] - bbox[3] / 2) * 100}%;
                  width: {bbox[2] * 100}%;
                  height: {bbox[3] * 100}%;
                  border-color: {color};
                "
              >
                <span
                  class="absolute -top-5 left-0 text-xs font-bold px-1.5 py-0.5 rounded-t whitespace-nowrap"
                  style="background-color: {color}; color: white;"
                >
                  {obj.class} {Math.round((obj.confidence || 0) * 100)}%
                </span>
              </div>
            {/if}
          {/each}
        </div>

        <!-- Object list -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          {#each objects as obj, i}
            {@const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']}
            <div class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
              <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: {colors[i % colors.length]}"></div>
              <span class="text-sm font-medium text-gray-900">{obj.class}</span>
              <span class="text-xs text-gray-500 ml-auto">{Math.round((obj.confidence || 0) * 100)}%</span>
            </div>
          {/each}
        </div>

        {#if objects.length === 0}
          <p class="text-sm text-gray-500 text-center py-4">No objects were detected in this image.</p>
        {/if}
      </div>

      <div class="p-4 border-t border-gray-200 flex justify-between items-center">
        <span class="text-xs text-gray-500">Analyzed {selectedImage.analyzed_at ? new Date(selectedImage.analyzed_at).toLocaleString() : '—'}</span>
        <button on:click={() => selectedImage = null} class="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">Close</button>
      </div>
    </div>
  </div>
{/if}
