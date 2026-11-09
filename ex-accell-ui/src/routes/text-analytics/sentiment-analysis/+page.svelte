<script lang="ts">
  import { goto } from '$app/navigation';
  import PostDrilldown from '$lib/components/ui/PostDrilldown.svelte';
  import { filtersFromParams, type PostFilters } from '$lib/services/postsApi';
  import FilterBar from '$lib/components/ui/FilterBar.svelte';
  import { page } from '$app/stores';
  import { currentProject } from '$lib/stores/projectStore';
  import { sentimentAnalysisDb } from '$lib/services/sentimentAnalysisDb';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import WorkspaceBanner from '$lib/components/ui/WorkspaceBanner.svelte';
  import { onMount } from 'svelte';
  import { getSentimentColor, getSentimentIcon } from '$lib/utils/colorUtils';
  import { formatTimestamp } from '$lib/utils/formatUtils';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';

  $: workspaceId = $page.url.searchParams.get('workspace');

  // Loading state
  let loading = true;
  let currentFilterParams: Record<string, string> = {};

  function handleFilterReady(params: Record<string, string>) {
    currentFilterParams = params;
    loadSentimentData();
  }

  function handleFilterChange(event: CustomEvent) {
    const detail = event.detail || {};
    currentFilterParams = {};
    if (detail.workspaceId) currentFilterParams.workspace_id = detail.workspaceId;
    currentFilterParams.platforms = (detail.platforms || []).join(',');
    if (detail.dateStart) currentFilterParams.date_start = detail.dateStart;
    if (detail.dateEnd) currentFilterParams.date_end = detail.dateEnd;
    loadSentimentData();
  }

  // No onMount load — FilterBar's onReady callback triggers the initial load

  // Comprehensive sentiment analysis data - loaded from database
  const emptySentimentStats = () => ({
    positive: { count: 0, percentage: 0, confidence: 0 },
    negative: { count: 0, percentage: 0, confidence: 0 },
    neutral: { count: 0, percentage: 0, confidence: 0 }
  });
  let sentimentStats: any = emptySentimentStats();
  // A failed load is not the same as an empty range, so the two are told apart in the page
  let loadFailed = false;
  // The sentiment segment whose posts are open in the side panel
  let drilldown: { title: string; filters: PostFilters } | null = null;

  let totalPosts = 0;

  // Detailed sentiment categories
  let detailedSentiments: any[] = [];

  // Emotion analysis data
  let emotionStats: any[] = [];

  // Sentiment over time data
  let sentimentTrends: any[] = [];

  // Sample posts with sentiment analysis
  let samplePosts: any[] = [];

  // Load sentiment analysis data from database service
  async function loadSentimentData() {
    loadFailed = false;
    try {
      // Load all sentiment data from database service
      const fp = { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...currentFilterParams };
      const stats = await sentimentAnalysisDb.getSentimentStats(workspaceId || undefined, fp);
      sentimentStats = stats;
      totalPosts = stats.total;

      detailedSentiments = await sentimentAnalysisDb.getDetailedSentiments(workspaceId || undefined, fp);
      emotionStats = await sentimentAnalysisDb.getEmotionStats(workspaceId || undefined, fp);
      sentimentTrends = await sentimentAnalysisDb.getSentimentTrends(timeRange, workspaceId || undefined, fp);
      
      // Load posts with current filters
      await loadFilteredPosts();
      
      console.log('Sentiment analysis data loaded successfully from database');
      loading = false;
      
      // Initialize charts after data is loaded
      try {
        await waitForEcharts();
        initializeCharts();
      } catch (e) {
        console.error('Charts unavailable:', e);
      }
    } catch (error) {
      console.error('Error loading sentiment data:', error);
      // No fallback - sentiment analysis requires database connection. Clear the numbers so a failed reload
      // does not leave the previous filter's figures on screen as if they were current.
      loadFailed = true;
      sentimentStats = emptySentimentStats();
      totalPosts = 0;
      detailedSentiments = [];
      emotionStats = [];
      sentimentTrends = [];
      samplePosts = [];
      filteredPosts = [];
      loading = false;
    }
  }

  // Load filtered posts from database
  async function loadFilteredPosts() {
    try {
      const filters = {
        sentiment: selectedSentiment,
        platform: selectedPlatform,
        confidenceThreshold: confidenceThreshold,
        timeRange: timeRange
      };
      samplePosts = await sentimentAnalysisDb.getSamplePosts(filters, workspaceId || undefined);
    } catch (error) {
      console.error('Error loading filtered posts:', error);
    }
  }


  // Filters
  let selectedSentiment = 'all';
  let selectedPlatform = 'all';
  let confidenceThreshold = 0.7;
  let timeRange = '7d';
  let showEmotions = true;

  // Reactive statements for filter changes
  $: if (selectedSentiment || selectedPlatform || confidenceThreshold || timeRange) {
    if (!loading) {
      loadFilteredPosts();
      // Also reload trends if time range changed
      if (timeRange) {
        sentimentAnalysisDb.getSentimentTrends(timeRange, workspaceId || undefined).then(trends => {
          sentimentTrends = trends;
          updateTrendChart();
        });
      }
    }
  }

  // Filtered posts (for display purposes, actual filtering happens in database)
  $: filteredPosts = samplePosts;


  async function exportSentimentData() {
    try {
      const filters = {
        sentiment: selectedSentiment,
        platform: selectedPlatform,
        confidenceThreshold: confidenceThreshold,
        timeRange: timeRange
      };
      
      const exportData = await sentimentAnalysisDb.exportSentimentData(filters, workspaceId || undefined);
      
      // Create CSV from the exported data
      const csvData = (exportData as any).posts.map((post: any) =>
        `"${post.text}",${post.sentiment},${post.confidence},${post.emotions.join(';')},${post.platform},${post.timestamp}`
      ).join('\n');
      
      const header = 'Text,Sentiment,Confidence,Emotions,Platform,Timestamp\n';
      const csv = header + csvData;
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sentiment_analysis_report.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting sentiment data:', error);
      alert('Export failed: Database connection required');
    }
  }

  // Chart initialization
  let sentimentChart: any = null;
  let emotionChart: any = null;
  let trendChart: any = null;

  function initializeCharts() {
    initSentimentChart();
    initEmotionChart();
    initTrendChart();
  }

  function initSentimentChart() {
    const container = document.getElementById('sentiment-chart');
    if (!container) return;

    sentimentChart = initChart(container);
    if (!sentimentChart) return;
    updateSentimentChart();
  }

  function initEmotionChart() {
    const container = document.getElementById('emotion-chart');
    if (!container) return;

    emotionChart = initChart(container);
    if (!emotionChart) return;
    updateEmotionChart();
  }

  function initTrendChart() {
    const container = document.getElementById('trend-chart');
    if (!container) return;

    trendChart = initChart(container);
    if (!trendChart) return;
    updateTrendChart();
  }

  function updateSentimentChart() {
    if (!sentimentChart) return;

    const option = {
      title: {
        text: 'Sentiment Distribution',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} posts ({d}%)'
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: detailedSentiments.map(item => ({
          name: item.label,
          value: item.count,
          itemStyle: {
            color: item.color
          }
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%'
        }
      }]
    };

    sentimentChart.setOption(option);
    // Clicking a segment opens the posts behind it
    sentimentChart.off('click');
    sentimentChart.on('click', (params: { name?: string }) => {
      if (params?.name) drilldown = { title: `${params.name} posts`, filters: { sentiment: params.name, ...filtersFromParams(currentFilterParams) } };
    });
  }

  function updateEmotionChart() {
    if (!emotionChart) return;

    const option = {
      title: {
        text: 'Emotion Analysis',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      xAxis: {
        type: 'category',
        data: emotionStats.map(e => e.emotion),
        axisLabel: {
          rotate: 45
        }
      },
      yAxis: {
        type: 'value',
        name: 'Posts'
      },
      series: [{
        type: 'bar',
        data: emotionStats.map(e => ({
          value: e.count,
          itemStyle: {
            color: e.color
          }
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };

    emotionChart.setOption(option);
  }

  function updateTrendChart() {
    if (!trendChart) return;

    const dates = sentimentTrends.map(t => t.date);
    
    const option = {
      title: {
        text: 'Sentiment Trends Over Time',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['Positive', 'Negative', 'Neutral'],
        bottom: 10
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          formatter: function(value: any) {
            return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Percentage',
        max: 100
      },
      series: [
        {
          name: 'Positive',
          type: 'line',
          data: sentimentTrends.map(t => t.positive),
          itemStyle: { color: getSentimentColor('positive') },
          lineStyle: { width: 3 }
        },
        {
          name: 'Negative',
          type: 'line',
          data: sentimentTrends.map(t => t.negative),
          itemStyle: { color: getSentimentColor('negative') },
          lineStyle: { width: 3 }
        },
        {
          name: 'Neutral',
          type: 'line',
          data: sentimentTrends.map(t => t.neutral),
          itemStyle: { color: getSentimentColor('neutral') },
          lineStyle: { width: 3 }
        }
      ]
    };

    trendChart.setOption(option);
  }

  // Update charts when data changes
  $: if (sentimentChart && emotionChart && trendChart) {
    updateSentimentChart();
    updateEmotionChart();
    updateTrendChart();
  }
</script>

<svelte:head>
  <title>Sentiment Analysis - Text Analytics - Social Explorer</title>
  <meta name="description" content="AI-powered sentiment analysis and emotional tone classification for social media content" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <PageHeader
    title="Sentiment Analysis"
    subtitle="Analyze emotional tone and sentiment across social media posts with AI-powered classification"
    accentColor="emerald"
    backHref="/text-analytics">
    <svelte:fragment slot="icon">
      <div class="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="actions">
      <button
        on:click={exportSentimentData}
        class="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors border border-white/20 backdrop-blur-sm">
        Export Analysis
      </button>
    </svelte:fragment>
  </PageHeader>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <WorkspaceBanner workspaceId={workspaceId || ''} workspaceName="" />


    <!-- Data Source Filter -->
    <div class="mb-6">
      <FilterBar workspaceId={workspaceId} datasetTypes={["social_media"]} onReady={handleFilterReady} on:change={handleFilterChange} />
    </div>
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading sentiment analysis from database...</span>
      </div>
    {:else}

    {#if loadFailed}
      <div role="alert" class="mb-6 rounded-xl border border-danger-200 bg-danger-50 px-6 py-5">
        <p class="font-medium text-ink-900">We could not load sentiment data.</p>
        <p class="mt-1 text-sm text-ink-700">Check that the database is running, then change a filter or reload the page to try again.</p>
      </div>
    {:else if sentimentStats.positive.count + sentimentStats.negative.count + sentimentStats.neutral.count === 0}
      <div role="status" class="mb-6 rounded-xl border border-ink-200 bg-white px-6 py-5">
        <p class="font-medium text-ink-900">No posts match these filters.</p>
        <p class="mt-1 text-sm text-ink-600">Try a wider date range, or turn on more sources in the bar above.</p>
      </div>
    {/if}

    <!-- Overview Stats. The large figures use the darker very-positive and very-negative tones: the lighter ones fall below 3:1 on white. -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-sentiment-very-positive mb-1">{sentimentStats.positive.percentage}%</div>
        <div class="text-sm text-gray-600">Positive Sentiment</div>
        <div class="text-xs text-gray-500 mt-1">{sentimentStats.positive.count.toLocaleString()} posts</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-sentiment-very-negative mb-1">{sentimentStats.negative.percentage}%</div>
        <div class="text-sm text-gray-600">Negative Sentiment</div>
        <div class="text-xs text-gray-500 mt-1">{sentimentStats.negative.count.toLocaleString()} posts</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-gray-600 mb-1">{sentimentStats.neutral.percentage}%</div>
        <div class="text-sm text-gray-600">Neutral Sentiment</div>
        <div class="text-xs text-gray-500 mt-1">{sentimentStats.neutral.count.toLocaleString()} posts</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-emerald-600 mb-1">{sentimentStats.avgConfidence != null && sentimentStats.avgConfidence > 0 ? `${Math.round(sentimentStats.avgConfidence * 100)}%` : '\u2014'}</div>
        <div class="text-sm text-gray-600">Avg Confidence</div>
        <div class="text-xs text-gray-500 mt-1">AI Classification</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Analysis Filters</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Sentiment</label>
          <select bind:value={selectedSentiment} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="all">All Sentiments</option>
            <option value="Very Positive">Very Positive</option>
            <option value="Positive">Positive</option>
            <option value="Neutral">Neutral</option>
            <option value="Negative">Negative</option>
            <option value="Very Negative">Very Negative</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Min Confidence: {confidenceThreshold}</label>
          <input
            type="range"
            bind:value={confidenceThreshold}
            min="0.5"
            max="1"
            step="0.05"
            class="w-full h-2 bg-gray-200 rounded-xl appearance-none cursor-pointer">
        </div>
      </div>
      <p class="text-xs text-gray-400 mt-3">Data source and date range filters are in the bar above.</p>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8" class:hidden={loadFailed}>
      <!-- Sentiment Distribution Chart -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div id="sentiment-chart" class="w-full h-80"></div>
      </div>
      
      <!-- Emotion Analysis Chart -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div id="emotion-chart" class="w-full h-80"></div>
      </div>
      
      <!-- Sentiment Trends Chart -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div id="trend-chart" class="w-full h-80"></div>
      </div>
    </div>

    <!-- Sample Posts Analysis -->
    <div class="bg-white rounded-xl shadow-sm p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Post Analysis</h2>
        <span class="text-sm text-gray-500">{filteredPosts.length} posts shown</span>
      </div>
      
      <div class="space-y-4">
        {#each filteredPosts as post}
          <div class="border border-gray-200 rounded-xl p-4">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center space-x-3">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {post.platform}
                </span>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" 
                      style="background-color: {getSentimentColor(post.sentiment)}20; color: {getSentimentColor(post.sentiment)}">
                  {getSentimentIcon(post.sentiment)} {post.sentiment}
                </span>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                  {(post.confidence * 100).toFixed(1)}% confidence
                </span>
              </div>
              <span class="text-xs text-gray-500">{formatTimestamp(post.timestamp)}</span>
            </div>
            
            <p class="text-gray-900 mb-3">{post.text}</p>
            
            {#if showEmotions && post.emotions.length > 0}
              <div class="flex items-center space-x-2 mb-3">
                <span class="text-sm text-gray-600">Emotions:</span>
                {#each post.emotions as emotion}
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                    {emotion}
                  </span>
                {/each}
              </div>
            {/if}
            
            <div class="flex items-center justify-between text-xs text-gray-500">
              <span>Post ID: {post.id}</span>
              <div class="flex items-center space-x-4">
                <span>👍 {post.engagement.likes}</span>
                <span>🔄 {post.engagement.shares}</span>
                <span>💬 {post.engagement.comments}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
      
      {#if filteredPosts.length === 0}
        <div class="text-center py-8">
          <p class="text-gray-500">No posts match your current filters.</p>
        </div>
      {/if}
    </div>
    
    {/if}
  </div>
</div>

<PostDrilldown open={drilldown !== null} title={drilldown?.title ?? ''} filters={drilldown?.filters ?? {}} onclose={() => (drilldown = null)} />
