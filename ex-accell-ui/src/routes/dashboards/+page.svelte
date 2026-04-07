<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentProject } from '$lib/stores/projectStore';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { dashboardDb } from '$lib/services/dashboardDb';
  import { ErrorAlert } from '$lib/components/ui';
  import { getStatusColor, getStatusIcon, getTrendIcon, getHealthColor } from '$lib/utils/colorUtils';
  import { formatTimestamp, formatNumber } from '$lib/utils/formatUtils';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';
  import WorkspaceBanner from '$lib/components/ui/WorkspaceBanner.svelte';
  import { setWorkspaceFromUrl } from '$lib/stores/workspaceStore';

  // Get workspace ID from URL query parameter
  $: workspaceId = $page.url.searchParams.get('workspace');

  let loading = true;
  let errorMessage = '';
  let workspace: any = null;

  // Load workspace data and set project context if needed
  onMount(async () => {
    // If workspace ID provided, load workspace and set project
    if (workspaceId) {
      try {
        const response = await fetch(`/api/workspaces?id=${workspaceId}`);
        const result = await response.json();

        if (result.success && result.workspace) {
          workspace = result.workspace;

          // If no current project, load the workspace's project
          if (!$currentProject && workspace.project_id) {
            const { setCurrentProject } = await import('$lib/stores/projectStore');
            await setCurrentProject(workspace.project_id.toString());
          }
        }
      } catch (error) {
        console.error('Error loading workspace:', error);
        errorMessage = 'Failed to load workspace data. Please try again.';
      }
    }

    // Set workspace store from URL
    await setWorkspaceFromUrl($page.url);

    // Load data from database — shows all data when no workspace is scoped
    await loadDashboardData();

    // Auto refresh setup
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadDashboardData();
      }, refreshInterval * 1000);

      // Return cleanup function (assigned to avoid TypeScript async return type mismatch)
      return (() => clearInterval(interval)) as any;
    }
  });

  // Dashboard overview data
  let dashboardStats = {
    totalPosts: 0,
    totalSources: 0,
    activeCrawlers: 0,
    lastUpdated: '',
    processingRate: 0,
    dataQuality: 0
  };

  // Data source breakdown
  let dataSources: any[] = [];

  // Text analytics summary
  let textAnalytics: any = {
    sentimentBreakdown: {
      positive: { count: 0, percentage: 0 },
      negative: { count: 0, percentage: 0 },
      neutral: { count: 0, percentage: 0 }
    },
    topLanguages: [],
    topTopics: []
  };

  // Crawling activity data
  let crawlingActivity: any[] = [];

  // Recent activity feed
  let recentActivity: any[] = [];

  // Platform filter — users can toggle which data sources are visible
  let availablePlatforms: string[] = [];
  let activePlatforms: Set<string> = new Set();
  let languagesLimit = 5;
  let topicsLimit = 5;

  $: filteredSources = dataSources.filter(s => activePlatforms.size === 0 || activePlatforms.has(s.name.toLowerCase()));

  // Load all dashboard data from database
  async function loadDashboardData() {
    try {
      // Load dashboard stats
      const stats = await dashboardDb.getDashboardStats(workspaceId || undefined);
      dashboardStats = {
        totalPosts: stats.total_posts,
        totalSources: stats.total_sources,
        activeCrawlers: stats.active_crawlers,
        lastUpdated: stats.last_updated,
        processingRate: stats.processing_rate,
        dataQuality: stats.data_quality
      };

      // Load data sources
      dataSources = await dashboardDb.getDataSources(workspaceId || undefined);

      // Build platform filter from loaded sources
      availablePlatforms = dataSources.map(s => s.name);
      activePlatforms = new Set(availablePlatforms.map(p => p.toLowerCase()));

      // Load sentiment breakdown
      const sentimentData = await dashboardDb.getSentimentBreakdown(workspaceId || undefined);
      sentimentData.forEach(item => {
        if (item.sentiment === 'positive') {
          textAnalytics.sentimentBreakdown.positive = { count: item.count, percentage: item.percentage };
        } else if (item.sentiment === 'negative') {
          textAnalytics.sentimentBreakdown.negative = { count: item.count, percentage: item.percentage };
        } else if (item.sentiment === 'neutral') {
          textAnalytics.sentimentBreakdown.neutral = { count: item.count, percentage: item.percentage };
        }
      });

      // Load top languages
      textAnalytics.topLanguages = await dashboardDb.getTopLanguages(workspaceId || undefined);

      // Load top topics
      textAnalytics.topTopics = await dashboardDb.getTopTopics(workspaceId || undefined);

      // Load crawling activity
      crawlingActivity = await dashboardDb.getCrawlingActivity(workspaceId || undefined);

      // Load recent activity
      recentActivity = await dashboardDb.getRecentActivity(workspaceId || undefined);
      
      console.log('Dashboard data loaded successfully');
      loading = false;

      // Initialize charts after data is loaded
      try {
        await waitForEcharts();
        initializeCharts();
      } catch (e) {
        console.error('Charts unavailable:', e);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      errorMessage = 'Failed to load dashboard data. Please try again.';
      loading = false;
    }
  }


  // Time range filter
  let timeRange = '24h';
  let autoRefresh = true;
  let refreshInterval = 30; // seconds

  // Chart variables
  let sentimentChart: any = null;
  let sourceChart: any = null;
  let activityChart: any = null;
  let topicsChart: any = null;

  function initializeCharts() {
    initSentimentChart();
    initSourceChart();
    initActivityChart();
    initTopicsChart();
  }

  function initSentimentChart() {
    const container = document.getElementById('sentiment-overview-chart');
    if (!container) return;

    sentimentChart = initChart(container);
    if (!sentimentChart) return;
    updateSentimentChart();
  }

  function initSourceChart() {
    const container = document.getElementById('source-breakdown-chart');
    if (!container) return;

    sourceChart = initChart(container);
    if (!sourceChart) return;
    updateSourceChart();
  }

  function initActivityChart() {
    const container = document.getElementById('activity-chart');
    if (!container) return;

    activityChart = initChart(container);
    if (!activityChart) return;
    updateActivityChart();
  }

  function initTopicsChart() {
    const container = document.getElementById('topics-chart');
    if (!container) return;

    topicsChart = initChart(container);
    if (!topicsChart) return;
    updateTopicsChart();
  }

  function updateSentimentChart() {
    if (!sentimentChart) return;

    const option = {
      title: {
        text: 'Sentiment Overview',
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
        data: [
          { name: 'Positive', value: textAnalytics.sentimentBreakdown.positive.count, itemStyle: { color: '#06d6a0' } },
          { name: 'Negative', value: textAnalytics.sentimentBreakdown.negative.count, itemStyle: { color: '#f72585' } },
          { name: 'Neutral', value: textAnalytics.sentimentBreakdown.neutral.count, itemStyle: { color: '#8b5cf6' } }
        ],
        label: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };

    sentimentChart.setOption(option);
  }

  function updateSourceChart() {
    if (!sourceChart) return;

    const option = {
      title: {
        text: 'Data Sources',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      xAxis: {
        type: 'category',
        data: dataSources.map(s => s.name),
        axisLabel: { rotate: 45, fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        name: 'Posts (K)',
        axisLabel: {
          formatter: function(value: any) {
            return (value / 1000).toFixed(0) + 'K';
          }
        }
      },
      series: [{
        type: 'bar',
        data: dataSources.map((s, index) => ({
          value: s.posts,
          itemStyle: {
            color: s.status === 'active' ? 
              ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d946ef', '#e879f9', '#f0abfc'][index % 7] : 
              '#f59e0b'
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

    sourceChart.setOption(option);
  }

  function updateActivityChart() {
    if (!activityChart) return;

    const option = {
      title: {
        text: 'Sentiment by Hour',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['Positive', 'Negative', 'Neutral'],
        bottom: 0,
        textStyle: { fontSize: 11 }
      },
      grid: {
        left: 50,
        right: 20,
        top: 40,
        bottom: 40
      },
      xAxis: {
        type: 'category',
        data: crawlingActivity.map(a => a.time),
        axisLabel: { fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        name: 'Posts',
        axisLabel: { fontSize: 10 }
      },
      series: [
        {
          name: 'Positive',
          type: 'line',
          data: crawlingActivity.map(a => a.positive),
          itemStyle: { color: '#06d6a0' },
          lineStyle: { width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(6, 214, 160, 0.3)' },
                { offset: 1, color: 'rgba(6, 214, 160, 0.02)' }
              ]
            }
          },
          smooth: true
        },
        {
          name: 'Negative',
          type: 'line',
          data: crawlingActivity.map(a => a.negative),
          itemStyle: { color: '#f72585' },
          lineStyle: { width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(247, 37, 133, 0.3)' },
                { offset: 1, color: 'rgba(247, 37, 133, 0.02)' }
              ]
            }
          },
          smooth: true
        },
        {
          name: 'Neutral',
          type: 'line',
          data: crawlingActivity.map(a => a.neutral),
          itemStyle: { color: '#8b5cf6' },
          lineStyle: { width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
                { offset: 1, color: 'rgba(139, 92, 246, 0.02)' }
              ]
            }
          },
          smooth: true
        }
      ]
    };

    activityChart.setOption(option);
  }

  function updateTopicsChart() {
    if (!topicsChart) return;

    const fullNames = textAnalytics.topTopics.map((t: any) => t.topic);

    const option = {
      title: {
        text: 'Top Topics',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function(params: any) {
          const idx = params[0]?.dataIndex;
          const fullName = fullNames[idx] || '';
          return `<strong>${fullName}</strong><br/>${params[0]?.value} posts`;
        }
      },
      grid: {
        left: 10,
        right: 50,
        top: 40,
        bottom: 20,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 10 }
      },
      yAxis: {
        type: 'category',
        data: fullNames,
        axisLabel: {
          fontSize: 11,
          width: 220,
          overflow: 'truncate',
          ellipsis: '...',
        },
        axisTick: { show: false },
        axisLine: { show: false },
        triggerEvent: true
      },
      series: [{
        type: 'bar',
        data: textAnalytics.topTopics.map((t: any) => ({
          value: t.posts,
          itemStyle: {
            color: t.trend === 'up' ? '#06d6a0' : t.trend === 'down' ? '#f72585' : '#8b5cf6'
          }
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        barMaxWidth: 30,
        label: {
          show: true,
          position: 'right',
          fontSize: 10,
          color: '#666'
        }
      }]
    };

    topicsChart.setOption(option);

    // Add tooltip on y-axis label hover
    topicsChart.on('mouseover', function(params: any) {
      if (params.componentType === 'yAxis') {
        const idx = params.dataIndex;
        const name = fullNames[idx] || '';
        const posts = textAnalytics.topTopics[idx]?.posts || 0;
        topicsChart.dispatchAction({
          type: 'showTip',
          seriesIndex: 0,
          dataIndex: idx
        });
      }
    });
  }

  // Update charts when data changes
  $: if (sentimentChart && sourceChart && activityChart && topicsChart) {
    updateSentimentChart();
    updateSourceChart();
    updateActivityChart();
    updateTopicsChart();
  }
</script>

<svelte:head>
  <title>Interactive Dashboards - Social Explorer</title>
  <meta name="description" content="Comprehensive analytics dashboard for social media data insights and monitoring" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-slate-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-16 h-16 bg-gradient-to-br from-violet-400 to-blue-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Interactive Dashboards</h1>
            <p class="text-slate-300 text-lg font-medium">
              {workspaceId ? 'Workspace-scoped analytics and insights' : 'Comprehensive analytics and insights across all your social media data sources'}
            </p>
            <div class="flex items-center mt-3 space-x-3">
              {#if $currentProject}
                <div class="flex items-center">
                  <span class="text-sm text-slate-400">Project:</span>
                  <span class="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                    {$currentProject.name}
                  </span>
                </div>
              {/if}
              {#if workspaceId && workspace}
                <div class="flex items-center">
                  <span class="text-sm text-slate-400">Workspace:</span>
                  <span class="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 backdrop-blur-sm">
                    {workspace.name}
                  </span>
                </div>
              {/if}
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-3 bg-white/10 rounded-xl px-4 py-3 border border-white/20 backdrop-blur-sm">
            <span class="text-sm text-slate-300 font-medium">Auto-refresh:</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" bind:checked={autoRefresh} class="sr-only peer">
              <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-md peer-checked:bg-gradient-to-r peer-checked:from-violet-500 peer-checked:to-blue-600"></div>
            </label>
          </div>
          <select bind:value={timeRange} class="px-4 py-3 bg-white/10 border border-white/20 backdrop-blur-sm rounded-xl text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400/50">
            <option value="1h" class="bg-slate-800 text-white">Last Hour</option>
            <option value="24h" class="bg-slate-800 text-white">Last 24 Hours</option>
            <option value="7d" class="bg-slate-800 text-white">Last 7 Days</option>
            <option value="30d" class="bg-slate-800 text-white">Last 30 Days</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

    <WorkspaceBanner
      workspaceId={workspaceId || ''}
      workspaceName={workspace?.name || ''}
      projectName={$currentProject?.name || ''}
    />

    <!-- Platform Filter -->
    {#if dataSources.length > 1}
      <div class="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-700">Filter by source:</span>
          <div class="flex flex-wrap gap-2">
            {#each dataSources as source}
              <button
                on:click={() => {
                  const key = source.name.toLowerCase();
                  if (activePlatforms.has(key)) {
                    activePlatforms.delete(key);
                  } else {
                    activePlatforms.add(key);
                  }
                  activePlatforms = new Set(activePlatforms);
                }}
                class="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors {
                  activePlatforms.has(source.name.toLowerCase())
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-gray-50 text-gray-400 border-gray-200 line-through'
                }">
                {source.name} ({source.posts})
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Key Metrics Overview -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{dashboardStats.totalPosts.toLocaleString()}</div>
        <div class="text-sm text-gray-600">Total Posts</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{dashboardStats.totalSources}</div>
        <div class="text-sm text-gray-600">Data Sources</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{dashboardStats.activeCrawlers}</div>
        <div class="text-sm text-gray-600">Active Crawlers</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{dashboardStats.processingRate.toLocaleString()}</div>
        <div class="text-sm text-gray-600">Posts/Hour</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-indigo-600 mb-1">{dashboardStats.dataQuality}%</div>
        <div class="text-sm text-gray-600" title="Percentage of posts with sentiment classification">Enrichment Rate</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-xs text-gray-500 mb-1">Last Updated</div>
        <div class="text-sm font-medium text-gray-900">{formatTimestamp(dashboardStats.lastUpdated).split(',')[1]}</div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
      <!-- Sentiment Overview Chart -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div id="sentiment-overview-chart" class="w-full h-80"></div>
      </div>
      
      <!-- Data Sources Chart -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div id="source-breakdown-chart" class="w-full h-80"></div>
      </div>
      
      <!-- Activity Chart -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div id="activity-chart" class="w-full h-80"></div>
      </div>
      
      <!-- Top Topics Chart -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div id="topics-chart" class="w-full h-80"></div>
      </div>
    </div>

    <!-- Data Sources Status & Language Breakdown -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
      <!-- Data Sources Status -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Data Sources Status</h2>
        <div class="space-y-4">
          {#each dataSources as source}
            <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                  <span class="text-blue-600 font-medium text-sm">{source.name.charAt(0)}</span>
                </div>
                <div>
                  <div class="font-medium text-gray-900">{source.name}</div>
                  <div class="text-sm text-gray-500">{source.posts.toLocaleString()} posts ({source.percentage}%)</div>
                </div>
              </div>
              <div class="flex items-center space-x-3">
                <div class="text-right">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(source.status)}">
                    {getStatusIcon(source.status)} {source.status}
                  </span>
                  <div class="text-xs text-gray-500 mt-1">Health: <span class="{getHealthColor(source.health)}">{source.health}%</span></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Language Breakdown -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-gray-900">Language Distribution</h2>
          <select bind:value={languagesLimit} class="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600">
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={100}>All</option>
          </select>
        </div>
        <div class="space-y-4">
          {#each textAnalytics.topLanguages.slice(0, languagesLimit) as language}
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 bg-blue-600 rounded-full"></div>
                <span class="font-medium text-gray-900">{language.language}</span>
              </div>
              <div class="flex items-center space-x-3">
                <div class="text-right">
                  <div class="font-semibold text-gray-900">{language.percentage}%</div>
                  <div class="text-xs text-gray-500">{language.count.toLocaleString()} posts</div>
                </div>
                <div class="w-24 bg-gray-200 rounded-full h-2">
                  <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {language.percentage}%"></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Recent Activity & Top Topics -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <!-- Recent Activity Feed -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <button class="text-sm text-blue-600 hover:text-blue-800">View All</button>
        </div>
        <div class="space-y-4">
          {#each recentActivity as activity}
            <div class="flex items-start space-x-3">
              <div class="flex-shrink-0">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(activity.status)}">
                  {getStatusIcon(activity.status)}
                </span>
              </div>
              <div class="flex-1">
                <p class="text-sm text-gray-900">{activity.message}</p>
                <p class="text-xs text-gray-500 mt-1">{formatTimestamp(activity.timestamp)}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Top Topics with Trends -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-gray-900">Trending Topics</h2>
          <div class="flex items-center space-x-2">
            <select bind:value={topicsLimit} class="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600">
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
            </select>
            <button on:click={() => goto('/text-analytics/topic-modeling')} class="text-sm text-blue-600 hover:text-blue-800">View Analysis</button>
          </div>
        </div>
        {#if textAnalytics.topTopics.length === 0}
          <div class="text-center py-8 text-gray-400">
            <span class="text-3xl mb-2 block">💬</span>
            <p class="text-sm">No social post topics yet.</p>
            <p class="text-xs mt-1">Topics will appear after running topic analysis on social posts.</p>
            <button on:click={() => goto('/text-analytics/topic-modeling')} class="text-xs text-blue-600 hover:text-blue-800 mt-2">Go to Topic Modeling</button>
          </div>
        {:else}
        <div class="space-y-4">
          {#each textAnalytics.topTopics.slice(0, topicsLimit) as topic}
            <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
              <div class="flex items-center space-x-3">
                <span class="text-lg">{getTrendIcon(topic.trend)}</span>
                <div>
                  <div class="font-medium text-gray-900">{topic.topic}</div>
                  <div class="text-sm text-gray-500">{formatNumber(topic.posts)} posts</div>
                </div>
              </div>
              <div class="text-right">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {
                  topic.trend === 'up' ? 'bg-blue-100 text-blue-800' : 
                  topic.trend === 'down' ? 'bg-red-100 text-red-800' : 
                  'bg-gray-100 text-gray-800'
                }">
                  {topic.trend}
                </span>
              </div>
            </div>
          {/each}
        </div>
        {/if}
      </div>
    </div>
  </div>
</div>