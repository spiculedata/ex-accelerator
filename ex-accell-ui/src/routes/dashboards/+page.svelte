<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  import { dashboardDb } from '$lib/services/dashboardDb';
  
  // Redirect to projects if no current project
  onMount(async () => {
    if (!$currentProject) {
      window.location.href = '/projects';
      return;
    }
    
    // Load data from database
    await loadDashboardData();
    
    // Auto refresh setup
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadDashboardData();
      }, refreshInterval * 1000);

      return () => clearInterval(interval);
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
  let dataSources = [];

  // Text analytics summary
  let textAnalytics = {
    sentimentBreakdown: {
      positive: { count: 0, percentage: 0 },
      negative: { count: 0, percentage: 0 },
      neutral: { count: 0, percentage: 0 }
    },
    topLanguages: [],
    topTopics: []
  };

  // Crawling activity data
  let crawlingActivity = [];

  // Recent activity feed
  let recentActivity = [];

  // Load all dashboard data from database
  async function loadDashboardData() {
    try {
      // Load dashboard stats
      const stats = await dashboardDb.getDashboardStats();
      dashboardStats = {
        totalPosts: stats.total_posts,
        totalSources: stats.total_sources,
        activeCrawlers: stats.active_crawlers,
        lastUpdated: stats.last_updated,
        processingRate: stats.processing_rate,
        dataQuality: stats.data_quality
      };
      
      // Load data sources
      dataSources = await dashboardDb.getDataSources();
      
      // Load sentiment breakdown
      const sentimentData = await dashboardDb.getSentimentBreakdown();
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
      textAnalytics.topLanguages = await dashboardDb.getTopLanguages();
      
      // Load top topics
      textAnalytics.topTopics = await dashboardDb.getTopTopics();
      
      // Load crawling activity
      crawlingActivity = await dashboardDb.getCrawlingActivity();
      
      // Load recent activity
      recentActivity = await dashboardDb.getRecentActivity();
      
      console.log('Dashboard data loaded successfully');
      
      // Initialize charts after data is loaded
      if (typeof window !== 'undefined' && (window as any).echarts) {
        setTimeout(() => {
          initializeCharts();
        }, 100);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // No fallback - dashboard requires database connection
      loading = false;
    }
  }


  // Time range filter
  let timeRange = '24h';
  let autoRefresh = true;
  let refreshInterval = 30; // seconds

  // Chart variables
  let sentimentChart = null;
  let sourceChart = null;
  let activityChart = null;
  let topicsChart = null;

  function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleString();
  }

  function getStatusColor(status: string) {
    const colors = {
      'active': 'bg-blue-100 text-blue-800',
      'paused': 'bg-yellow-100 text-yellow-800',
      'error': 'bg-red-100 text-red-800',
      'success': 'bg-blue-100 text-blue-800',
      'warning': 'bg-yellow-100 text-yellow-800',
      'info': 'bg-blue-100 text-blue-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  function getStatusIcon(status: string) {
    const icons = {
      'active': '🟢',
      'paused': '🟡',
      'error': '🔴',
      'success': '✅',
      'warning': '⚠️',
      'info': 'ℹ️'
    };
    return icons[status] || '●';
  }

  function getTrendIcon(trend: string) {
    const icons = {
      'up': '📈',
      'down': '📉',
      'stable': '➡️'
    };
    return icons[trend] || '➡️';
  }

  function getHealthColor(health: number) {
    if (health >= 95) return 'text-blue-600';
    if (health >= 90) return 'text-yellow-600';
    return 'text-red-600';
  }


  function initializeCharts() {
    if (typeof window !== 'undefined' && (window as any).echarts) {
      initSentimentChart();
      initSourceChart();
      initActivityChart();
      initTopicsChart();
    }
  }

  function initSentimentChart() {
    const container = document.getElementById('sentiment-overview-chart');
    if (!container) return;

    sentimentChart = (window as any).echarts.init(container);
    updateSentimentChart();
  }

  function initSourceChart() {
    const container = document.getElementById('source-breakdown-chart');
    if (!container) return;

    sourceChart = (window as any).echarts.init(container);
    updateSourceChart();
  }

  function initActivityChart() {
    const container = document.getElementById('activity-chart');
    if (!container) return;

    activityChart = (window as any).echarts.init(container);
    updateActivityChart();
  }

  function initTopicsChart() {
    const container = document.getElementById('topics-chart');
    if (!container) return;

    topicsChart = (window as any).echarts.init(container);
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
          formatter: function(value) {
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
        text: 'Crawling Activity (24h)',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: crawlingActivity.map(a => a.time)
      },
      yAxis: {
        type: 'value',
        name: 'Posts/hour'
      },
      series: [{
        type: 'line',
        data: crawlingActivity.map(a => a.posts),
        itemStyle: { color: '#06d6a0' },
        lineStyle: { 
          width: 3,
          shadowColor: 'rgba(6, 214, 160, 0.3)',
          shadowBlur: 8
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(6, 214, 160, 0.4)' },
              { offset: 1, color: 'rgba(6, 214, 160, 0.05)' }
            ]
          }
        },
      }]
    };

    activityChart.setOption(option);
  }

  function updateTopicsChart() {
    if (!topicsChart) return;

    const option = {
      title: {
        text: 'Top Topics',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      xAxis: {
        type: 'value'
      },
      yAxis: {
        type: 'category',
        data: textAnalytics.topTopics.map(t => t.topic),
        axisLabel: { fontSize: 10 }
      },
      series: [{
        type: 'bar',
        data: textAnalytics.topTopics.map(t => ({
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
        }
      }]
    };

    topicsChart.setOption(option);
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

<Navigation />

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
            <p class="text-slate-300 text-lg font-medium">Comprehensive analytics and insights across all your social media data sources</p>
            {#if $currentProject}
              <div class="flex items-center mt-3">
                <span class="text-sm text-slate-400">Project:</span>
                <span class="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                  {$currentProject.name}
                </span>
              </div>
            {/if}
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
        <div class="text-sm text-gray-600">Data Quality</div>
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
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Language Distribution</h2>
        <div class="space-y-4">
          {#each textAnalytics.topLanguages as language}
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
          <button class="text-sm text-blue-600 hover:text-blue-800">View Analysis</button>
        </div>
        <div class="space-y-4">
          {#each textAnalytics.topTopics as topic}
            <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
              <div class="flex items-center space-x-3">
                <span class="text-lg">{getTrendIcon(topic.trend)}</span>
                <div>
                  <div class="font-medium text-gray-900">{topic.topic}</div>
                  <div class="text-sm text-gray-500">{topic.posts.toLocaleString()} posts</div>
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
      </div>
    </div>
  </div>
</div>