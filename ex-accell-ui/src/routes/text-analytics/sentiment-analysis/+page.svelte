<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import { sentimentAnalysisDb } from '$lib/services/sentimentAnalysisDb';
  import { onMount } from 'svelte';
  
  // Loading state
  let loading = true;
  
  // Redirect to projects if no current project
  onMount(async () => {
    if (!$currentProject) {
      window.location.href = '/projects';
      return;
    }
    
    // Load sentiment analysis data from database
    await loadSentimentData();
  });

  // Comprehensive sentiment analysis data - loaded from database
  let sentimentStats = {
    positive: { count: 0, percentage: 0, confidence: 0 },
    negative: { count: 0, percentage: 0, confidence: 0 },
    neutral: { count: 0, percentage: 0, confidence: 0 }
  };

  let totalPosts = 0;

  // Detailed sentiment categories
  let detailedSentiments = [];

  // Emotion analysis data
  let emotionStats = [];

  // Sentiment over time data
  let sentimentTrends = [];

  // Sample posts with sentiment analysis
  let samplePosts = [];

  // Load sentiment analysis data from database service
  async function loadSentimentData() {
    try {
      // Load all sentiment data from database service
      const stats = await sentimentAnalysisDb.getSentimentStats();
      sentimentStats = stats;
      totalPosts = stats.total;
      
      detailedSentiments = await sentimentAnalysisDb.getDetailedSentiments();
      emotionStats = await sentimentAnalysisDb.getEmotionStats();
      sentimentTrends = await sentimentAnalysisDb.getSentimentTrends(timeRange);
      
      // Load posts with current filters
      await loadFilteredPosts();
      
      console.log('Sentiment analysis data loaded successfully from database');
      loading = false;
      
      // Initialize charts after data is loaded
      if (typeof window !== 'undefined' && (window as any).echarts) {
        setTimeout(() => {
          initializeCharts();
        }, 100);
      }
    } catch (error) {
      console.error('Error loading sentiment data:', error);
      // Fallback to sample data if database fails
      loadFallbackData();
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
      samplePosts = await sentimentAnalysisDb.getSamplePosts(filters);
    } catch (error) {
      console.error('Error loading filtered posts:', error);
    }
  }

  // Fallback sample data if database connection fails
  function loadFallbackData() {
    sentimentStats = {
      positive: { count: 15847, percentage: 52.8, confidence: 0.89 },
      negative: { count: 8234, percentage: 27.4, confidence: 0.91 },
      neutral: { count: 5947, percentage: 19.8, confidence: 0.85 }
    };

    totalPosts = sentimentStats.positive.count + sentimentStats.negative.count + sentimentStats.neutral.count;

    detailedSentiments = [
      { label: 'Very Positive', count: 6234, color: '#06d6a0', percentage: 20.8 },
      { label: 'Positive', count: 9613, color: '#26d0ce', percentage: 32.0 },
      { label: 'Neutral', count: 5947, color: '#8b5cf6', percentage: 19.8 },
      { label: 'Negative', count: 5890, color: '#ff6b9d', percentage: 19.6 },
      { label: 'Very Negative', count: 2344, color: '#f72585', percentage: 7.8 }
    ];

    emotionStats = [
      { emotion: 'Joy', count: 8234, percentage: 27.4, color: '#ffd23f' },
      { emotion: 'Trust', count: 6789, percentage: 22.6, color: '#06d6a0' },
      { emotion: 'Fear', count: 4567, percentage: 15.2, color: '#8b5cf6' },
      { emotion: 'Surprise', count: 3456, percentage: 11.5, color: '#26d0ce' },
      { emotion: 'Sadness', count: 3234, percentage: 10.8, color: '#667eea' },
      { emotion: 'Disgust', count: 2456, percentage: 8.2, color: '#f72585' },
      { emotion: 'Anger', count: 1292, percentage: 4.3, color: '#ff6b9d' }
    ];

    sentimentTrends = [
      { date: '2025-01-20', positive: 58, negative: 23, neutral: 19 },
      { date: '2025-01-21', positive: 62, negative: 20, neutral: 18 },
      { date: '2025-01-22', positive: 55, negative: 28, neutral: 17 },
      { date: '2025-01-23', positive: 49, negative: 35, neutral: 16 },
      { date: '2025-01-24', positive: 53, negative: 29, neutral: 18 },
      { date: '2025-01-25', positive: 61, negative: 22, neutral: 17 },
      { date: '2025-01-26', positive: 56, negative: 26, neutral: 18 },
      { date: '2025-01-27', positive: 53, negative: 27, neutral: 20 }
    ];

    samplePosts = [
      {
        id: 1,
        text: "This new product launch is absolutely incredible! Best decision I've ever made 🎉",
        sentiment: 'Very Positive',
        confidence: 0.94,
        emotions: ['Joy', 'Trust'],
        platform: 'twitter',
        timestamp: '2025-01-27T14:32:00Z',
        engagement: { likes: 24, shares: 8, comments: 12 }
      },
      {
        id: 2,
        text: "The customer service was helpful and resolved my issue quickly. Thank you!",
        sentiment: 'Positive',
        confidence: 0.87,
        emotions: ['Trust', 'Joy'],
        platform: 'facebook',
        timestamp: '2025-01-27T13:15:00Z',
        engagement: { likes: 15, shares: 3, comments: 5 }
      }
    ];

    loading = false;
    setTimeout(() => {
      initializeCharts();
    }, 100);
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
        sentimentAnalysisDb.getSentimentTrends(timeRange).then(trends => {
          sentimentTrends = trends;
          updateTrendChart();
        });
      }
    }
  }

  // Filtered posts (for display purposes, actual filtering happens in database)
  $: filteredPosts = samplePosts;

  function getSentimentColor(sentiment: string) {
    const colors = {
      'Very Positive': '#06d6a0',
      'Positive': '#26d0ce',
      'Neutral': '#8b5cf6',
      'Negative': '#ff6b9d',
      'Very Negative': '#f72585'
    };
    return colors[sentiment] || '#8b5cf6';
  }

  function getSentimentIcon(sentiment: string) {
    const icons = {
      'Very Positive': '😊',
      'Positive': '🙂',
      'Neutral': '😐',
      'Negative': '🙁',
      'Very Negative': '😡'
    };
    return icons[sentiment] || '😐';
  }

  function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleString();
  }

  async function exportSentimentData() {
    try {
      const filters = {
        sentiment: selectedSentiment,
        platform: selectedPlatform,
        confidenceThreshold: confidenceThreshold,
        timeRange: timeRange
      };
      
      const exportData = await sentimentAnalysisDb.exportSentimentData(filters);
      
      // Create CSV from the exported data
      const csvData = exportData.posts.map(post => 
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
      // Fallback to current data
      const csvData = filteredPosts.map(post => 
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
    }
  }

  // Chart initialization
  let sentimentChart = null;
  let emotionChart = null;
  let trendChart = null;

  // Load ECharts from CDN if not already loaded
  async function loadECharts() {
    if (typeof window !== 'undefined' && !(window as any).echarts) {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
        script.onload = () => resolve(true);
        document.head.appendChild(script);
      });
    }
  }

  function initializeCharts() {
    if (typeof window !== 'undefined' && (window as any).echarts) {
      initSentimentChart();
      initEmotionChart();
      initTrendChart();
    }
  }

  function initSentimentChart() {
    const container = document.getElementById('sentiment-chart');
    if (!container) return;

    sentimentChart = (window as any).echarts.init(container);
    updateSentimentChart();
  }

  function initEmotionChart() {
    const container = document.getElementById('emotion-chart');
    if (!container) return;

    emotionChart = (window as any).echarts.init(container);
    updateEmotionChart();
  }

  function initTrendChart() {
    const container = document.getElementById('trend-chart');
    if (!container) return;

    trendChart = (window as any).echarts.init(container);
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
          formatter: function(value) {
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
          itemStyle: { color: '#06d6a0' },
          lineStyle: { width: 3 }
        },
        {
          name: 'Negative',
          type: 'line',
          data: sentimentTrends.map(t => t.negative),
          itemStyle: { color: '#f72585' },
          lineStyle: { width: 3 }
        },
        {
          name: 'Neutral',
          type: 'line',
          data: sentimentTrends.map(t => t.neutral),
          itemStyle: { color: '#8b5cf6' },
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

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-emerald-900/10 to-slate-900/10 opacity-40"></div>
    
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
          <div class="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Sentiment Analysis</h1>
            <p class="text-slate-300 text-lg font-medium">Analyze emotional tone and sentiment across social media posts with AI-powered classification</p>
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
            on:click={exportSentimentData}
            class="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors border border-white/20 backdrop-blur-sm">
            Export Analysis
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading sentiment analysis from database...</span>
      </div>
    {:else}
    
    <!-- Overview Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-emerald-600 mb-1">{sentimentStats.positive.percentage}%</div>
        <div class="text-sm text-gray-600">Positive Sentiment</div>
        <div class="text-xs text-gray-500 mt-1">{sentimentStats.positive.count.toLocaleString()} posts</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-red-600 mb-1">{sentimentStats.negative.percentage}%</div>
        <div class="text-sm text-gray-600">Negative Sentiment</div>
        <div class="text-xs text-gray-500 mt-1">{sentimentStats.negative.count.toLocaleString()} posts</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-gray-600 mb-1">{sentimentStats.neutral.percentage}%</div>
        <div class="text-sm text-gray-600">Neutral Sentiment</div>
        <div class="text-xs text-gray-500 mt-1">{sentimentStats.neutral.count.toLocaleString()} posts</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-emerald-600 mb-1">{Math.round((sentimentStats.avgConfidence || 0.89) * 100)}%</div>
        <div class="text-sm text-gray-600">Avg Confidence</div>
        <div class="text-xs text-gray-500 mt-1">AI Classification</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Analysis Filters</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <label class="block text-sm font-medium text-gray-700 mb-2">Platform</label>
          <select bind:value={selectedPlatform} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="all">All Platforms</option>
            <option value="twitter">Twitter</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="reddit">Reddit</option>
            <option value="linkedin">LinkedIn</option>
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
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
          <select bind:value={timeRange} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
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