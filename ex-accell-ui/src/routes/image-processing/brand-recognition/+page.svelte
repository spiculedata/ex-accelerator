<script lang="ts">
  import { onMount } from 'svelte';
  import DataUnavailable from '$lib/components/ui/DataUnavailable.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';

  let loading = true;
  let errorMessage = '';
  let unavailable = false;
  let brandStats: any[] = [];
  let brandChart: any = null;
  let imageUrl = '';
  let analyzing = false;
  let singleResult: any = null;

  async function loadData() {
    loading = true;
    try {
      const res = await fetch('/api/image-processing?action=brand-stats&limit=20');
      const data = await res.json();
      unavailable = !!data.meta?.unavailable;
      if (data.success) brandStats = data.data || [];
    } catch (err: any) { errorMessage = err.message; }
    finally { loading = false; await initCharts(); }
  }

  async function analyzeImage() {
    if (!imageUrl.trim()) return;
    analyzing = true;
    singleResult = null;
    try {
      const res = await fetch('/api/image-processing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', image_url: imageUrl.trim() })
      });
      const data = await res.json();
      if (data.success) singleResult = data.data;
      else errorMessage = data.error;
    } catch (err: any) { errorMessage = err.message; }
    finally { analyzing = false; }
  }

  async function initCharts() {
    if (brandStats.length === 0) return;
    await waitForEcharts();
    const container = document.getElementById('brand-chart');
    if (!container) return;
    brandChart = initChart(container);
    brandChart?.setOption({
      title: { text: 'Top Detected Brands', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 10, right: 40, top: 40, bottom: 20, containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: brandStats.map((b: any) => b.brand_name).reverse(), axisLabel: { fontSize: 11 } },
      series: [{ type: 'bar', data: brandStats.map((b: any) => parseInt(b.count)).reverse(), itemStyle: { color: '#f59e0b', borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', fontSize: 10 } }]
    });
  }

  onMount(loadData);
</script>

<svelte:head>
  <title>Brand Recognition - Social Explorer</title>
  <meta name="description" content="Find brands and logos in images." />
</svelte:head>

<PageHeader title="Brand Recognition" subtitle="Detect logos and brand placements in visual content" accentColor="amber" />

<div class="max-w-7xl xl:max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}
  {#if unavailable}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <DataUnavailable
        title="No images have been analysed yet"
        description="This page fills in once images have been processed. You can try the analysis on a single image below." />
    </div>
  {/if}

  <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
    <div class="flex items-center">
      <svg class="w-5 h-5 text-signal-700 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <div>
        <p class="text-sm font-medium text-amber-800">Stretch Goal</p>
        <p class="text-xs text-amber-700">Brand recognition uses CLIP zero-shot matching against a configurable brand library. Accuracy improves with fine-tuned logo detection models.</p>
      </div>
    </div>
  </div>

  <!-- Detect Panel -->
  <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Detect Brands</h2>
    <div class="flex gap-3 mb-4">
      <input type="text" bind:value={imageUrl} placeholder="Paste image URL with brand/logo..." disabled={analyzing}
        class="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:opacity-50" />
      <button on:click={analyzeImage} disabled={analyzing || !imageUrl.trim()}
        class="px-5 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 flex items-center gap-2">
        {#if analyzing}<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>Detecting...
        {:else}Detect Brands{/if}
      </button>
    </div>
    {#if singleResult?.analysis}
      <div class="bg-amber-50 rounded-lg p-4 border border-amber-200">
        <p class="text-sm text-gray-800">{singleResult.analysis.description || 'No brands detected'}</p>
        {#if singleResult.analysis.tags?.length > 0}
          <div class="flex flex-wrap gap-1.5 mt-2">
            {#each singleResult.analysis.tags as tag}
              <span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-medium">{tag}</span>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="animate-spin rounded-full h-10 w-10 border-4 border-amber-200 border-t-amber-600"></div>
    </div>
  {:else}
    <!-- Brand Chart -->
    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
      {#if brandStats.length > 0}
        <div id="brand-chart" class="w-full h-96"></div>
      {:else}
        <div class="flex items-center justify-center h-48 text-gray-500">
          <div class="text-center">
            <span class="text-4xl block mb-2">🏢</span>
            <p class="text-sm">No brand detections yet. Process images to detect brands and logos.</p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Brand Table -->
    {#if brandStats.length > 0}
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 class="text-lg font-semibold text-gray-900">Detected Brands</h2>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr class="text-left text-xs font-medium text-gray-500 uppercase">
              <th class="px-4 py-3">Brand</th>
              <th class="px-4 py-3 text-right">Detections</th>
              <th class="px-4 py-3 text-right">Avg Confidence</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each brandStats as brand}
              <tr class="hover:bg-amber-50/30">
                <td class="px-4 py-3 font-medium text-gray-900">{brand.brand_name}</td>
                <td class="px-4 py-3 text-right">{formatNumber(parseInt(brand.count))}</td>
                <td class="px-4 py-3 text-right">{((parseFloat(brand.avg_confidence) || 0) * 100).toFixed(1)}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>
