<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import { engagementAnalysisDb } from '$lib/services/engagementAnalysisDb';
  import { onMount } from 'svelte';
  
  // Loading state
  let loading = true;
  
  // Redirect to projects if no current project
  onMount(async () => {
    if (!$currentProject) {
      window.location.href = '/projects';
      return;
    }
    
    // Load engagement analysis data from database
    await loadEngagementAnalysisData();
  });

  // Engagement analysis data - loaded from database
  let engagementStats = {};
  let platformEngagement: any[] = [];
  let contentTypes: any[] = [];
  let engagementTrends: any[] = [];
  let topPosts: any[] = [];
  
  // Load engagement analysis data from database service
  async function loadEngagementAnalysisData() {
    try {
      // Load all engagement data from database service
      engagementStats = await engagementAnalysisDb.getEngagementStats();
      
      // Load data with current filters
      await loadFilteredData();
      
      console.log('Engagement analysis data loaded successfully from database');
      loading = false;
    } catch (error) {
      console.error('Error loading engagement analysis data:', error);
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
      
      platformEngagement = await engagementAnalysisDb.getPlatformEngagement(filters);
      contentTypes = await engagementAnalysisDb.getContentTypePerformance(filters);
      engagementTrends = await engagementAnalysisDb.getEngagementTrends(filters.timeRange);
      topPosts = await engagementAnalysisDb.getTopPerformingPosts(filters, 10);
    } catch (error) {
      console.error('Error loading filtered data:', error);
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
      { platform: 'Instagram', engagementRate: 6.8, totalEngagements: 156789, posts: 2341, avgLikes: 245, avgComments: 67, avgShares: 23, color: '#ff6b9d' },
      { platform: 'TikTok', engagementRate: 5.9, totalEngagements: 134567, posts: 1876, avgLikes: 387, avgComments: 89, avgShares: 45, color: '#667eea' },
      { platform: 'Twitter', engagementRate: 3.7, totalEngagements: 98765, posts: 4523, avgLikes: 89, avgComments: 23, avgShares: 156, color: '#26d0ce' },
      { platform: 'LinkedIn', engagementRate: 3.1, totalEngagements: 56789, posts: 1234, avgLikes: 167, avgComments: 34, avgShares: 78, color: '#6366f1' },
      { platform: 'Facebook', engagementRate: 2.8, totalEngagements: 34567, posts: 2987, avgLikes: 45, avgComments: 12, avgShares: 89, color: '#8b5cf6' },
      { platform: 'YouTube', engagementRate: 4.5, totalEngagements: 23456, posts: 234, avgLikes: 456, avgComments: 123, avgShares: 67, color: '#f72585' }
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
  let platformChart = null;
  let contentChart = null;
  let trendsChart = null;

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
    const icons = {
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
    const icons = {
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

  function exportEngagementData() {
    const csvData = topPosts.map(post => 
      `"${post.text}",${post.platform},${post.contentType},${post.engagement.likes},${post.engagement.comments},${post.engagement.shares},${post.engagement.rate},${post.reach},${post.timestamp}`
    ).join('\n');
    
    const header = 'Text,Platform,Content Type,Likes,Comments,Shares,Engagement Rate,Reach,Timestamp\n';
    const csv = header + csvData;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'engagement_analysis_report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Initialize charts after data is loaded
  $: if (!loading && platformEngagement.length > 0 && typeof window !== 'undefined') {
    initializeChartsWhenReady();
  }
  
  function initializeChartsWhenReady() {
    // Load ECharts from CDN if not already loaded
    if (!(window as any).echarts) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
      script.onload = () => {
        setTimeout(initializeCharts, 100); // Small delay to ensure DOM is ready
      };
      document.head.appendChild(script);
    } else {
      setTimeout(initializeCharts, 100); // Small delay to ensure DOM is ready
    }
  }

  function initializeCharts() {
    if (typeof window !== 'undefined' && (window as any).echarts) {
      initPlatformChart();
      initContentChart();
      initTrendsChart();
    }
  }

  function initPlatformChart() {
    const container = document.getElementById('platform-engagement-chart');
    if (!container) return;

    platformChart = (window as any).echarts.init(container);
    updatePlatformChart();
  }

  function initContentChart() {
    const container = document.getElementById('content-type-chart');
    if (!container) return;

    contentChart = (window as any).echarts.init(container);
    updateContentChart();
  }

  function initTrendsChart() {
    const container = document.getElementById('engagement-trends-chart');
    if (!container) return;

    trendsChart = (window as any).echarts.init(container);
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
            color: c.sentiment === 'positive' ? '#06d6a0' : 
                   c.sentiment === 'mixed' ? '#ffd23f' : '#8b5cf6'
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
          itemStyle: { color: '#6366f1' },
          lineStyle: { width: 3 }
        },
        {
          name: 'Comments',
          type: 'line',
          data: engagementTrends.map(t => t.comments),
          itemStyle: { color: '#06d6a0' },
          lineStyle: { width: 3 }
        },
        {
          name: 'Shares',
          type: 'line',
          data: engagementTrends.map(t => t.shares),
          itemStyle: { color: '#ff6b9d' },
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
  $: if (!loading && (selectedPlatform || selectedContentType || minEngagementRate || timeRange)) {
    loadFilteredData();
  }
</script>

<svelte:head>
  <title>Engagement Analysis - Text Analytics - Social Explorer</title>
  <meta name="description" content="Track likes, shares, comments, and engagement rates across all your social media content" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-cyan-900/10 to-slate-900/10 opacity-40"></div>
    
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
          <div class="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Engagement Analysis</h1>
            <p class="text-slate-300 text-lg font-medium">Track likes, shares, comments, and engagement rates across all your social media content</p>
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
            on:click={exportEngagementData}
            class="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors border border-white/20 backdrop-blur-sm">
            Export Analysis
          </button>
          <button 
            on:click={() => window.location.href='/text-analytics/research-investigation'}
            class="px-6 py-3 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg">
            Research Investigation
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading engagement analysis data from database...</span>
      </div>
    {:else}
    
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
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
          <select bind:value={timeRange} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500">
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
                  <div class="font-medium text-gray-900">{platform.platform}</div>
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