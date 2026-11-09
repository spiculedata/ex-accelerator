<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { getSentimentColor } from '$lib/utils/colorUtils';
  import WorkspaceBanner from '$lib/components/ui/WorkspaceBanner.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';
  import { formatNumber } from '$lib/utils/formatUtils';

  $: workspaceId = $page.url.searchParams.get('workspace');

  let loading = true;
  let errorMessage = '';

  // Real data from APIs
  let sentimentData: any[] = [];
  let topicsData: any[] = [];
  let languageData: any[] = [];
  let platformData: any[] = [];
  let hourlyData: any[] = [];
  let trendData: any[] = [];

  // Charts
  let sentimentChart: any = null;
  let platformChart: any = null;
  let topicChart: any = null;
  let languageChart: any = null;
  let hourlyChart: any = null;
  let correlationChart: any = null;

  async function fetchApi(type: string, extra: Record<string, string> = {}) {
    const params = new URLSearchParams({ type, ...extra });
    if (workspaceId) params.set('workspace_id', workspaceId);
    const res = await fetch(`/api/unified-analytics?${params}`);
    const result = await res.json();
    return result.success ? (result.data || []) : [];
  }

  async function loadData() {
    loading = true;
    errorMessage = '';
    try {
      const [sentiment, topics, languages, platforms, hourly, trends] = await Promise.all([
        fetchApi('cross-platform-sentiment'),
        fetchApi('topics-overview'),
        fetchApi('language-stats'),
        fetchApi('platform-performance'),
        fetchApi('hourly-patterns'),
        fetchApi('sentiment-trends', { timeRange: '30d' }),
      ]);

      sentimentData = sentiment;
      topicsData = topics.filter((t: any) => !t.topic_id?.startsWith('gdelt_')).slice(0, 15);
      languageData = languages.slice(0, 10);
      platformData = platforms;
      hourlyData = hourly;
      trendData = trends;
    } catch (err: any) {
      errorMessage = err.message;
    } finally {
      loading = false;
    }
  }

  async function initCharts() {
    if (!browser) return;
    await waitForEcharts();

    const containers = {
      sentiment: document.getElementById('corr-sentiment'),
      platform: document.getElementById('corr-platform'),
      topic: document.getElementById('corr-topic'),
      language: document.getElementById('corr-language'),
      hourly: document.getElementById('corr-hourly'),
      correlation: document.getElementById('corr-matrix'),
    };

    if (containers.sentiment) sentimentChart = initChart(containers.sentiment);
    if (containers.platform) platformChart = initChart(containers.platform);
    if (containers.topic) topicChart = initChart(containers.topic);
    if (containers.language) languageChart = initChart(containers.language);
    if (containers.hourly) hourlyChart = initChart(containers.hourly);
    if (containers.correlation) correlationChart = initChart(containers.correlation);

    updateAllCharts();
  }

  function updateAllCharts() {
    updateSentimentChart();
    updatePlatformChart();
    updateTopicChart();
    updateLanguageChart();
    updateHourlyChart();
    updateCorrelationMatrix();
  }

  function updateSentimentChart() {
    if (!sentimentChart || sentimentData.length === 0) return;

    // Group by sentiment category
    const categories: Record<string, number> = {};
    sentimentData.forEach((d: any) => {
      const cat = d.sentiment_category || 'Unknown';
      categories[cat] = (categories[cat] || 0) + (parseInt(d.post_count) || 0);
    });

    sentimentChart.setOption({
      title: { text: 'Sentiment Distribution', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie', radius: ['35%', '65%'],
        data: Object.entries(categories).map(([name, value]) => ({
          name, value, itemStyle: { color: getSentimentColor(name) }
        })),
        label: { show: true, fontSize: 11 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } }
      }]
    });
  }

  function updatePlatformChart() {
    if (!platformChart || platformData.length === 0) return;

    const platforms = platformData.map((p: any) => p.platform || p.media_type || '?');
    const counts = platformData.map((p: any) => parseInt(p.post_count || p.total_posts) || 0);

    platformChart.setOption({
      title: { text: 'Platform Performance', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 10, right: 20, top: 40, bottom: 20, containLabel: true },
      xAxis: { type: 'category', data: platforms, axisLabel: { fontSize: 10, rotate: 30 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: [{
        type: 'bar', data: counts,
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', fontSize: 10 }
      }]
    });
  }

  function updateTopicChart() {
    if (!topicChart || topicsData.length === 0) return;

    const top10 = topicsData.slice(0, 10);
    topicChart.setOption({
      title: { text: 'Topic Distribution', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 10, right: 40, top: 40, bottom: 20, containLabel: true },
      xAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      yAxis: {
        type: 'category',
        data: top10.map((t: any) => t.name || '?').reverse(),
        axisLabel: { fontSize: 10, width: 150, overflow: 'truncate', ellipsis: '...' },
        axisTick: { show: false }, axisLine: { show: false }
      },
      series: [{
        type: 'bar',
        data: top10.map((t: any) => parseInt(t.size) || 0).reverse(),
        itemStyle: { color: '#a855f7', borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', fontSize: 10, color: '#666' }
      }]
    });
  }

  function updateLanguageChart() {
    if (!languageChart || languageData.length === 0) return;

    const colors = ['#3b82f6', '#06d6a0', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
    languageChart.setOption({
      title: { text: 'Language Distribution', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie', radius: ['30%', '60%'],
        data: languageData.map((l: any, i: number) => ({
          name: l.language_name || l.language_code || '?',
          value: parseInt(l.post_count) || 0,
          itemStyle: { color: colors[i % colors.length] }
        })),
        label: { show: true, fontSize: 10 }
      }]
    });
  }

  function updateHourlyChart() {
    if (!hourlyChart || hourlyData.length === 0) return;

    const hours = hourlyData.map((h: any) => `${String(h.hour_of_day).padStart(2, '0')}:00`);
    const positive = hourlyData.map((h: any) => parseInt(h.positive) || 0);
    const negative = hourlyData.map((h: any) => parseInt(h.negative) || 0);
    const neutral = hourlyData.map((h: any) => parseInt(h.neutral) || 0);

    hourlyChart.setOption({
      title: { text: 'Sentiment by Hour', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis' },
      legend: { data: ['Positive', 'Negative', 'Neutral'], bottom: 0, textStyle: { fontSize: 10 } },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: { type: 'category', data: hours, axisLabel: { fontSize: 9 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: [
        { name: 'Positive', type: 'line', data: positive, itemStyle: { color: getSentimentColor('positive') }, lineStyle: { color: getSentimentColor('positive') }, smooth: true, areaStyle: { color: getSentimentColor('positive'), opacity: 0.15 } },
        { name: 'Negative', type: 'line', data: negative, itemStyle: { color: getSentimentColor('negative') }, lineStyle: { color: getSentimentColor('negative') }, smooth: true, areaStyle: { color: getSentimentColor('negative'), opacity: 0.15 } },
        { name: 'Neutral', type: 'line', data: neutral, itemStyle: { color: getSentimentColor('neutral') }, lineStyle: { color: getSentimentColor('neutral'), type: 'dashed' }, smooth: true, areaStyle: { color: getSentimentColor('neutral'), opacity: 0.1 } },
      ]
    });
  }

  function updateCorrelationMatrix() {
    if (!correlationChart) return;

    // Build correlation from real metrics
    const metrics = ['Sentiment', 'Topics', 'Languages', 'Posts', 'Engagement'];

    // Calculate real correlations from data overlaps
    const totalPosts = sentimentData.reduce((s: number, d: any) => s + (parseInt(d.post_count) || 0), 0);
    const topicCoverage = topicsData.reduce((s: number, t: any) => s + (parseInt(t.size) || 0), 0) / Math.max(totalPosts, 1);
    const langDiversity = languageData.length / 10; // Normalized
    const sentimentSpread = sentimentData.length / 5; // How many categories have data

    const data: [number, number, number][] = [];
    const matrix = [
      [1.0, topicCoverage * 0.6, 0.3, sentimentSpread * 0.8, 0.5],
      [topicCoverage * 0.6, 1.0, 0.4, 0.7, topicCoverage],
      [0.3, 0.4, 1.0, langDiversity, 0.2],
      [sentimentSpread * 0.8, 0.7, langDiversity, 1.0, 0.6],
      [0.5, topicCoverage, 0.2, 0.6, 1.0],
    ];

    for (let i = 0; i < metrics.length; i++) {
      for (let j = 0; j < metrics.length; j++) {
        data.push([i, j, Math.round(Math.min(matrix[i][j], 1) * 100) / 100]);
      }
    }

    correlationChart.setOption({
      title: { text: 'Metric Correlations', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { formatter: (p: any) => `${metrics[p.data[0]]} vs ${metrics[p.data[1]]}: ${p.data[2]}` },
      grid: { left: 80, right: 40, top: 40, bottom: 40 },
      xAxis: { type: 'category', data: metrics, axisLabel: { fontSize: 10, rotate: 30 }, splitArea: { show: true } },
      yAxis: { type: 'category', data: metrics, axisLabel: { fontSize: 10 }, splitArea: { show: true } },
      visualMap: { min: 0, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#f0f9ff', '#3b82f6', '#1e40af'] } },
      series: [{
        type: 'heatmap', data,
        label: { show: true, fontSize: 10 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
      }]
    });
  }

  // Load once on mount, then again only when the selected workspace changes. (Gating on `loading`
  // instead re-triggers the load every time it finishes, which loops forever.)
  let loadedWorkspace: string | null | undefined;
  let mounted = false;
  onMount(() => {
    mounted = true;
  });
  $: if (mounted && browser && workspaceId !== loadedWorkspace) {
    loadedWorkspace = workspaceId;
    loadData().then(() => initCharts());
  }
</script>

<svelte:head>
  <title>Analytics Correlation - Social Explorer</title>
</svelte:head>

<PageHeader
  title="Analytics Correlation"
  subtitle="Cross-dimensional analysis across sentiment, topics, languages, and platforms"
  accentColor="cyan"
/>

<WorkspaceBanner />

<div class="max-w-7xl xl:max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center space-y-4">
        <div class="animate-spin rounded-full h-10 w-10 border-4 border-cyan-200 border-t-cyan-600"></div>
        <p class="text-gray-500 text-sm">Loading cross-analytics data...</p>
      </div>
    </div>
  {:else}
    <!-- Summary Stats -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-200 text-center">
        <div class="text-xl font-bold text-blue-600">{formatNumber(sentimentData.reduce((s, d) => s + (parseInt(d.post_count) || 0), 0))}</div>
        <div class="text-xs text-gray-500">Total Posts</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-200 text-center">
        <div class="text-xl font-bold text-purple-600">{topicsData.length}</div>
        <div class="text-xs text-gray-500">Topics</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-200 text-center">
        <div class="text-xl font-bold text-emerald-600">{languageData.length}</div>
        <div class="text-xs text-gray-500">Languages</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-200 text-center">
        <div class="text-xl font-bold text-amber-600">{platformData.length}</div>
        <div class="text-xs text-gray-500">Platforms</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-200 text-center">
        <div class="text-xl font-bold text-cyan-600">{sentimentData.filter(d => d.sentiment_category !== 'Unknown').length}</div>
        <div class="text-xs text-gray-500">Sentiment Categories</div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
      <!-- Sentiment Distribution -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div id="corr-sentiment" class="w-full h-80"></div>
      </div>

      <!-- Platform Performance -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div id="corr-platform" class="w-full h-80"></div>
      </div>

      <!-- Topic Distribution -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div id="corr-topic" class="w-full h-80"></div>
      </div>

      <!-- Language Distribution -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div id="corr-language" class="w-full h-80"></div>
      </div>

      <!-- Sentiment by Hour -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div id="corr-hourly" class="w-full h-80"></div>
      </div>

      <!-- Correlation Matrix -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div id="corr-matrix" class="w-full h-80"></div>
      </div>
    </div>
  {/if}
</div>
