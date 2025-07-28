<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  // Redirect to projects if no current project
  onMount(() => {
    if (!$currentProject) {
      window.location.href = '/projects';
    }
  });

  // Type definitions for connected analytics
  interface DataPoint {
    id: string;
    timestamp: Date;
    platform: string;
    engagement: number;
    sentiment: number;
    reach: number;
    hashtags: string[];
    topics: string[];
    author_influence: number;
    content_type: string;
    geographic_region: string;
    viral_coefficient: number;
  }

  interface SelectedData {
    dataPoints: DataPoint[];
    timeRange: [Date, Date] | null;
    platforms: string[];
    sentimentRange: [number, number] | null;
    topics: string[];
    regions: string[];
  }

  // Chart instances
  let timeSeriesChart: any = null;
  let sentimentDistChart: any = null;
  let platformCompChart: any = null;
  let topicNetworkChart: any = null;
  let geographicChart: any = null;
  let correlationChart: any = null;

  // Global selection state - this connects all views
  let globalSelection: SelectedData = {
    dataPoints: [],
    timeRange: null,
    platforms: [],
    sentimentRange: null,
    topics: [],
    regions: []
  };

  // Mock social media data with correlations
  let socialMediaData: DataPoint[] = [];
  
  // Generate comprehensive interconnected social media data
  function generateSocialMediaData(): DataPoint[] {
    const platforms = ['Twitter', 'Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube'];
    const topics = ['Technology', 'Health', 'Politics', 'Entertainment', 'Sports', 'Business', 'Education', 'Environment'];
    const contentTypes = ['text', 'image', 'video', 'story', 'live', 'poll'];
    const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East', 'Africa'];
    const hashtags = ['#viral', '#trending', '#breaking', '#innovation', '#lifestyle', '#news', '#tech', '#ai', '#climate', '#health'];
    
    const data: DataPoint[] = [];
    const now = new Date();
    
    // Generate 2000 interconnected data points over the last 30 days
    for (let i = 0; i < 2000; i++) {
      const timestamp = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const region = regions[Math.floor(Math.random() * regions.length)];
      const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
      
      // Create correlations between different metrics
      const baseEngagement = Math.random() * 1000;
      const platformMultiplier = platform === 'TikTok' || platform === 'Instagram' ? 2.5 : 
                                platform === 'Twitter' ? 1.8 : 
                                platform === 'Facebook' ? 1.5 : 1.0;
      
      const contentMultiplier = contentType === 'video' ? 3.0 : 
                               contentType === 'image' ? 2.0 : 
                               contentType === 'live' ? 2.5 : 1.0;
      
      const engagement = baseEngagement * platformMultiplier * contentMultiplier;
      
      // Sentiment correlates with engagement (positive content tends to engage more)
      const baseSentiment = (Math.random() - 0.3) * 2; // Slight positive bias
      const sentimentBoost = engagement > 500 ? 0.3 : 0;
      const sentiment = Math.max(-1, Math.min(1, baseSentiment + sentimentBoost));
      
      // Reach correlates with engagement and author influence
      const authorInfluence = Math.random() * 100;
      const reach = engagement * (1 + authorInfluence / 100) * (Math.random() * 0.5 + 0.75);
      
      // Viral coefficient based on engagement rate and platform
      const viral_coefficient = Math.min(10, (engagement / reach) * platformMultiplier * 100);
      
      // Select relevant hashtags based on topic
      const selectedHashtags = hashtags
        .filter(() => Math.random() > 0.7)
        .slice(0, Math.floor(Math.random() * 4) + 1);
      
      data.push({
        id: `post_${i}`,
        timestamp,
        platform,
        engagement,
        sentiment,
        reach,
        hashtags: selectedHashtags,
        topics: [topic],
        author_influence: authorInfluence,
        content_type: contentType,
        geographic_region: region,
        viral_coefficient
      });
    }
    
    return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Initialize data
  onMount(() => {
    if (browser) {
      socialMediaData = generateSocialMediaData();
      setTimeout(() => {
        initializeAllCharts();
      }, 100);
    }
  });

  // Chart initialization functions
  function initializeAllCharts() {
    if (!browser || typeof window === 'undefined') return;
    
    // Wait for echarts to load if not available yet
    if (!(window as any).echarts) {
      setTimeout(initializeAllCharts, 100);
      return;
    }
    
    initTimeSeriesChart();
    initSentimentDistribution();
    initPlatformComparison();
    initTopicNetwork();
    initGeographicMap();
    initCorrelationMatrix();
  }

  function initTimeSeriesChart() {
    const container = document.getElementById('timeseries-chart');
    if (!container) return;
    
    timeSeriesChart = (window as any).echarts.init(container);
    updateTimeSeriesChart();
    
    // Add brush selection for time range
    timeSeriesChart.on('brush', function(params: any) {
      if (params.areas && params.areas.length > 0) {
        const area = params.areas[0];
        const startTime = new Date(area.coordRange[0]);
        const endTime = new Date(area.coordRange[1]);
        updateGlobalSelection({ timeRange: [startTime, endTime] });
      }
    });
  }

  function initSentimentDistribution() {
    const container = document.getElementById('sentiment-chart');
    if (!container) return;
    
    sentimentDistChart = (window as any).echarts.init(container);
    updateSentimentChart();
    
    // Add click selection for sentiment ranges
    sentimentDistChart.on('click', function(params: any) {
      const sentimentValue = params.value[0];
      const range: [number, number] = [sentimentValue - 0.1, sentimentValue + 0.1];
      updateGlobalSelection({ sentimentRange: range });
    });
  }

  function initPlatformComparison() {
    const container = document.getElementById('platform-chart');
    if (!container) return;
    
    platformCompChart = (window as any).echarts.init(container);
    updatePlatformChart();
    
    // Add platform selection
    platformCompChart.on('click', function(params: any) {
      const platform = params.name;
      const currentPlatforms = globalSelection.platforms.includes(platform) 
        ? globalSelection.platforms.filter(p => p !== platform)
        : [...globalSelection.platforms, platform];
      updateGlobalSelection({ platforms: currentPlatforms });
    });
  }

  function initTopicNetwork() {
    const container = document.getElementById('topic-chart');
    if (!container) return;
    
    topicNetworkChart = (window as any).echarts.init(container);
    updateTopicChart();
    
    // Add topic selection
    topicNetworkChart.on('click', function(params: any) {
      if (params.dataType === 'node') {
        const topic = params.name;
        const currentTopics = globalSelection.topics.includes(topic)
          ? globalSelection.topics.filter(t => t !== topic)
          : [...globalSelection.topics, topic];
        updateGlobalSelection({ topics: currentTopics });
      }
    });
  }

  function initGeographicMap() {
    const container = document.getElementById('geographic-chart');
    if (!container) return;
    
    geographicChart = (window as any).echarts.init(container);
    updateGeographicChart();
    
    // Add region selection
    geographicChart.on('click', function(params: any) {
      const region = params.name;
      const currentRegions = globalSelection.regions.includes(region)
        ? globalSelection.regions.filter(r => r !== region)
        : [...globalSelection.regions, region];
      updateGlobalSelection({ regions: currentRegions });
    });
  }

  function initCorrelationMatrix() {
    const container = document.getElementById('correlation-chart');
    if (!container) return;
    
    correlationChart = (window as any).echarts.init(container);
    updateCorrelationMatrix();
  }

  // Update functions for each chart
  function updateTimeSeriesChart() {
    if (!timeSeriesChart) return;
    
    const filteredData = getFilteredData();
    
    // Group data by platform and day
    const platformData: { [key: string]: { [key: string]: number } } = {};
    
    filteredData.forEach(point => {
      const dateKey = point.timestamp.toISOString().split('T')[0];
      if (!platformData[point.platform]) {
        platformData[point.platform] = {};
      }
      if (!platformData[point.platform][dateKey]) {
        platformData[point.platform][dateKey] = 0;
      }
      platformData[point.platform][dateKey] += point.engagement;
    });
    
    const series = Object.keys(platformData).map(platform => ({
      name: platform,
      type: 'line',
      data: Object.entries(platformData[platform]).map(([date, engagement]) => [date, engagement]),
      smooth: false,
      lineStyle: { width: 2 },
      emphasis: { lineStyle: { width: 4 } }
    }));
    
    const option = {
      title: { text: 'Engagement Over Time', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { bottom: 0, textStyle: { fontSize: 10 } },
      brush: { xAxisIndex: 0, brushStyle: { color: 'rgba(6, 214, 160, 0.2)' } },
      grid: { top: 60, bottom: 60, left: 60, right: 20 },
      xAxis: { type: 'time', boundaryGap: false },
      yAxis: { type: 'value', name: 'Engagement' },
      series: series,
      color: ['#06d6a0', '#26d0ce', '#8b5cf6', '#f72585', '#ff6b9d', '#ffd23f']
    };
    
    timeSeriesChart.setOption(option);
  }

  function updateSentimentChart() {
    if (!sentimentDistChart) return;
    
    const filteredData = getFilteredData();
    
    // Create sentiment distribution
    const bins = 20;
    const binSize = 2 / bins;
    const distribution = Array(bins).fill(0);
    
    filteredData.forEach(point => {
      const binIndex = Math.min(bins - 1, Math.floor((point.sentiment + 1) / binSize));
      distribution[binIndex] += point.engagement;
    });
    
    const data = distribution.map((value, index) => [
      -1 + (index + 0.5) * binSize,
      value
    ]);
    
    const option = {
      title: { text: 'Sentiment vs Engagement', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis' },
      grid: { top: 60, bottom: 60, left: 60, right: 20 },
      xAxis: { 
        type: 'value', 
        name: 'Sentiment', 
        min: -1, 
        max: 1,
        axisLabel: { formatter: (value: number) => value.toFixed(1) }
      },
      yAxis: { type: 'value', name: 'Total Engagement' },
      series: [{
        type: 'bar',
        data: data,
        itemStyle: { 
          color: (params: any) => {
            const sentiment = params.value[0];
            if (sentiment < -0.3) return '#f72585';
            if (sentiment > 0.3) return '#06d6a0';
            return '#8b5cf6';
          }
        },
        emphasis: { itemStyle: { opacity: 0.8 } }
      }]
    };
    
    sentimentDistChart.setOption(option);
  }

  function updatePlatformChart() {
    if (!platformCompChart) return;
    
    const filteredData = getFilteredData();
    
    // Calculate metrics by platform
    const platformMetrics: { [key: string]: { engagement: number, reach: number, posts: number } } = {};
    
    filteredData.forEach(point => {
      if (!platformMetrics[point.platform]) {
        platformMetrics[point.platform] = { engagement: 0, reach: 0, posts: 0 };
      }
      platformMetrics[point.platform].engagement += point.engagement;
      platformMetrics[point.platform].reach += point.reach;
      platformMetrics[point.platform].posts += 1;
    });
    
    const platforms = Object.keys(platformMetrics);
    const engagementData = platforms.map(p => platformMetrics[p].engagement);
    const reachData = platforms.map(p => platformMetrics[p].reach);
    
    const option = {
      title: { text: 'Platform Performance', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, textStyle: { fontSize: 10 } },
      grid: { top: 60, bottom: 60, left: 60, right: 20 },
      xAxis: { type: 'category', data: platforms, axisLabel: { rotate: 45, fontSize: 10 } },
      yAxis: [
        { type: 'value', name: 'Engagement', position: 'left' },
        { type: 'value', name: 'Reach', position: 'right' }
      ],
      series: [
        {
          name: 'Total Engagement',
          type: 'bar',
          data: engagementData,
          itemStyle: { color: '#06d6a0' },
          emphasis: { itemStyle: { opacity: 0.8 } }
        },
        {
          name: 'Total Reach',
          type: 'bar',
          yAxisIndex: 1,
          data: reachData,
          itemStyle: { color: '#26d0ce' },
          emphasis: { itemStyle: { opacity: 0.8 } }
        }
      ]
    };
    
    platformCompChart.setOption(option);
  }

  function updateTopicChart() {
    if (!topicNetworkChart) return;
    
    const filteredData = getFilteredData();
    
    // Calculate topic co-occurrence and metrics
    const topicMetrics: { [key: string]: { engagement: number, count: number, sentiment: number } } = {};
    const topicConnections: { [key: string]: { [key: string]: number } } = {};
    
    filteredData.forEach(point => {
      point.topics.forEach(topic => {
        if (!topicMetrics[topic]) {
          topicMetrics[topic] = { engagement: 0, count: 0, sentiment: 0 };
        }
        topicMetrics[topic].engagement += point.engagement;
        topicMetrics[topic].count += 1;
        topicMetrics[topic].sentiment += point.sentiment;
        
        // Track co-occurrence with other topics in the same post
        point.topics.forEach(otherTopic => {
          if (topic !== otherTopic) {
            if (!topicConnections[topic]) topicConnections[topic] = {};
            if (!topicConnections[topic][otherTopic]) topicConnections[topic][otherTopic] = 0;
            topicConnections[topic][otherTopic] += 1;
          }
        });
      });
    });
    
    // Create nodes and links for network
    const nodes = Object.keys(topicMetrics).map(topic => ({
      id: topic,
      name: topic,
      symbolSize: Math.log(topicMetrics[topic].engagement / 100 + 1) * 20,
      value: topicMetrics[topic].engagement,
      itemStyle: {
        color: topicMetrics[topic].sentiment / topicMetrics[topic].count > 0 ? '#06d6a0' : '#f72585'
      }
    }));
    
    const links: any[] = [];
    Object.keys(topicConnections).forEach(source => {
      Object.keys(topicConnections[source]).forEach(target => {
        links.push({
          source,
          target,
          value: topicConnections[source][target],
          lineStyle: { width: Math.log(topicConnections[source][target] + 1) }
        });
      });
    });
    
    const option = {
      title: { text: 'Topic Network', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: {},
      series: [{
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: links,
        roam: true,
        force: {
          repulsion: 100,
          gravity: 0.1,
          edgeLength: 50
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 4 }
        }
      }]
    };
    
    topicNetworkChart.setOption(option);
  }

  function updateGeographicChart() {
    if (!geographicChart) return;
    
    const filteredData = getFilteredData();
    
    // Calculate metrics by region
    const regionMetrics: { [key: string]: { engagement: number, reach: number, sentiment: number, count: number } } = {};
    
    filteredData.forEach(point => {
      if (!regionMetrics[point.geographic_region]) {
        regionMetrics[point.geographic_region] = { engagement: 0, reach: 0, sentiment: 0, count: 0 };
      }
      regionMetrics[point.geographic_region].engagement += point.engagement;
      regionMetrics[point.geographic_region].reach += point.reach;
      regionMetrics[point.geographic_region].sentiment += point.sentiment;
      regionMetrics[point.geographic_region].count += 1;
    });
    
    const data = Object.keys(regionMetrics).map(region => ({
      name: region,
      value: regionMetrics[region].engagement,
      sentiment: regionMetrics[region].sentiment / regionMetrics[region].count
    }));
    
    const option = {
      title: { text: 'Geographic Distribution', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `${params.name}<br/>Engagement: ${params.value}<br/>Avg Sentiment: ${params.data.sentiment?.toFixed(2)}`
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        itemStyle: {
          color: (params: any) => {
            const colors = ['#06d6a0', '#26d0ce', '#8b5cf6', '#f72585', '#ff6b9d', '#ffd23f'];
            return colors[params.dataIndex % colors.length];
          }
        }
      }]
    };
    
    geographicChart.setOption(option);
  }

  function updateCorrelationMatrix() {
    if (!correlationChart) return;
    
    const filteredData = getFilteredData();
    
    // Calculate correlation matrix between different metrics
    const metrics = ['engagement', 'sentiment', 'reach', 'author_influence', 'viral_coefficient'];
    const correlationMatrix: number[][] = [];
    
    for (let i = 0; i < metrics.length; i++) {
      correlationMatrix[i] = [];
      for (let j = 0; j < metrics.length; j++) {
        const correlation = calculateCorrelation(
          filteredData.map((d: any) => d[metrics[i]]),
          filteredData.map((d: any) => d[metrics[j]])
        );
        correlationMatrix[i][j] = correlation;
      }
    }
    
    const data = correlationMatrix.map((row, i) =>
      row.map((value, j) => [i, j, value])
    ).flat();
    
    const option = {
      title: { text: 'Metric Correlations', left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const [x, y, value] = params.value;
          return `${metrics[x]} vs ${metrics[y]}<br/>Correlation: ${value.toFixed(3)}`;
        }
      },
      grid: { top: 60, bottom: 60, left: 100, right: 20 },
      xAxis: {
        type: 'category',
        data: metrics,
        axisLabel: { rotate: 45, fontSize: 9 }
      },
      yAxis: {
        type: 'category',
        data: metrics,
        axisLabel: { fontSize: 9 }
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        inRange: {
          color: ['#f72585', '#ffffff', '#06d6a0']
        }
      },
      series: [{
        name: 'Correlation',
        type: 'heatmap',
        data: data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };
    
    correlationChart.setOption(option);
  }

  // Helper functions
  function calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  function getFilteredData(): DataPoint[] {
    let filtered = socialMediaData;
    
    if (globalSelection.timeRange) {
      const [start, end] = globalSelection.timeRange;
      filtered = filtered.filter(d => d.timestamp >= start && d.timestamp <= end);
    }
    
    if (globalSelection.platforms.length > 0) {
      filtered = filtered.filter(d => globalSelection.platforms.includes(d.platform));
    }
    
    if (globalSelection.sentimentRange) {
      const [min, max] = globalSelection.sentimentRange;
      filtered = filtered.filter(d => d.sentiment >= min && d.sentiment <= max);
    }
    
    if (globalSelection.topics.length > 0) {
      filtered = filtered.filter(d => d.topics.some(t => globalSelection.topics.includes(t)));
    }
    
    if (globalSelection.regions.length > 0) {
      filtered = filtered.filter(d => globalSelection.regions.includes(d.geographic_region));
    }
    
    return filtered;
  }

  function updateGlobalSelection(updates: Partial<SelectedData>) {
    globalSelection = { ...globalSelection, ...updates };
    globalSelection.dataPoints = getFilteredData();
    
    // Update all charts with new selection
    updateTimeSeriesChart();
    updateSentimentChart();
    updatePlatformChart();
    updateTopicChart();
    updateGeographicChart();
    updateCorrelationMatrix();
  }

  function clearAllSelections() {
    globalSelection = {
      dataPoints: socialMediaData,
      timeRange: null,
      platforms: [],
      sentimentRange: null,
      topics: [],
      regions: []
    };
    updateTimeSeriesChart();
    updateSentimentChart();
    updatePlatformChart();
    updateTopicChart();
    updateGeographicChart();
    updateCorrelationMatrix();
  }

  // Handle window resize
  onMount(() => {
    if (browser) {
      const handleResize = () => {
        timeSeriesChart?.resize();
        sentimentDistChart?.resize();
        platformCompChart?.resize();
        topicNetworkChart?.resize();
        geographicChart?.resize();
        correlationChart?.resize();
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  });
</script>

<svelte:head>
  <title>Analytics Correlation - Social Explorer</title>
  <meta name="description" content="Connected multi-view social media analytics with cross-chart interactions" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-slate-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-16 h-16 bg-gradient-to-br from-purple-400 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Analytics Correlation</h1>
            <p class="text-slate-300 text-lg font-medium">Connected multi-view social media analytics with cross-chart interactions and real-time correlation analysis</p>
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
            on:click={clearAllSelections}
            class="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg">
            Clear Selections
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <!-- Selection Status -->
    <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-6">
          <div class="flex items-center">
            <span class="text-sm font-medium text-gray-700 mr-2">Active Selections:</span>
            <span class="text-2xl font-bold text-purple-600">{globalSelection.dataPoints.length}</span>
            <span class="text-sm text-gray-500 ml-1">data points</span>
          </div>
          
          {#if globalSelection.timeRange}
            <div class="flex items-center space-x-2">
              <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Time Range Selected</span>
            </div>
          {/if}
          
          {#if globalSelection.platforms.length > 0}
            <div class="flex items-center space-x-2">
              <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{globalSelection.platforms.length} Platforms</span>
            </div>
          {/if}
          
          {#if globalSelection.topics.length > 0}
            <div class="flex items-center space-x-2">
              <span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">{globalSelection.topics.length} Topics</span>
            </div>
          {/if}
          
          {#if globalSelection.regions.length > 0}
            <div class="flex items-center space-x-2">
              <span class="text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded">{globalSelection.regions.length} Regions</span>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Connected Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      
      <!-- Time Series Chart -->
      <div class="xl:col-span-3 bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Engagement Timeline</h3>
          <p class="text-sm text-gray-600">Brush to select time range • Connected to all other views</p>
        </div>
        <div class="p-4">
          <div id="timeseries-chart" style="height: 300px;"></div>
        </div>
      </div>

      <!-- Sentiment Distribution -->
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Sentiment Analysis</h3>
          <p class="text-sm text-gray-600">Click bars to filter by sentiment range</p>
        </div>
        <div class="p-4">
          <div id="sentiment-chart" style="height: 300px;"></div>
        </div>
      </div>

      <!-- Platform Comparison -->
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Platform Performance</h3>
          <p class="text-sm text-gray-600">Click platforms to toggle selection</p>
        </div>
        <div class="p-4">
          <div id="platform-chart" style="height: 300px;"></div>
        </div>
      </div>

      <!-- Topic Network -->
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Topic Relationships</h3>
          <p class="text-sm text-gray-600">Click topics to filter • Node size = engagement</p>
        </div>
        <div class="p-4">
          <div id="topic-chart" style="height: 300px;"></div>
        </div>
      </div>

      <!-- Geographic Distribution -->
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Geographic Reach</h3>
          <p class="text-sm text-gray-600">Click regions to toggle selection</p>
        </div>
        <div class="p-4">
          <div id="geographic-chart" style="height: 300px;"></div>
        </div>
      </div>

      <!-- Correlation Matrix -->
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Metric Correlations</h3>
          <p class="text-sm text-gray-600">Real-time correlation analysis</p>
        </div>
        <div class="p-4">
          <div id="correlation-chart" style="height: 300px;"></div>
        </div>
      </div>

    </div>

    <!-- Interaction Guide -->
    <div class="mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Interactive Features</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        <div class="flex items-start space-x-2">
          <div class="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
          <div>
            <span class="font-medium">Time Selection:</span> Brush on timeline to filter all charts by date range
          </div>
        </div>
        <div class="flex items-start space-x-2">
          <div class="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
          <div>
            <span class="font-medium">Platform Filter:</span> Click platform bars to include/exclude platforms
          </div>
        </div>
        <div class="flex items-start space-x-2">
          <div class="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
          <div>
            <span class="font-medium">Topic Focus:</span> Click topic nodes to explore topic-specific data
          </div>
        </div>
        <div class="flex items-start space-x-2">
          <div class="w-2 h-2 bg-pink-500 rounded-full mt-2"></div>
          <div>
            <span class="font-medium">Geographic Filter:</span> Click regions to analyze location-specific trends
          </div>
        </div>
        <div class="flex items-start space-x-2">
          <div class="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
          <div>
            <span class="font-medium">Sentiment Range:</span> Click sentiment bars to filter by emotional tone
          </div>
        </div>
        <div class="flex items-start space-x-2">
          <div class="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
          <div>
            <span class="font-medium">Clear All:</span> Reset all selections to view complete dataset
          </div>
        </div>
      </div>
    </div>
  </div>
</div>