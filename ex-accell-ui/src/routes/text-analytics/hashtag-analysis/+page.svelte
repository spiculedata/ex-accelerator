<script lang="ts">
  import { page } from '$app/stores';
  import FilterBar from '$lib/components/ui/FilterBar.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import WorkspaceBanner from '$lib/components/ui/WorkspaceBanner.svelte';
  import { onMount } from 'svelte';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';
  import { ErrorAlert } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';

  $: workspaceId = $page.url.searchParams.get('workspace');

  let loading = true;
  let errorMessage = '';

  let hashtags: any[] = [];
  let cooccurrence: any[] = [];
  let totalHashtags = 0;
  let totalPosts = 0;
  let searchQuery = '';
  let hashtagChart: any = null;

  $: filteredHashtags = hashtags.filter(h => {
    if (!searchQuery) return true;
    return h.hashtag.toLowerCase().includes(searchQuery.toLowerCase());
  });

  async function loadData() {
    loading = true;
    errorMessage = '';
    try {
      const params = new URLSearchParams({ type: 'hashtag-analysis', limit: '100' });
      if (workspaceId) params.set('workspace_id', workspaceId);

      const res = await fetch(`/api/unified-analytics?${params}`);
      const result = await res.json();

      if (result.success && result.data) {
        hashtags = result.data.hashtags || [];
        cooccurrence = result.data.cooccurrence || [];
        totalHashtags = result.data.totalHashtags || 0;
        totalPosts = result.data.totalPosts || 0;
      } else {
        errorMessage = result.error || 'Failed to load hashtag data';
      }
    } catch (err: any) {
      errorMessage = err.message;
    } finally {
      loading = false;
      await initCharts();
    }
  }

  async function initCharts() {
    if (hashtags.length === 0) return;
    await waitForEcharts();

    const container = document.getElementById('hashtag-chart');
    if (!container) return;
    hashtagChart = initChart(container);
    if (!hashtagChart) return;

    const top20 = hashtags.slice(0, 20);
    hashtagChart.setOption({
      title: { text: 'Top Hashtags', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 10, right: 40, top: 40, bottom: 20, containLabel: true },
      xAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      yAxis: {
        type: 'category',
        data: top20.map((h: any) => '#' + h.hashtag).reverse(),
        axisLabel: { fontSize: 11 },
        axisTick: { show: false },
        axisLine: { show: false }
      },
      series: [{
        type: 'bar',
        data: top20.map((h: any) => parseInt(h.count)).reverse(),
        itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', fontSize: 10, color: '#666' }
      }]
    });
  }

  onMount(() => { loadData(); });
  $: if (workspaceId !== undefined && !loading) loadData();
</script>

<svelte:head>
  <title>Hashtag Analysis - Social Explorer</title>
</svelte:head>

<PageHeader
  title="Hashtag Analysis"
  subtitle="Discover trending hashtags and co-occurrence patterns"
  accentColor="purple"
/>

<WorkspaceBanner />


    <!-- Data Source Filter -->
    <div class="mb-6">
      <FilterBar workspaceId={workspaceId} datasetTypes={["social_media"]} />
    </div>
<div class="max-w-7xl xl:max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center space-y-4">
        <div class="animate-spin rounded-full h-10 w-10 border-4 border-purple-200 border-t-purple-600"></div>
        <p class="text-gray-500 text-sm">Analyzing hashtags...</p>
      </div>
    </div>
  {:else}
    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Unique Hashtags</p>
        <p class="text-2xl font-bold text-gray-900">{formatNumber(totalHashtags)}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Posts with Hashtags</p>
        <p class="text-2xl font-bold text-gray-900">{formatNumber(totalPosts)}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Top Hashtag</p>
        <p class="text-2xl font-bold text-purple-600">{hashtags[0] ? '#' + hashtags[0].hashtag : '—'}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Co-occurrence Pairs</p>
        <p class="text-2xl font-bold text-gray-900">{formatNumber(cooccurrence.length)}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
      <!-- Chart -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        {#if hashtags.length > 0}
          <div id="hashtag-chart" class="w-full h-96"></div>
        {:else}
          <div class="flex items-center justify-center h-96 text-gray-400">
            <div class="text-center">
              <span class="text-4xl block mb-2">#</span>
              <p class="text-sm">No hashtags found in posts</p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Co-occurrence -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 class="text-lg font-semibold text-gray-900">Hashtag Co-occurrence</h2>
          <p class="text-xs text-gray-500 mt-1">Hashtags that frequently appear together</p>
        </div>
        {#if cooccurrence.length === 0}
          <div class="p-8 text-center text-gray-400 text-sm">No co-occurrence data</div>
        {:else}
          <div class="max-h-96 overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-gray-50">
                <tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th class="px-4 py-3">Hashtag 1</th>
                  <th class="px-4 py-3">Hashtag 2</th>
                  <th class="px-4 py-3 text-right">Co-occurrences</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each cooccurrence as pair}
                  <tr class="hover:bg-purple-50/50">
                    <td class="px-4 py-2.5 text-purple-700 font-medium">#{pair.hashtag1}</td>
                    <td class="px-4 py-2.5 text-purple-700 font-medium">#{pair.hashtag2}</td>
                    <td class="px-4 py-2.5 text-right text-gray-600">{formatNumber(parseInt(pair.co_count))}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>

    <!-- Full Hashtag Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">All Hashtags</h2>
          <p class="text-xs text-gray-500 mt-1">{filteredHashtags.length} hashtags found</p>
        </div>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search hashtags..."
          class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 w-48"
        />
      </div>
      {#if filteredHashtags.length === 0}
        <div class="p-8 text-center text-gray-400 text-sm">No hashtags match your search</div>
      {:else}
        <div class="max-h-[500px] overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-gray-50">
              <tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th class="px-4 py-3">Hashtag</th>
                <th class="px-4 py-3 text-right">Mentions</th>
                <th class="px-4 py-3 text-right">Posts</th>
                <th class="px-4 py-3">Platforms</th>
                <th class="px-4 py-3">Distribution</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each filteredHashtags as h}
                {@const maxCount = Math.max(...filteredHashtags.slice(0, 1).map(x => parseInt(x.count)), 1)}
                <tr class="hover:bg-purple-50/50">
                  <td class="px-4 py-2.5 text-purple-700 font-semibold">#{h.hashtag}</td>
                  <td class="px-4 py-2.5 text-right text-gray-900">{formatNumber(parseInt(h.count))}</td>
                  <td class="px-4 py-2.5 text-right text-gray-600">{formatNumber(parseInt(h.post_count))}</td>
                  <td class="px-4 py-2.5">
                    <div class="flex gap-1">
                      {#each (h.platforms || []) as platform}
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{platform}</span>
                      {/each}
                    </div>
                  </td>
                  <td class="px-4 py-2.5 w-32">
                    <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div class="h-full bg-purple-500 rounded-full" style="width: {Math.max((parseInt(h.count) / maxCount) * 100, 2)}%"></div>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>
