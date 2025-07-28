<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  
  // Redirect to projects if no current project
  onMount(() => {
    if (!$currentProject) {
      window.location.href = '/projects';
    }
  });

  // Hashtag analysis data
  let hashtagStats = {
    totalHashtags: 15847,
    trendingHashtags: 342,
    totalReach: 2456789,
    averageEngagement: 4.7
  };

  // Top trending hashtags
  let trendingHashtags = [
    { 
      hashtag: '#AI', 
      count: 12847, 
      reach: 456789, 
      engagement: 8.4, 
      sentiment: 'positive',
      trend: 'up',
      platforms: ['twitter', 'linkedin', 'instagram'],
      growth: 45.2
    },
    { 
      hashtag: '#ClimateChange', 
      count: 8934, 
      reach: 234567, 
      engagement: 6.2, 
      sentiment: 'mixed',
      trend: 'up',
      platforms: ['twitter', 'facebook', 'reddit'],
      growth: 23.1
    },
    { 
      hashtag: '#Technology', 
      count: 7456, 
      reach: 189234, 
      engagement: 5.8, 
      sentiment: 'positive',
      trend: 'stable',
      platforms: ['twitter', 'linkedin'],
      growth: 2.4
    },
    { 
      hashtag: '#Crypto', 
      count: 6789, 
      reach: 167892, 
      engagement: 7.1, 
      sentiment: 'negative',
      trend: 'down',
      platforms: ['twitter', 'reddit'],
      growth: -15.3
    },
    { 
      hashtag: '#Health', 
      count: 5623, 
      reach: 123456, 
      engagement: 4.9, 
      sentiment: 'positive',
      trend: 'up',
      platforms: ['facebook', 'instagram', 'twitter'],
      growth: 18.7
    },
    { 
      hashtag: '#Sustainability', 
      count: 4567, 
      reach: 98765, 
      engagement: 6.8, 
      sentiment: 'positive',
      trend: 'up',
      platforms: ['linkedin', 'instagram'],
      growth: 34.2
    },
    { 
      hashtag: '#Innovation', 
      count: 3890, 
      reach: 87654, 
      engagement: 5.3, 
      sentiment: 'positive',
      trend: 'stable',
      platforms: ['linkedin', 'twitter'],
      growth: 5.1
    },
    { 
      hashtag: '#Marketing', 
      count: 3456, 
      reach: 76543, 
      engagement: 4.2, 
      sentiment: 'neutral',
      trend: 'down',
      platforms: ['linkedin', 'instagram', 'facebook'],
      growth: -8.9
    }
  ];

  // Hashtag performance over time
  let hashtagTrends = [
    { date: '2025-01-20', aiCount: 8234, climateCount: 5678, techCount: 6123 },
    { date: '2025-01-21', aiCount: 9456, climateCount: 6234, techCount: 6456 },
    { date: '2025-01-22', aiCount: 10234, climateCount: 7123, techCount: 6789 },
    { date: '2025-01-23', aiCount: 11567, climateCount: 7890, techCount: 7234 },
    { date: '2025-01-24', aiCount: 11890, climateCount: 8234, techCount: 7456 },
    { date: '2025-01-25', aiCount: 12456, climateCount: 8567, techCount: 7123 },
    { date: '2025-01-26', aiCount: 12789, climateCount: 8890, techCount: 7345 },
    { date: '2025-01-27', aiCount: 12847, climateCount: 8934, techCount: 7456 }
  ];

  // Sample posts with hashtags
  let samplePosts = [
    {
      id: 1,
      text: "The future of #AI is here! Incredible breakthrough in machine learning algorithms 🚀 #Technology #Innovation",
      hashtags: ['#AI', '#Technology', '#Innovation'],
      platform: 'twitter',
      engagement: { likes: 245, shares: 89, comments: 34 },
      reach: 12567,
      timestamp: '2025-01-27T14:32:00Z'
    },
    {
      id: 2,
      text: "Taking action on #ClimateChange is more important than ever. Here's what we can do 🌍 #Sustainability #Environment",
      hashtags: ['#ClimateChange', '#Sustainability', '#Environment'],
      platform: 'linkedin',
      engagement: { likes: 156, shares: 67, comments: 23 },
      reach: 8945,
      timestamp: '2025-01-27T13:15:00Z'
    },
    {
      id: 3,
      text: "Just launched our new #Health app! Excited to help people live better lives 💪 #HealthTech #Wellness",
      hashtags: ['#Health', '#HealthTech', '#Wellness'],
      platform: 'instagram',
      engagement: { likes: 89, shares: 23, comments: 12 },
      reach: 4567,
      timestamp: '2025-01-27T12:45:00Z'
    },
    {
      id: 4,
      text: "#Crypto market showing volatility again. Important to stay informed and invest wisely 📈 #Bitcoin #Investing",
      hashtags: ['#Crypto', '#Bitcoin', '#Investing'],
      platform: 'reddit',
      engagement: { likes: 234, shares: 45, comments: 78 },
      reach: 6789,
      timestamp: '2025-01-27T11:20:00Z'
    }
  ];

  // Filters
  let selectedPlatform = 'all';
  let selectedSentiment = 'all';
  let selectedTrend = 'all';
  let timeRange = '7d';
  let minEngagement = 0;

  // Charts
  let trendChart = null;
  let engagementChart = null;
  let reachChart = null;

  // Filtered hashtags
  $: filteredHashtags = trendingHashtags.filter(hashtag => {
    const matchesPlatform = selectedPlatform === 'all' || hashtag.platforms.includes(selectedPlatform);
    const matchesSentiment = selectedSentiment === 'all' || hashtag.sentiment === selectedSentiment;
    const matchesTrend = selectedTrend === 'all' || hashtag.trend === selectedTrend;
    const matchesEngagement = hashtag.engagement >= minEngagement;
    return matchesPlatform && matchesSentiment && matchesTrend && matchesEngagement;
  });

  function getSentimentColor(sentiment: string) {
    const colors = {
      'positive': 'bg-green-100 text-green-800',
      'negative': 'bg-red-100 text-red-800',
      'neutral': 'bg-gray-100 text-gray-800',
      'mixed': 'bg-yellow-100 text-yellow-800'
    };
    return colors[sentiment] || 'bg-gray-100 text-gray-800';
  }

  function getTrendIcon(trend: string) {
    const icons = {
      'up': '📈',
      'down': '📉',
      'stable': '➡️'
    };
    return icons[trend] || '➡️';
  }

  function getTrendColor(trend: string) {
    const colors = {
      'up': 'text-green-600',
      'down': 'text-red-600',
      'stable': 'text-gray-600'
    };
    return colors[trend] || 'text-gray-600';
  }

  function getPlatformIcon(platform: string) {
    const icons = {
      'twitter': '🐦',
      'facebook': '📘',
      'instagram': '📷',
      'linkedin': '💼',
      'reddit': '🤖',
      'tiktok': '🎵'
    };
    return icons[platform] || '📱';
  }

  function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleString();
  }

  function exportHashtagData() {
    const csvData = filteredHashtags.map(hashtag => 
      `${hashtag.hashtag},${hashtag.count},${hashtag.reach},${hashtag.engagement},${hashtag.sentiment},${hashtag.trend},${hashtag.platforms.join(';')},${hashtag.growth}`
    ).join('\n');
    
    const header = 'Hashtag,Count,Reach,Engagement Rate,Sentiment,Trend,Platforms,Growth %\n';
    const csv = header + csvData;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hashtag_analysis_report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Chart initialization
  onMount(async () => {
    // Load ECharts from CDN
    if (typeof window !== 'undefined' && !(window as any).echarts) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
      script.onload = () => {
        initializeCharts();
      };
      document.head.appendChild(script);
    } else if ((window as any).echarts) {
      initializeCharts();
    }
  });

  function initializeCharts() {
    if (typeof window !== 'undefined' && (window as any).echarts) {
      initTrendChart();
      initEngagementChart();
      initReachChart();
    }
  }

  function initTrendChart() {
    const container = document.getElementById('hashtag-trend-chart');
    if (!container) return;

    trendChart = (window as any).echarts.init(container);
    updateTrendChart();
  }

  function initEngagementChart() {
    const container = document.getElementById('engagement-chart');
    if (!container) return;

    engagementChart = (window as any).echarts.init(container);
    updateEngagementChart();
  }

  function initReachChart() {
    const container = document.getElementById('reach-chart');
    if (!container) return;

    reachChart = (window as any).echarts.init(container);
    updateReachChart();
  }

  function updateTrendChart() {
    if (!trendChart) return;

    const dates = hashtagTrends.map(t => new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    const option = {
      title: {
        text: 'Hashtag Trends Over Time',
        left: 'center',
        textStyle: { fontSize: 16, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['#AI', '#ClimateChange', '#Technology'],
        bottom: 10
      },
      xAxis: {
        type: 'category',
        data: dates
      },
      yAxis: {
        type: 'value',
        name: 'Posts'
      },
      series: [
        {
          name: '#AI',
          type: 'line',
          data: hashtagTrends.map(t => t.aiCount),
          itemStyle: { color: '#6366f1' },
          lineStyle: { width: 3 }
        },
        {
          name: '#ClimateChange',
          type: 'line',
          data: hashtagTrends.map(t => t.climateCount),
          itemStyle: { color: '#06d6a0' },
          lineStyle: { width: 3 }
        },
        {
          name: '#Technology',
          type: 'line',
          data: hashtagTrends.map(t => t.techCount),
          itemStyle: { color: '#ff6b9d' },
          lineStyle: { width: 3 }
        }
      ]
    };

    trendChart.setOption(option);
  }

  function updateEngagementChart() {
    if (!engagementChart) return;

    const option = {
      title: {
        text: 'Engagement Rate by Hashtag',
        left: 'center',
        textStyle: { fontSize: 16, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      xAxis: {
        type: 'category',
        data: filteredHashtags.map(h => h.hashtag),
        axisLabel: { rotate: 45 }
      },
      yAxis: {
        type: 'value',
        name: 'Engagement Rate (%)'
      },
      series: [{
        type: 'bar',
        data: filteredHashtags.map(h => ({
          value: h.engagement,
          itemStyle: {
            color: h.sentiment === 'positive' ? '#06d6a0' : 
                   h.sentiment === 'negative' ? '#f72585' : 
                   h.sentiment === 'mixed' ? '#ffd23f' : '#8b5cf6'
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

    engagementChart.setOption(option);
  }

  function updateReachChart() {
    if (!reachChart) return;

    const option = {
      title: {
        text: 'Hashtag Reach Distribution',
        left: 'center',
        textStyle: { fontSize: 16, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: filteredHashtags.slice(0, 6).map(h => ({
          name: h.hashtag,
          value: h.reach,
          itemStyle: {
            color: h.sentiment === 'positive' ? '#06d6a0' : 
                   h.sentiment === 'negative' ? '#f72585' : 
                   h.sentiment === 'mixed' ? '#ffd23f' : '#8b5cf6'
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

    reachChart.setOption(option);
  }

  // Update charts when data changes
  $: if (trendChart && engagementChart && reachChart && filteredHashtags) {
    updateTrendChart();
    updateEngagementChart();
    updateReachChart();
  }
</script>

<svelte:head>
  <title>Hashtag Analysis - Text Analytics - Social Explorer</title>
  <meta name="description" content="Analyze trending hashtags, their reach, and impact across social media platforms" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-pink-900 to-slate-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-pink-900/10 to-slate-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <button 
            on:click={() => window.location.href='/text-analytics'}
            class="mr-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors backdrop-blur-sm">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div class="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Hashtag Analysis</h1>
            <p class="text-slate-300 text-lg font-medium">Analyze trending hashtags, their reach, and impact across social media platforms</p>
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
          <button 
            on:click={exportHashtagData}
            class="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors border border-white/20 backdrop-blur-sm">
            Export Analysis
          </button>
          <button 
            on:click={() => window.location.href='/text-analytics/research-investigation'}
            class="px-6 py-3 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg">
            Research Investigation
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <!-- Overview Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-pink-600 mb-1">{hashtagStats.totalHashtags.toLocaleString()}</div>
        <div class="text-sm text-gray-600">Total Hashtags</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-green-600 mb-1">{hashtagStats.trendingHashtags}</div>
        <div class="text-sm text-gray-600">Trending Now</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-purple-600 mb-1">{hashtagStats.totalReach.toLocaleString()}</div>
        <div class="text-sm text-gray-600">Total Reach</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-orange-600 mb-1">{hashtagStats.averageEngagement}%</div>
        <div class="text-sm text-gray-600">Avg Engagement</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Analysis Filters</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Platform</label>
          <select bind:value={selectedPlatform} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500">
            <option value="all">All Platforms</option>
            <option value="twitter">Twitter</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
            <option value="reddit">Reddit</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Sentiment</label>
          <select bind:value={selectedSentiment} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500">
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="neutral">Neutral</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Trend</label>
          <select bind:value={selectedTrend} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500">
            <option value="all">All Trends</option>
            <option value="up">Trending Up</option>
            <option value="down">Trending Down</option>
            <option value="stable">Stable</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Min Engagement: {minEngagement}%</label>
          <input 
            type="range" 
            bind:value={minEngagement}
            min="0" 
            max="10" 
            step="0.5"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
          <select bind:value={timeRange} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500">
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
      <!-- Hashtag Trends Chart -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <div id="hashtag-trend-chart" class="w-full h-80"></div>
      </div>
      
      <!-- Engagement Chart -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <div id="engagement-chart" class="w-full h-80"></div>
      </div>
      
      <!-- Reach Distribution Chart -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <div id="reach-chart" class="w-full h-80"></div>
      </div>
    </div>

    <!-- Trending Hashtags Table -->
    <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Trending Hashtags</h2>
        <span class="text-sm text-gray-500">{filteredHashtags.length} hashtags</span>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hashtag</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reach</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engagement</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sentiment</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platforms</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredHashtags.slice(0, 20) as hashtag}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <span class="text-lg mr-2">#</span>
                    <div class="text-sm font-medium text-gray-900">{hashtag.hashtag.slice(1)}</div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {hashtag.count.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {hashtag.reach.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                      <div class="bg-pink-600 h-2 rounded-full" style="width: {hashtag.engagement * 10}%"></div>
                    </div>
                    <span class="text-sm text-gray-500">{hashtag.engagement}%</span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getSentimentColor(hashtag.sentiment)}">
                    {hashtag.sentiment}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <span class="mr-2">{getTrendIcon(hashtag.trend)}</span>
                    <span class="text-sm {getTrendColor(hashtag.trend)} font-medium">
                      {hashtag.growth > 0 ? '+' : ''}{hashtag.growth.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex space-x-2">
                    {#each hashtag.platforms.slice(0, 3) as platform}
                      <span title={platform} class="text-lg">{getPlatformIcon(platform)}</span>
                    {/each}
                    {#if hashtag.platforms.length > 3}
                      <span class="text-xs text-gray-500">+{hashtag.platforms.length - 3}</span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Sample Posts -->
    <div class="bg-white rounded-lg shadow-sm p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Recent Posts with Hashtags</h2>
        <span class="text-sm text-gray-500">{samplePosts.length} posts shown</span>
      </div>
      
      <div class="space-y-4">
        {#each samplePosts as post}
          <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center space-x-3">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {getPlatformIcon(post.platform)} {post.platform}
                </span>
                <span class="text-xs text-gray-500">Reach: {post.reach.toLocaleString()}</span>
              </div>
              <span class="text-xs text-gray-500">{formatTimestamp(post.timestamp)}</span>
            </div>
            
            <p class="text-gray-900 mb-3">{post.text}</p>
            
            <div class="flex items-center justify-between">
              <div class="flex flex-wrap gap-2">
                {#each post.hashtags as hashtag}
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800">
                    {hashtag}
                  </span>
                {/each}
              </div>
              
              <div class="flex items-center space-x-4 text-xs text-gray-500">
                <span>👍 {post.engagement.likes}</span>
                <span>🔄 {post.engagement.shares}</span>
                <span>💬 {post.engagement.comments}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>