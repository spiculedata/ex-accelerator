<script lang="ts">
  import { page } from '$app/stores';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { getSentimentColor } from '$lib/utils/colorUtils';
  import { onMount } from 'svelte';
  import { radioAnalyticsDb } from '$lib/services/radioAnalyticsDb';
  import FilterBar from '$lib/components/ui/FilterBar.svelte';
  import WorkspaceBanner from '$lib/components/ui/WorkspaceBanner.svelte';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';
  import { formatNumber } from '$lib/utils/formatUtils';

  $: workspaceId = $page.url.searchParams.get('workspace');

  // Loading state
  let loading = true;
  let error = '';
  let currentFilterParams: Record<string, string> = {};

  // Overview stats
  let overviewStats = {
    totalTranscripts: 0,
    totalHours: 0,
    stationCount: 0,
    avgDuration: 0,
    politicalPercent: 0,
    adPercent: 0
  };

  // Chart data
  let sentimentBreakdown: any[] = [];
  let stationBreakdown: any[] = [];
  let sentimentTrends: any[] = [];
  let topTopics: any[] = [];
  let politicalBreakdown: any[] = [];
  let transcripts: any[] = [];

  // Filters
  let searchQuery = '';
  let transcriptFilter = 'all';
  let timeRange = '7d';

  // Chart instances
  let sentimentChart: any = null;
  let politicalChart: any = null;
  let trendsChart: any = null;
  let topicsChart: any = null;

  function handleFilterReady(params: Record<string, string>) {
    currentFilterParams = params;
    loadData();
  }

  function handleFilterChange(event: CustomEvent) {
    const detail = event.detail || {};
    currentFilterParams = {};
    if (detail.workspaceId) currentFilterParams.workspace_id = detail.workspaceId;
    currentFilterParams.platforms = (detail.platforms || []).join(',');
    if (detail.dateStart) currentFilterParams.date_start = detail.dateStart;
    if (detail.dateEnd) currentFilterParams.date_end = detail.dateEnd;
    loadData();
  }

  async function loadData() {
    try {
      loading = true;
      error = '';

      const fp = { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...currentFilterParams };
      const ws = workspaceId || undefined;

      const [stats, sentiment, stations, trends, topics, political, trans] = await Promise.all([
        radioAnalyticsDb.getOverviewStats(ws, fp),
        radioAnalyticsDb.getSentimentBreakdown(ws, fp),
        radioAnalyticsDb.getStationBreakdown(ws, fp),
        radioAnalyticsDb.getSentimentTrends(timeRange, ws, fp),
        radioAnalyticsDb.getTopTopics(ws, fp),
        radioAnalyticsDb.getPoliticalBreakdown(ws, fp),
        radioAnalyticsDb.getTranscripts({}, ws)
      ]);

      overviewStats = stats;
      sentimentBreakdown = sentiment;
      stationBreakdown = stations;
      sentimentTrends = trends;
      topTopics = topics;
      politicalBreakdown = political;
      transcripts = trans;

      loading = false;

      try {
        await waitForEcharts();
        initSentimentChart();
        initPoliticalChart();
        initTrendsChart();
        initTopicsChart();
      } catch (e) {
        console.error('Charts unavailable:', e);
      }
    } catch (err) {
      console.error('Error loading radio analytics data:', err);
      error = 'Failed to load radio analytics data. Please check your database connection.';
      loading = false;
    }
  }

  // Filtered transcripts
  $: filteredTranscripts = transcripts.filter(t => {
    const matchesSearch = !searchQuery ||
      (t.transcript && t.transcript.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.radioName && t.radioName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter = transcriptFilter === 'all' ||
      (transcriptFilter === 'political' && t.isPolitical) ||
      (transcriptFilter === 'ads' && t.isAd) ||
      (transcriptFilter === 'non-political' && !t.isPolitical && !t.isAd);

    return matchesSearch && matchesFilter;
  });

  function getSentimentBadgeClasses(sentiment: string): string {
    return getSentimentColor(sentiment, 'tailwind');
  }

  function getPoliticalBadgeClasses(isPolitical: boolean): string {
    return isPolitical ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600';
  }

  function truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  }

  // Chart initialization functions
  function initSentimentChart() {
    const container = document.getElementById('radio-sentiment-chart');
    if (!container) return;
    sentimentChart = initChart(container);
    if (!sentimentChart) return;

    const colorMap: Record<string, string> = {
      positive: getSentimentColor('positive'),
      negative: getSentimentColor('negative'),
      neutral: getSentimentColor('neutral')
    };

    sentimentChart.setOption({
      title: {
        text: 'Sentiment Distribution',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: sentimentBreakdown.map(item => ({
          name: item.label || item.sentiment_category,
          value: item.count || item.post_count,
          itemStyle: { color: item.color || colorMap[(item.label || item.sentiment_category || '').toLowerCase()] || '#8b5cf6' }
        })),
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
        },
        label: { show: true, formatter: '{b}\n{d}%' }
      }]
    });
  }

  function initPoliticalChart() {
    const container = document.getElementById('radio-political-chart');
    if (!container) return;
    politicalChart = initChart(container);
    if (!politicalChart) return;

    const colorMap: Record<string, string> = {
      political_news: '#ef4444',
      political_ad: '#f97316',
      apolitical: '#6b7280'
    };

    politicalChart.setOption({
      title: {
        text: 'Political Classification',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      series: [{
        type: 'pie',
        radius: ['0%', '70%'],
        data: politicalBreakdown.map(item => ({
          name: item.category,
          value: item.count,
          itemStyle: { color: colorMap[item.category?.toLowerCase()] || '#6b7280' }
        })),
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
        },
        label: { show: true, formatter: '{b}\n{d}%' }
      }]
    });
  }

  function initTrendsChart() {
    const container = document.getElementById('radio-trends-chart');
    if (!container) return;
    trendsChart = initChart(container);
    if (!trendsChart) return;

    const dates = sentimentTrends.map(t => t.date);

    trendsChart.setOption({
      title: {
        text: 'Sentiment Trends',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['Positive', 'Negative', 'Neutral'],
        bottom: 0
      },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          formatter: function(value: string) {
            return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
        }
      },
      yAxis: { type: 'value', name: '%', max: 100 },
      series: [
        {
          name: 'Positive',
          type: 'line',
          data: sentimentTrends.map(t => t.positive),
          itemStyle: { color: getSentimentColor('positive') }, // same palette as every sentiment chart

          lineStyle: { width: 2 },
          smooth: true
        },
        {
          name: 'Negative',
          type: 'line',
          data: sentimentTrends.map(t => t.negative),
          itemStyle: { color: getSentimentColor('negative') },
          lineStyle: { width: 2 },
          smooth: true
        },
        {
          name: 'Neutral',
          type: 'line',
          data: sentimentTrends.map(t => t.neutral),
          itemStyle: { color: getSentimentColor('neutral') },
          lineStyle: { width: 2, type: 'dashed' },
          smooth: true
        }
      ]
    });
  }

  function initTopicsChart() {
    const container = document.getElementById('radio-topics-chart');
    if (!container) return;
    topicsChart = initChart(container);
    if (!topicsChart) return;

    const sortedTopics = [...topTopics].sort((a, b) => a.count - b.count);

    topicsChart.setOption({
      title: {
        text: 'Top Topics (by segments)',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: { left: '3%', right: '10%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value', name: 'Mentions' },
      yAxis: {
        type: 'category',
        data: sortedTopics.map(t => t.topic),
        axisLabel: { width: 100, overflow: 'truncate' }
      },
      series: [{
        type: 'bar',
        data: sortedTopics.map(t => ({
          value: t.count,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#7c3aed' },
                { offset: 1, color: '#a78bfa' }
              ]
            }
          }
        })),
        barMaxWidth: 24,
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.3)' } }
      }]
    });
  }
</script>

<svelte:head>
  <title>Radio Analytics - Social Explorer</title>
  <meta name="description" content="Analysis of radio broadcast transcripts with sentiment, political classification, and topic modeling" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <PageHeader title="Radio Analytics" subtitle="Analysis of radio broadcast transcripts" backHref="/text-analytics" />

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <WorkspaceBanner workspaceId={workspaceId || ''} workspaceName="" />

    <!-- Filter Bar -->
    <div class="mb-6">
      <FilterBar workspaceId={workspaceId} datasetTypes={["radio"]} onReady={handleFilterReady} on:change={handleFilterChange} />
    </div>

    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading radio analytics data...</span>
      </div>
    {:else if error}
      <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <svg class="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <p class="text-red-700 font-medium">{error}</p>
      </div>
    {:else if overviewStats.totalTranscripts === 0}
      <div class="bg-white rounded-xl shadow-sm p-12 text-center">
        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M12 12h.01"></path>
        </svg>
        <h3 class="text-lg font-semibold text-gray-700 mb-2">No radio data yet</h3>
        <p class="text-gray-500">Import radio broadcast transcripts to see analytics here.</p>
      </div>
    {:else}
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div class="bg-white rounded-xl shadow-sm p-4 text-center">
          <div class="text-2xl font-bold text-purple-600 mb-1">{formatNumber(overviewStats.totalTranscripts)}</div>
          <div class="text-xs text-gray-600">Total Transcripts</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-4 text-center">
          <div class="text-2xl font-bold text-blue-600 mb-1">{typeof overviewStats.totalHours === 'number' ? overviewStats.totalHours.toFixed(1) : overviewStats.totalHours}</div>
          <div class="text-xs text-gray-600">Hours Recorded</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-4 text-center">
          <div class="text-2xl font-bold text-emerald-600 mb-1">{formatNumber(overviewStats.stationCount)}</div>
          <div class="text-xs text-gray-600">Active Stations</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-4 text-center">
          <div class="text-2xl font-bold text-signal-700 mb-1">{typeof overviewStats.avgDuration === 'number' ? overviewStats.avgDuration.toFixed(0) : overviewStats.avgDuration}s</div>
          <div class="text-xs text-gray-600">Avg Duration</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-4 text-center">
          <div class="text-2xl font-bold text-red-600 mb-1">{typeof overviewStats.politicalPercent === 'number' ? overviewStats.politicalPercent.toFixed(1) : overviewStats.politicalPercent}%</div>
          <div class="text-xs text-gray-600">Political Content</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-4 text-center">
          <div class="text-2xl font-bold text-signal-700 mb-1">{typeof overviewStats.adPercent === 'number' ? overviewStats.adPercent.toFixed(1) : overviewStats.adPercent}%</div>
          <div class="text-xs text-gray-600">Ad Content</div>
        </div>
      </div>

      <!-- Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div id="radio-sentiment-chart" class="w-full h-80"></div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div id="radio-political-chart" class="w-full h-80"></div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div id="radio-trends-chart" class="w-full h-80"></div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div id="radio-topics-chart" class="w-full h-80"></div>
        </div>
      </div>

      <!-- Station Breakdown Table -->
      <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Station Breakdown</h2>
        {#if stationBreakdown.length > 0}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Station</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Transcripts</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Positive</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Negative</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Political</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each stationBreakdown as station}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3 text-sm font-medium text-gray-900">{station.radioName}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{station.state || '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-900 text-right">{formatNumber(station.transcriptCount)}</td>
                    <td class="px-4 py-3 text-sm text-gray-900 text-right">{typeof station.totalHours === 'number' ? station.totalHours.toFixed(1) : station.totalHours}</td>
                    <td class="px-4 py-3 text-right">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {station.positivePercent != null ? station.positivePercent.toFixed(1) + '%' : '-'}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                        {station.negativePercent != null ? station.negativePercent.toFixed(1) + '%' : '-'}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {station.politicalPercent != null ? station.politicalPercent.toFixed(1) + '%' : '-'}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="text-gray-500 text-sm text-center py-4">No station data available.</p>
        {/if}
      </div>

      <!-- Recent Transcripts -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Recent Transcripts</h2>

        <!-- Search and Filters -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div class="relative flex-1 w-full">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Search transcripts..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div class="flex items-center gap-2">
            <button
              on:click={() => transcriptFilter = 'all'}
              class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors {transcriptFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            >All</button>
            <button
              on:click={() => transcriptFilter = 'political'}
              class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors {transcriptFilter === 'political' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            >Political</button>
            <button
              on:click={() => transcriptFilter = 'ads'}
              class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors {transcriptFilter === 'ads' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            >Ads</button>
            <button
              on:click={() => transcriptFilter = 'non-political'}
              class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors {transcriptFilter === 'non-political' ? 'bg-slate-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            >Non-Political</button>
          </div>
        </div>

        <!-- Transcript count -->
        <p class="text-xs text-gray-500 mb-4">{filteredTranscripts.length} transcripts shown</p>

        <!-- Transcript Cards -->
        {#if filteredTranscripts.length > 0}
          <div class="space-y-3">
            {#each filteredTranscripts.slice(0, 20) as transcript}
              <div class="border border-gray-200 rounded-lg p-4 hover:border-purple-200 transition-colors">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-gray-900">{transcript.radioName || 'Unknown Station'}</span>
                    {#if transcript.timestamp}
                      <span class="text-xs text-gray-500">{new Date(transcript.timestamp).toLocaleString()}</span>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2">
                    {#if transcript.sentiment}
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getSentimentBadgeClasses(transcript.sentiment)}">
                        {transcript.sentiment}
                      </span>
                    {/if}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getPoliticalBadgeClasses(transcript.isPolitical)}">
                      {transcript.isPolitical ? 'Political' : 'Apolitical'}
                    </span>
                  </div>
                </div>
                <p class="text-sm text-gray-700 leading-relaxed">{truncateText(transcript.transcript, 200)}</p>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-center py-8">
            <p class="text-gray-500 text-sm">No transcripts match your current filters.</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
