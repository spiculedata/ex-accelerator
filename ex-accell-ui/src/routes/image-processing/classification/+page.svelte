<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';

  let loading = true;
  let errorMessage = '';
  let classStats: any = { topTags: [], categories: [], treemap: [] };
  let results: any[] = [];
  let imageUrl = '';
  let analyzing = false;
  let singleResult: any = null;
  let tagChart: any = null;
  let categoryChart: any = null;
  let tagFilter = '';

  async function loadData() {
    loading = true;
    try {
      const [statsRes, resultsRes] = await Promise.all([
        fetch('/api/image-processing?action=classification-stats&limit=30'),
        fetch('/api/image-processing?action=classification-results&limit=20'),
      ]);
      const [statsData, resultsData] = await Promise.all([statsRes.json(), resultsRes.json()]);
      if (statsData.success) classStats = statsData.data;
      if (resultsData.success) results = resultsData.data || [];
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
    await waitForEcharts();

    // Tag frequency chart
    const tagContainer = document.getElementById('tag-chart');
    if (tagContainer && classStats.topTags?.length > 0) {
      tagChart = initChart(tagContainer);
      const top15 = classStats.topTags.slice(0, 15);
      tagChart?.setOption({
        title: { text: 'Top Tags', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 10, right: 40, top: 40, bottom: 20, containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: top15.map((t: any) => t.tag).reverse(), axisLabel: { fontSize: 10, width: 120, overflow: 'truncate' } },
        series: [{ type: 'bar', data: top15.map((t: any) => parseInt(t.count)).reverse(), itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', fontSize: 10 } }]
      });
    }

    // Category donut
    const catContainer = document.getElementById('category-chart');
    if (catContainer && classStats.categories?.length > 0) {
      categoryChart = initChart(catContainer);
      categoryChart?.setOption({
        title: { text: 'Categories', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        series: [{ type: 'pie', radius: ['35%', '65%'], data: classStats.categories.map((c: any) => ({ name: c.category || 'Uncategorized', value: parseInt(c.assignments) })), label: { show: true, fontSize: 10 } }]
      });
    }
  }

  onMount(loadData);
</script>

<svelte:head><title>Image Classification - Social Explorer</title></svelte:head>

<PageHeader title="Image Classification" subtitle="CLIP zero-shot classification with custom taxonomy" accentColor="purple" />

<div class="max-w-7xl xl:max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

  <!-- Classify Panel -->
  <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Classify Image</h2>
    <div class="flex gap-3 mb-4">
      <input type="text" bind:value={imageUrl} placeholder="Paste image URL..." disabled={analyzing}
        class="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:opacity-50" />
      <button on:click={analyzeImage} disabled={analyzing || !imageUrl.trim()}
        class="px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 flex items-center gap-2">
        {#if analyzing}<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>Classifying...
        {:else}Classify{/if}
      </button>
    </div>
    {#if singleResult}
      <div class="bg-purple-50 rounded-lg p-4 border border-purple-200">
        <h3 class="text-sm font-semibold text-purple-900 mb-2">Classification Result</h3>
        <div class="flex flex-wrap gap-2 mb-3">
          {#each (singleResult.analysis?.tags || []) as tag}
            <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">{tag}</span>
          {/each}
        </div>
        <p class="text-sm text-gray-700">Type: <span class="font-medium">{singleResult.analysis?.content_type || '—'}</span></p>
        <p class="text-sm text-gray-700">Sentiment: <span class="font-medium">{singleResult.analysis?.sentiment || '—'}</span></p>
        {#if singleResult.analysis?.description}
          <p class="text-xs text-gray-600 mt-2">{singleResult.analysis.description}</p>
        {/if}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="animate-spin rounded-full h-10 w-10 border-4 border-purple-200 border-t-purple-600"></div>
    </div>
  {:else}
    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase mb-1">Classified Images</p>
        <p class="text-2xl font-bold text-gray-900">{formatNumber(results.length)}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase mb-1">Unique Tags</p>
        <p class="text-2xl font-bold text-purple-600">{formatNumber(classStats.topTags?.length || 0)}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase mb-1">Categories</p>
        <p class="text-2xl font-bold text-gray-900">{classStats.categories?.length || 0}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase mb-1">Top Tag</p>
        <p class="text-lg font-bold text-purple-600">{classStats.topTags?.[0]?.tag || '—'}</p>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div id="tag-chart" class="w-full h-96"></div>
        {#if classStats.topTags?.length === 0}
          <div class="flex items-center justify-center h-96 text-gray-400"><p class="text-sm">No classification data yet</p></div>
        {/if}
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div id="category-chart" class="w-full h-96"></div>
        {#if classStats.categories?.length === 0}
          <div class="flex items-center justify-center h-96 text-gray-400"><p class="text-sm">No category data yet</p></div>
        {/if}
      </div>
    </div>

    <!-- Results -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h2 class="text-lg font-semibold text-gray-900">Classification Results</h2>
      </div>
      {#if results.length === 0}
        <div class="p-12 text-center text-gray-400">
          <span class="text-4xl block mb-2">🏷️</span>
          <p class="text-sm">No classified images yet. Use the classify panel above or run batch processing.</p>
        </div>
      {:else}
        <div class="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
          {#each results as r}
            <div class="p-4 hover:bg-purple-50/30">
              <div class="flex items-start gap-4">
                <img src={r.image_url} alt="" class="w-14 h-14 rounded-lg object-cover bg-gray-100 flex-shrink-0" on:error={(e) => { e.currentTarget.style.display = 'none'; }} />
                <div class="flex-1 min-w-0">
                  <div class="flex flex-wrap gap-1.5">
                    {#each (r.tags || []).slice(0, 8) as t}
                      <span class="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">{t.tag} ({(parseFloat(t.confidence) * 100).toFixed(0)}%)</span>
                    {/each}
                  </div>
                  <p class="text-xs text-gray-500 mt-1 truncate">{r.image_url}</p>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
