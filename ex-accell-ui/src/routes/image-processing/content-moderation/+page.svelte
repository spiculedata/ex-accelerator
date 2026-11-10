<script lang="ts">
  import { page } from '$app/stores';
  import DataUnavailable from '$lib/components/ui/DataUnavailable.svelte';
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';
  import ResponsibleUse from '$lib/components/ui/ResponsibleUse.svelte';

  let loading = true;
  let errorMessage = '';
  let unavailable = false;
  let activeTab: 'dashboard' | 'review' = 'dashboard';

  let moderationStats: {
    summary: { total_scanned: number; safe: number; flagged: number; pending: number };
    categories: { name: string; count: number }[];
  } = {
    summary: { total_scanned: 0, safe: 0, flagged: 0, pending: 0 },
    categories: []
  };

  let results: any[] = [];

  let donutChart: any = null;
  let categoryChart: any = null;

  async function loadData() {
    loading = true;
    errorMessage = '';
    try {
      const [statsRes, resultsRes] = await Promise.all([
        fetch('/api/image-processing?action=moderation-stats'),
        fetch('/api/image-processing?action=moderation-results&safe=false&limit=20')
      ]);

      const statsData = await statsRes.json();

      unavailable = !!statsData.meta?.unavailable;
      const resultsData = await resultsRes.json();

      if (statsData.success && statsData.data) {
        moderationStats = {
          summary: statsData.data.summary || { total_scanned: 0, safe: 0, flagged: 0, pending: 0 },
          categories: statsData.data.categories || []
        };
      } else {
        errorMessage = statsData.error || 'Failed to load moderation stats';
      }

      if (resultsData.success && resultsData.data) {
        results = resultsData.data.results || [];
      }
    } catch (err: any) {
      errorMessage = err.message || 'Failed to load moderation data';
    } finally {
      loading = false;
      await initCharts();
    }
  }

  async function reviewImage(imageId: string, status: string) {
    try {
      const res = await fetch('/api/image-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'moderation-review',
          image_id: imageId,
          review_status: status
        })
      });
      const data = await res.json();
      if (data.success) {
        results = results.filter((r: any) => r.image_id !== imageId);
      } else {
        errorMessage = data.error || 'Review action failed';
      }
    } catch (err: any) {
      errorMessage = err.message || 'Review action failed';
    }
  }

  async function initCharts() {
    if (moderationStats.summary.total_scanned === 0) return;
    await waitForEcharts();

    // Donut chart: Safe vs Flagged vs Pending
    const donutContainer = document.getElementById('moderation-donut-chart');
    if (donutContainer) {
      donutChart = initChart(donutContainer);
      if (donutChart) {
        donutChart.setOption({
          title: { text: 'Content Status', left: 'center', top: 10, textStyle: { fontSize: 14, fontWeight: 'bold', color: '#374151' } },
          tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          legend: { bottom: 10, left: 'center', textStyle: { fontSize: 11 } },
          series: [{
            type: 'pie',
            radius: ['40%', '65%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
            label: { show: true, fontSize: 11, formatter: '{b}\n{d}%' },
            data: [
              { value: moderationStats.summary.safe, name: 'Safe', itemStyle: { color: '#22c55e' } },
              { value: moderationStats.summary.flagged, name: 'Flagged', itemStyle: { color: '#ef4444' } },
              { value: moderationStats.summary.pending, name: 'Pending', itemStyle: { color: '#f59e0b' } }
            ]
          }]
        });
      }
    }

    // Bar chart: Flag categories
    if (moderationStats.categories.length > 0) {
      const catContainer = document.getElementById('moderation-category-chart');
      if (catContainer) {
        categoryChart = initChart(catContainer);
        if (categoryChart) {
          const cats = moderationStats.categories.sort((a, b) => b.count - a.count);
          categoryChart.setOption({
            title: { text: 'Flags by Category', left: 'center', top: 10, textStyle: { fontSize: 14, fontWeight: 'bold', color: '#374151' } },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: 10, right: 40, top: 50, bottom: 20, containLabel: true },
            xAxis: { type: 'value', axisLabel: { fontSize: 10 } },
            yAxis: {
              type: 'category',
              data: cats.map((c) => c.name).reverse(),
              axisLabel: { fontSize: 11 },
              axisTick: { show: false },
              axisLine: { show: false }
            },
            series: [{
              type: 'bar',
              data: cats.map((c) => c.count).reverse(),
              itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] },
              label: { show: true, position: 'right', fontSize: 10, color: '#666' }
            }]
          });
        }
      }
    }
  }

  onMount(() => { loadData(); });
</script>

<svelte:head>
  <title>Content Moderation - Social Explorer</title>
  <meta name="description" content="Automated content safety screening and moderation" />
</svelte:head>

<PageHeader
  title="Content Moderation"
  subtitle="Automated content safety screening"
  accentColor="red"
/>

<div class="max-w-7xl xl:max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {#if errorMessage}
    <div class="mb-6">
      <ErrorAlert message={errorMessage} />
    </div>
  {/if}
  {#if unavailable}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <DataUnavailable
        title="No images have been analysed yet"
        description="This page fills in once images have been processed. You can try the analysis on a single image below." />
    </div>
  {/if}

  <!-- Shown on every tab -->
  <div class="max-w-7xl mx-auto"><ResponsibleUse tool="content moderation" /></div>

  <!-- Tab Switcher -->
  <div class="flex space-x-1 bg-gray-100 rounded-xl p-1 mb-8 max-w-xs">
    <button
      class="flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors {activeTab === 'dashboard' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
      on:click={() => { activeTab = 'dashboard'; }}
    >
      Dashboard
    </button>
    <button
      class="flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors {activeTab === 'review' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
      on:click={() => { activeTab = 'review'; }}
    >
      Review Queue
    </button>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-24">
      <div class="text-center">
        <div class="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-500 text-sm">Loading moderation data...</p>
      </div>
    </div>
  {:else if activeTab === 'dashboard'}
    <!-- Dashboard Tab -->

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-500">Total Scanned</span>
          <div class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <p class="text-3xl font-bold text-gray-900">{formatNumber(moderationStats.summary.total_scanned)}</p>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-500">Safe %</span>
          <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
        <p class="text-3xl font-bold text-green-600">
          {moderationStats.summary.total_scanned > 0
            ? ((moderationStats.summary.safe / moderationStats.summary.total_scanned) * 100).toFixed(1)
            : '0'}%
        </p>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-500">Flagged</span>
          <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>
        <p class="text-3xl font-bold text-red-600">{formatNumber(moderationStats.summary.flagged)}</p>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-500">Pending Review</span>
          <div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p class="text-3xl font-bold text-amber-600">{formatNumber(moderationStats.summary.pending)}</p>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div id="moderation-donut-chart" class="w-full h-80"></div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {#if moderationStats.categories.length > 0}
          <div id="moderation-category-chart" class="w-full h-80"></div>
        {:else}
          <div class="flex items-center justify-center h-80 text-gray-500">
            <p class="text-sm">No flag category data available</p>
          </div>
        {/if}
      </div>
    </div>

  {:else}
    <!-- Review Queue Tab -->

    <!-- Warning Banner -->
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
      <div class="flex items-start">
        <svg class="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <h3 class="text-sm font-semibold text-amber-800">Sensitive Content Warning</h3>
          <p class="text-sm text-amber-700 mt-1">Flagged content is blurred by default. Click "View" to reveal an individual image for review purposes.</p>
        </div>
      </div>
    </div>

    {#if results.length === 0}
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h3 class="text-lg font-semibold text-gray-700 mb-1">No items pending review</h3>
        <p class="text-sm text-gray-500">All flagged content has been reviewed. Check back later.</p>
      </div>
    {:else}
      <div class="space-y-4">
        {#each results as item (item.image_id)}
          {@const revealed = false}
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <!-- Blurred Thumbnail -->
            <div class="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 group">
              {#if item.thumbnail_url}
                <img
                  src={item.thumbnail_url}
                  alt="Flagged content"
                  class="w-full h-full object-cover"
                  style="filter: blur(20px);"
                />
              {:else}
                <div class="w-full h-full flex items-center justify-center" style="filter: blur(20px);">
                  <div class="w-16 h-16 bg-red-200 rounded"></div>
                </div>
              {/if}
              <div class="absolute inset-0 bg-black/30 flex items-center justify-center">
                <svg class="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              </div>
            </div>

            <!-- Details -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                  {item.flag_reason || 'Flagged'}
                </span>
                {#if item.confidence != null}
                  <span class="text-xs text-gray-500">
                    Confidence: <span class="font-medium text-gray-700">{(item.confidence * 100).toFixed(1)}%</span>
                  </span>
                {/if}
              </div>
              <p class="text-sm text-gray-600 truncate">{item.image_id || 'Unknown image'}</p>
              {#if item.source}
                <p class="text-xs text-gray-500 mt-0.5">Source: {item.source}</p>
              {/if}
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                on:click={() => reviewImage(item.image_id, 'safe')}
                class="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
              >
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Clear
              </button>
              <button
                on:click={() => reviewImage(item.image_id, 'confirmed')}
                class="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
              >
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Confirm Flag
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
