<script lang="ts">
  import { CHART } from '$lib/utils/chartColors';
  import { goto } from '$app/navigation';
  import FilterBar from '$lib/components/ui/FilterBar.svelte';
  import { page } from '$app/stores';
  import { currentProject } from '$lib/stores/projectStore';
  import { engagementAnalysisDb } from '$lib/services/engagementAnalysisDb';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import WorkspaceBanner from '$lib/components/ui/WorkspaceBanner.svelte';
  import { onMount } from 'svelte';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';
  import { ErrorAlert } from '$lib/components/ui';
  import { runExport, downloadCsv, IDLE_EXPORT, type ExportState } from '$lib/utils/exportAction';
  import { toCsv } from '$lib/utils/evidenceExport';
  import ExportStatus from '$lib/components/ui/ExportStatus.svelte';
  import { rangeReloader } from '$lib/utils/filterRange';
  import { getSentimentColor } from '$lib/utils/colorUtils';
  import PostDrilldown from '$lib/components/ui/PostDrilldown.svelte';
  import { filtersFromParams, type PostFilters } from '$lib/services/postsApi';

  $: workspaceId = $page.url.searchParams.get('workspace');

  let currentFilterParams: Record<string, string> = {};

  // The platform whose posts were chosen; they open in the side panel
  let drilldown: { title: string; filters: PostFilters } | null = null;
  function openPlatformPosts(platform: string) {
    drilldown = {
      title: `${platform} posts`,
      filters: { ...filtersFromParams({ ...(workspaceId ? { workspace_id: workspaceId } : {}), ...currentFilterParams }), platforms: [platform.toLowerCase()] }
    };
  }

  function handleFilterChange(event: CustomEvent) {
    const detail = event.detail || {};
    currentFilterParams = {};
    if (detail.workspaceId) currentFilterParams.workspace_id = detail.workspaceId;
    currentFilterParams.platforms = (detail.platforms || []).join(',');
    if (detail.dateStart) currentFilterParams.date_start = detail.dateStart;
    if (detail.dateEnd) currentFilterParams.date_end = detail.dateEnd;
    // A new date range changes every figure on the page; the reloader makes sure the newest range wins
    rangeSync.sync();
  }
  const rangeSync = rangeReloader(loadEngagementAnalysisData, () => loading);
  
  // Loading state
  let loading = true;
  let errorMessage = '';

  onMount(async () => {
    // Load engagement analysis data from database
    rangeSync.markLoaded();
    await loadEngagementAnalysisData();
    await rangeSync.sync();
  });

  // Engagement analysis data - loaded from database
  let engagementStats: any = {};
  let platformEngagement: any[] = [];
  let contentTypes: any[] = [];
  let engagementTrends: any[] = [];
  let topPosts: any[] = [];
  
  // Load engagement analysis data from database service
  async function loadEngagementAnalysisData() {
    try {
      // Load all engagement data from database service
      engagementStats = await engagementAnalysisDb.getEngagementStats(workspaceId || undefined);
      
      // Load data with current filters
      await loadFilteredData();
      
      console.log('Engagement analysis data loaded successfully from database');
      loading = false;
    } catch (error) {
      console.error('Error loading engagement analysis data:', error);
      errorMessage = 'Failed to load engagement data. Showing sample data.';
      // Fallback to sample data if database fails
      loadFallbackData();
    }
  }
  
  // Load filtered data from database
  async function loadFilteredData() {
    try {
      const filters = {
        platform: selectedPlatform,
        contentType: selectedContentType,
        minEngagementRate: minEngagementRate,
        timeRange: timeRange
      };
      
      platformEngagement = await engagementAnalysisDb.getPlatformEngagement(filters, workspaceId || undefined);
      contentTypes = await engagementAnalysisDb.getContentTypePerformance(filters, workspaceId || undefined);
      engagementTrends = await engagementAnalysisDb.getEngagementTrends(filters.timeRange, workspaceId || undefined);
      topPosts = await engagementAnalysisDb.getTopPerformingPosts(filters, 10, workspaceId || undefined);
    } catch (error) {
      console.error('Error loading filtered data:', error);
      errorMessage = 'Failed to load filtered engagement data. Please try again.';
    }
  }
  
  // Fallback sample data if database connection fails
  function loadFallbackData() {
    engagementStats = {
      totalEngagements: 487293,
      averageRate: 4.2,
      totalReach: 12456789,
      bestPerformingPost: 24567
    };

    platformEngagement = [
      { platform: 'Instagram', engagementRate: 6.8, totalEngagements: 156789, posts: 2341, avgLikes: 245, avgComments: 67, avgShares: 23, color: CHART.catPink },
      { platform: 'TikTok', engagementRate: 5.9, totalEngagements: 134567, posts: 1876, avgLikes: 387, avgComments: 89, avgShares: 45, color: CHART.ink900 },
      { platform: 'Twitter', engagementRate: 3.7, totalEngagements: 98765, posts: 4523, avgLikes: 89, avgComments: 23, avgShares: 156, color: CHART.catSky },
      { platform: 'LinkedIn', engagementRate: 3.1, totalEngagements: 56789, posts: 1234, avgLikes: 167, avgComments: 34, avgShares: 78, color: CHART.catBlue },
      { platform: 'Facebook', engagementRate: 2.8, totalEngagements: 34567, posts: 2987, avgLikes: 45, avgComments: 12, avgShares: 89, color: CHART.catOrange },
      { platform: 'YouTube', engagementRate: 4.5, totalEngagements: 23456, posts: 234, avgLikes: 456, avgComments: 123, avgShares: 67, color: CHART.catVermilion }
    ];

    contentTypes = [
      { type: 'Video', engagementRate: 7.2, posts: 2341, reach: 1234567, sentiment: 'positive' },
      { type: 'Image', engagementRate: 5.1, posts: 4567, reach: 987654, sentiment: 'positive' },
      { type: 'Carousel', engagementRate: 6.8, posts: 1234, reach: 765432, sentiment: 'positive' },
      { type: 'Story', engagementRate: 4.9, posts: 3456, reach: 654321, sentiment: 'mixed' },
      { type: 'Text Only', engagementRate: 2.1, posts: 5678, reach: 432109, sentiment: 'neutral' },
      { type: 'Link', engagementRate: 1.8, posts: 2987, reach: 321098, sentiment: 'neutral' }
    ];

    engagementTrends = [
      { date: '2025-01-20', likes: 12456, comments: 3456, shares: 1234 },
      { date: '2025-01-21', likes: 13567, comments: 3789, shares: 1456 },
      { date: '2025-01-22', likes: 11234, comments: 3234, shares: 1123 },
      { date: '2025-01-23', likes: 14789, comments: 4123, shares: 1567 },
      { date: '2025-01-24', likes: 13890, comments: 3890, shares: 1390 },
      { date: '2025-01-25', likes: 15234, comments: 4234, shares: 1678 },
      { date: '2025-01-26', likes: 14567, comments: 4067, shares: 1545 },
      { date: '2025-01-27', likes: 16123, comments: 4456, shares: 1789 }
    ];

    topPosts = [
      { id: 1, text: "Just launched our new AI-powered feature! 🚀 What do you think?", platform: 'Instagram', contentType: 'Video', engagement: { likes: 2456, comments: 345, shares: 123, rate: 8.4 }, reach: 45678, timestamp: '2025-01-27T14:32:00Z' },
      { id: 2, text: "Behind the scenes of our latest product development 💡", platform: 'TikTok', contentType: 'Video', engagement: { likes: 1987, comments: 287, shares: 98, rate: 7.2 }, reach: 34567, timestamp: '2025-01-27T13:15:00Z' },
      { id: 3, text: "5 tips for improving your workflow efficiency 📈", platform: 'LinkedIn', contentType: 'Carousel', engagement: { likes: 1234, comments: 156, shares: 234, rate: 6.8 }, reach: 23456, timestamp: '2025-01-27T12:45:00Z' },
      { id: 4, text: "Customer success story: How we helped increase ROI by 150%", platform: 'Twitter', contentType: 'Image', engagement: { likes: 987, comments: 67, shares: 189, rate: 5.9 }, reach: 18765, timestamp: '2025-01-27T11:20:00Z' }
    ];
    
    loading = false;
  }

  // Filters
  let selectedPlatform = 'all';
  let selectedContentType = 'all';
  let timeRange = '7d';
  let minEngagementRate = 0;

  // Charts
  let platformChart: any = null;
  let contentChart: any = null;
  let trendsChart: any = null;

  // Filtered data
  $: filteredPlatforms = platformEngagement.filter(platform => {
    return selectedPlatform === 'all' || platform.platform === selectedPlatform;
  });

  $: filteredContent = contentTypes.filter(content => {
    const matchesType = selectedContentType === 'all' || content.type === selectedContentType;
    const matchesRate = content.engagementRate >= minEngagementRate;
    return matchesType && matchesRate;
  });

  function getPlatformIcon(platform: string) {
    const icons: Record<string, string> = {
      'Instagram': '📷',
      'TikTok': '🎵',
      'Twitter': '🐦',
      'LinkedIn': '💼',
      'Facebook': '📘',
      'YouTube': '📺'
    };
    return icons[platform] || '📱';
  }

  function getContentTypeIcon(type: string) {
    const icons: Record<string, string> = {
      'Video': '🎥',
      'Image': '🖼️',
      'Carousel': '🎠',
      'Story': '📖',
      'Text Only': '📝',
      'Link': '🔗'
    };
    return icons[type] || '📱';
  }

  function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleString();
  }

  let exportState: ExportState = IDLE_EXPORT;

  // Exports the top posts as listed
  function exportEngagementData() {
    return runExport(async () => {
      const rows = topPosts.map((post) => ({
        text: post.text,
        platform: post.platform,
        contentType: post.contentType,
        likes: post.engagement?.likes,
        comments: post.engagement?.comments,
        shares: post.engagement?.shares,
        rate: post.engagement?.rate,
        reach: post.reach,
        timestamp: post.timestamp
      }));
      downloadCsv('engagement_analysis_report.csv', toCsv(rows, ['text', 'platform', 'contentType', 'likes', 'comments', 'shares', 'rate', 'reach', 'timestamp']));
      return { rows: rows.length };
    }, (state) => (exportState = state));
  }

  // Initialize charts after data is loaded
  $: if (!loading && platformEngagement.length > 0 && typeof window !== 'undefined') {
    initializeChartsWhenReady();
  }

  async function initializeChartsWhenReady() {
    try {
      await waitForEcharts();
      initializeCharts();
    } catch (e) {
      console.error('Charts unavailable:', e);
    }
  }

  function initializeCharts() {
    initPlatformChart();
    initContentChart();
    initTrendsChart();
  }

  function initPlatformChart() {
    const container = document.getElementById('platform-engagement-chart');
    if (!container) return;

    platformChart = initChart(container);
    if (!platformChart) return;
    updatePlatformChart();
  }

  function initContentChart() {
    const container = document.getElementById('content-type-chart');
    if (!container) return;

    contentChart = initChart(container);
    if (!contentChart) return;
    updateContentChart();
  }

  function initTrendsChart() {
    const container = document.getElementById('engagement-trends-chart');
    if (!container) return;

    trendsChart = initChart(container);
    if (!trendsChart) return;
    updateTrendsChart();
  }

  function updatePlatformChart() {
    if (!platformChart || !filteredPlatforms || filteredPlatforms.length === 0) return;

    const option = {
      title: {
        text: 'Engagement Rate by Platform',
        left: 'center',
        textStyle: { fontSize: 16, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      xAxis: {
        type: 'category',
        data: filteredPlatforms.map(p => p.platform),
        axisLabel: { rotate: 45 }
      },
      yAxis: {
        type: 'value',
        name: 'Engagement Rate (%)'
      },
      series: [{
        type: 'bar',
        data: filteredPlatforms.map(p => ({
          value: p.engagementRate,
          itemStyle: { color: p.color }
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };

    platformChart.setOption(option);
  }

  function updateContentChart() {
    if (!contentChart || !filteredContent || filteredContent.length === 0) return;

    const option = {
      title: {
        text: 'Content Type Performance',
        left: 'center',
        textStyle: { fontSize: 16, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}% ({d}%)'
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: filteredContent.map(c => ({
          name: c.type,
          value: c.engagementRate,
          itemStyle: {
            color: getSentimentColor(c.sentiment === 'mixed' ? 'neutral' : c.sentiment)
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
          formatter: '{b}\n{c}%'
        }
      }]
    };

    contentChart.setOption(option);
  }

  function updateTrendsChart() {
    if (!trendsChart || !engagementTrends || engagementTrends.length === 0) return;

    const dates = engagementTrends.map(t => new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    const option = {
      title: {
        text: 'Engagement Trends Over Time',
        left: 'center',
        textStyle: { fontSize: 16, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['Likes', 'Comments', 'Shares'],
        bottom: 10
      },
      xAxis: {
        type: 'category',
        data: dates
      },
      yAxis: {
        type: 'value',
        name: 'Count'
      },
      series: [
        {
          name: 'Likes',
          type: 'line',
          data: engagementTrends.map(t => t.likes),
          itemStyle: { color: CHART.primary600 },
          lineStyle: { width: 3 }
        },
        {
          name: 'Comments',
          type: 'line',
          data: engagementTrends.map(t => t.comments),
          itemStyle: { color: CHART.catGreen },
          lineStyle: { width: 3 }
        },
        {
          name: 'Shares',
          type: 'line',
          data: engagementTrends.map(t => t.shares),
          itemStyle: { color: CHART.catPink },
          lineStyle: { width: 3 }
        }
      ]
    };

    trendsChart.setOption(option);
  }

  // Update charts when data changes
  $: if (platformChart && contentChart && trendsChart && !loading && platformEngagement.length > 0) {
    updatePlatformChart();
    updateContentChart();
    updateTrendsChart();
  }

  // Watch for filter changes and reload data
  $: if (!loading && (selectedPlatform || selectedContentType || minEngagementRate)) {
    loadFilteredData();
  }
</script>

<svelte:head>
  <title>Engagement Analysis - Text Analytics - Social Explorer</title>
  <meta name="description" content="Track likes, shares, comments, and engagement rates across all your social media content" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <PageHeader
    title="Engagement Analysis"
    subtitle="Likes, shares, comments and engagement rates across your content"
    backHref="/text-analytics">
    <svelte:fragment slot="actions">
      <button
        on:click={exportEngagementData}
        class="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors border border-white/20 backdrop-blur-sm">
        Export Analysis
      </button>
      <button
        on:click={() => goto('/text-analytics/research-investigation')}
        class="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors border border-white/20 backdrop-blur-sm">
        Research Notebooks
      </button>
    </svelte:fragment>
  </PageHeader>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <WorkspaceBanner workspaceId={workspaceId || ''} workspaceName="" />
    <ExportStatus state={exportState} />


    <!-- Data Source Filter -->
    <div class="mb-6">
      <FilterBar workspaceId={workspaceId} datasetTypes={["social_media"]} on:change={handleFilterChange} />
    </div>
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading engagement analysis data from database...</span>
      </div>
    {:else}
    {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

    <!-- Overview Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-cyan-600 mb-1">{engagementStats.totalEngagements ? engagementStats.totalEngagements.toLocaleString() : '0'}</div>
        <div class="text-sm text-gray-600">Total Engagements</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{engagementStats.averageRate || 0}%</div>
        <div class="text-sm text-gray-600">Average Rate</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{engagementStats.totalReach ? engagementStats.totalReach.toLocaleString() : '0'}</div>
        <div class="text-sm text-gray-600">Total Reach</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{engagementStats.bestPerformingPost ? engagementStats.bestPerformingPost.toLocaleString() : '0'}</div>
        <div class="text-sm text-gray-600">Best Post Engagements</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Analysis Filters</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Platform</label>
          <select bind:value={selectedPlatform} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500">
            <option value="all">All Platforms</option>
            {#each platformEngagement as platform}
              <option value={platform.platform}>{platform.platform}</option>
            {/each}
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
          <select bind:value={selectedContentType} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500">
            <option value="all">All Content Types</option>
            {#each contentTypes as content}
              <option value={content.type}>{content.type}</option>
            {/each}
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Min Engagement Rate: {minEngagementRate}%</label>
          <input 
            type="range" 
            bind:value={minEngagementRate}
            min="0" 
            max="10" 
            step="0.5"
            class="w-full h-2 bg-gray-200 rounded-xl appearance-none cursor-pointer">
        </div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
      <!-- Platform Engagement Chart -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div id="platform-engagement-chart" class="w-full h-80"></div>
      </div>
      
      <!-- Content Type Chart -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div id="content-type-chart" class="w-full h-80"></div>
      </div>
      
      <!-- Engagement Trends Chart -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div id="engagement-trends-chart" class="w-full h-80"></div>
      </div>
    </div>

    <!-- Platform Performance & Content Types -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
      <!-- Platform Performance -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Platform Performance</h2>
        <div class="space-y-4">
          {#each filteredPlatforms as platform}
            <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background-color: {platform.color}20;">
                  <span class="text-lg">{getPlatformIcon(platform.platform)}</span>
                </div>
                <div>
                  <div class="font-medium text-gray-900">
                    <button type="button" class="hover:text-primary-700 hover:underline" on:click={() => openPlatformPosts(platform.platform)}>{platform.platform}</button>
                  </div>
                  <div class="text-sm text-gray-500">{platform.posts.toLocaleString()} posts</div>
                </div>
              </div>
              <div class="text-right">
                <div class="font-semibold text-gray-900">{platform.engagementRate}%</div>
                <div class="text-xs text-gray-500">{platform.totalEngagements.toLocaleString()} engagements</div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Content Type Performance -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Content Type Performance</h2>
        <div class="space-y-4">
          {#each filteredContent as content}
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <span class="text-lg">{getContentTypeIcon(content.type)}</span>
                <div>
                  <div class="font-medium text-gray-900">{content.type}</div>
                  <div class="text-sm text-gray-500">{content.posts.toLocaleString()} posts</div>
                </div>
              </div>
              <div class="flex items-center space-x-3">
                <div class="text-right">
                  <div class="font-semibold text-gray-900">{content.engagementRate}%</div>
                  <div class="text-xs text-gray-500">Reach: {content.reach.toLocaleString()}</div>
                </div>
                <div class="w-24 bg-gray-200 rounded-full h-2">
                  <div class="bg-cyan-600 h-2 rounded-full transition-all duration-300" style="width: {Math.min(100, content.engagementRate * 10)}%"></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Top Performing Posts -->
    <div class="bg-white rounded-xl shadow-sm p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Top Performing Posts</h2>
        <span class="text-sm text-gray-500">{topPosts.length} posts shown</span>
      </div>
      
      <div class="space-y-4">
        {#each topPosts as post}
          <div class="border border-gray-200 rounded-xl p-4">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center space-x-3">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {getPlatformIcon(post.platform)} {post.platform}
                </span>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {getContentTypeIcon(post.contentType)} {post.contentType}
                </span>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {post.engagement.rate}% engagement
                </span>
              </div>
              <span class="text-xs text-gray-500">{formatTimestamp(post.timestamp)}</span>
            </div>
            
            <p class="text-gray-900 mb-3">{post.text}</p>
            
            <div class="flex items-center justify-between">
              <div class="text-xs text-gray-500">
                Reach: {post.reach.toLocaleString()}
              </div>
              
              <div class="flex items-center space-x-4 text-xs text-gray-500">
                <span>👍 {post.engagement.likes.toLocaleString()}</span>
                <span>💬 {post.engagement.comments}</span>
                <span>🔄 {post.engagement.shares}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
    
    {/if}
  </div>
</div>

<PostDrilldown open={drilldown !== null} title={drilldown?.title ?? ''} filters={drilldown?.filters ?? {}} onclose={() => (drilldown = null)} />
