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

  // Research investigation data
  let investigationStats = {
    totalDataPoints: 2847293,
    activeCohorts: 24,
    runningAnalyses: 8,
    savedQueries: 156
  };

  // Available datasets
  let datasets = [
    { 
      id: 'ds1', 
      name: 'Twitter Hashtag Trends Q1 2025', 
      type: 'hashtags', 
      records: 487293, 
      dateRange: '2025-01-01 to 2025-03-31',
      sources: ['twitter'],
      status: 'active',
      lastUpdated: '2025-01-27T15:30:00Z'
    },
    { 
      id: 'ds2', 
      name: 'Multi-Platform Engagement Analysis', 
      type: 'engagement', 
      records: 1234567, 
      dateRange: '2024-12-01 to 2025-01-27',
      sources: ['twitter', 'instagram', 'facebook', 'linkedin'],
      status: 'active',
      lastUpdated: '2025-01-27T14:45:00Z'
    },
    { 
      id: 'ds3', 
      name: 'Sentiment Analysis Dataset', 
      type: 'sentiment', 
      records: 789456, 
      dateRange: '2025-01-01 to 2025-01-27',
      sources: ['twitter', 'reddit', 'facebook'],
      status: 'active',
      lastUpdated: '2025-01-27T13:20:00Z'
    },
    { 
      id: 'ds4', 
      name: 'Topic Modeling Corpus', 
      type: 'topics', 
      records: 567890, 
      dateRange: '2024-10-01 to 2025-01-27',
      sources: ['twitter', 'linkedin', 'reddit'],
      status: 'processing',
      lastUpdated: '2025-01-27T12:15:00Z'
    },
    { 
      id: 'ds5', 
      name: 'Language Detection Results', 
      type: 'language', 
      records: 234567, 
      dateRange: '2025-01-15 to 2025-01-27',
      sources: ['twitter', 'facebook', 'instagram'],
      status: 'active',
      lastUpdated: '2025-01-27T11:30:00Z'
    }
  ];

  // Research cohorts
  let cohorts = [
    {
      id: 'c1',
      name: 'High Engagement Users',
      description: 'Users with >5% engagement rate across platforms',
      size: 12847,
      criteria: ['engagement_rate > 5', 'follower_count > 1000'],
      platforms: ['instagram', 'tiktok'],
      created: '2025-01-25T10:00:00Z'
    },
    {
      id: 'c2',
      name: 'AI/Tech Influencers',
      description: 'Accounts frequently posting about AI and technology',
      size: 8934,
      criteria: ['hashtags contains #AI OR #Technology', 'verified = true'],
      platforms: ['twitter', 'linkedin'],
      created: '2025-01-24T14:30:00Z'
    },
    {
      id: 'c3',
      name: 'Climate Change Advocates',
      description: 'Users actively discussing environmental topics',
      size: 15673,
      criteria: ['sentiment = positive', 'topics contains climate OR environment'],
      platforms: ['twitter', 'facebook', 'instagram'],
      created: '2025-01-23T09:15:00Z'
    },
    {
      id: 'c4',
      name: 'Multilingual Content Creators',
      description: 'Accounts posting in multiple languages',
      size: 6789,
      criteria: ['languages_count >= 2', 'post_frequency = high'],
      platforms: ['twitter', 'instagram'],
      created: '2025-01-22T16:45:00Z'
    }
  ];

  // Saved queries
  let savedQueries = [
    {
      id: 'q1',
      name: 'Viral Hashtag Analysis',
      description: 'Find hashtags with >10K mentions and high engagement',
      query: "SELECT hashtag, COUNT(*) as mentions, AVG(engagement_rate) as avg_engagement FROM posts WHERE hashtag_mentions > 10000 GROUP BY hashtag ORDER BY avg_engagement DESC",
      datasets: ['ds1', 'ds2'],
      created: '2025-01-26T11:20:00Z',
      lastRun: '2025-01-27T09:30:00Z'
    },
    {
      id: 'q2',
      name: 'Sentiment by Geographic Region',
      description: 'Analyze sentiment distribution across different regions',
      query: "SELECT location_region, sentiment, COUNT(*) as post_count FROM posts WHERE location_region IS NOT NULL GROUP BY location_region, sentiment",
      datasets: ['ds3'],
      created: '2025-01-25T15:45:00Z',  
      lastRun: '2025-01-27T08:15:00Z'
    },
    {
      id: 'q3',
      name: 'Cross-Platform Content Performance',
      description: 'Compare engagement rates across different platforms',
      query: "SELECT platform, content_type, AVG(engagement_rate) as avg_engagement, COUNT(*) as post_count FROM posts GROUP BY platform, content_type ORDER BY avg_engagement DESC",
      datasets: ['ds2'],
      created: '2025-01-24T13:10:00Z',
      lastRun: '2025-01-27T07:45:00Z'
    }
  ];

  // Active analysis tabs
  let activeTab = 'datasets';
  let selectedDataset = null;
  let selectedCohort = null;
  let selectedQuery = null;

  // Filters
  let datasetFilter = 'all';
  let statusFilter = 'all';
  let sourceFilter = 'all';
  let searchQuery = '';

  // Analysis results
  let analysisResults = null;
  let isAnalyzing = false;

  // Filtered data
  $: filteredDatasets = datasets.filter(dataset => {
    const matchesFilter = datasetFilter === 'all' || dataset.type === datasetFilter;
    const matchesStatus = statusFilter === 'all' || dataset.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || dataset.sources.includes(sourceFilter);
    const matchesSearch = searchQuery === '' || 
      dataset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dataset.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesStatus && matchesSource && matchesSearch;
  });

  function getDatasetTypeIcon(type: string) {
    const icons = {
      'hashtags': '#️⃣',
      'engagement': '📊',
      'sentiment': '😊',
      'topics': '🏷️',
      'language': '🌐'
    };
    return icons[type] || '📄';
  }

  function getStatusColor(status: string) {
    const colors = {
      'active': 'bg-green-100 text-green-800',
      'processing': 'bg-yellow-100 text-yellow-800',
      'error': 'bg-red-100 text-red-800',
      'archived': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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

  function selectDataset(dataset: any) {
    selectedDataset = dataset;
    selectedCohort = null;
    selectedQuery = null;
  }

  function selectCohort(cohort: any) {
    selectedCohort = cohort;
    selectedDataset = null;
    selectedQuery = null;
  }

  function selectQuery(query: any) {
    selectedQuery = query;
    selectedDataset = null;
    selectedCohort = null;
  }

  async function runAnalysis() {
    if (!selectedDataset && !selectedCohort && !selectedQuery) {
      alert('Please select a dataset, cohort, or query to analyze');
      return;
    }

    isAnalyzing = true;
    
    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mock analysis results
    analysisResults = {
      type: selectedDataset ? 'dataset' : selectedCohort ? 'cohort' : 'query',
      target: selectedDataset?.name || selectedCohort?.name || selectedQuery?.name,
      metrics: {
        totalRecords: Math.floor(Math.random() * 100000) + 50000,
        averageEngagement: (Math.random() * 10).toFixed(2),
        sentimentScore: (Math.random() * 2 - 1).toFixed(3),
        topHashtags: ['#AI', '#Technology', '#Innovation', '#Future', '#Data'],
        platforms: ['Twitter', 'Instagram', 'LinkedIn'],
        timeRange: '2025-01-01 to 2025-01-27'
      },
      insights: [
        'Engagement rates are 23% higher on weekends',
        'Posts with video content show 45% more interaction',
        'Positive sentiment correlates with higher share rates',
        'Hashtag diversity improves reach by an average of 18%'
      ]
    };
    
    isAnalyzing = false;
  }

  function exportResults() {
    if (!analysisResults) return;
    
    const data = {
      analysis: analysisResults,
      timestamp: new Date().toISOString(),
      project: $currentProject?.name
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'research_investigation_results.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function createNewCohort() {
    // Mock cohort creation
    const newCohort = {
      id: `c${cohorts.length + 1}`,
      name: 'New Research Cohort',
      description: 'Custom user-defined cohort for analysis',
      size: Math.floor(Math.random() * 20000) + 5000,
      criteria: ['custom_criteria = true'],
      platforms: ['twitter', 'instagram'],
      created: new Date().toISOString()
    };
    
    cohorts = [newCohort, ...cohorts];
    selectCohort(newCohort);
  }

  function saveQuery() {
    // Mock query saving
    const newQuery = {
      id: `q${savedQueries.length + 1}`,
      name: 'New Research Query',
      description: 'Custom analysis query',
      query: "SELECT * FROM posts WHERE custom_condition = true",
      datasets: [selectedDataset?.id].filter(Boolean),
      created: new Date().toISOString(),
      lastRun: null
    };
    
    savedQueries = [newQuery, ...savedQueries];
    selectQuery(newQuery);
  }
</script>

<svelte:head>
  <title>Research Investigation - Text Analytics - Social Explorer</title>
  <meta name="description" content="Comprehensive research tools for investigating social media data patterns and insights" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="bg-white shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <button 
            on:click={() => window.location.href='/text-analytics'}
            class="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mr-4">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Research Investigation</h1>
            <p class="text-gray-600 mt-1">Comprehensive research tools for investigating social media data patterns and insights</p>
            {#if $currentProject}
              <div class="flex items-center mt-2">
                <span class="text-sm text-gray-500">Project:</span>
                <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {$currentProject.name}
                </span>
              </div>
            {/if}
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          {#if analysisResults}
            <button 
              on:click={exportResults}
              class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              Export Results
            </button>
          {/if}
          <button 
            on:click={runAnalysis}
            disabled={isAnalyzing || (!selectedDataset && !selectedCohort && !selectedQuery)}
            class="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
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
        <div class="text-2xl font-bold text-purple-600 mb-1">{investigationStats.totalDataPoints.toLocaleString()}</div>
        <div class="text-sm text-gray-600">Total Data Points</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-green-600 mb-1">{investigationStats.activeCohorts}</div>
        <div class="text-sm text-gray-600">Active Cohorts</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-orange-600 mb-1">{investigationStats.runningAnalyses}</div>
        <div class="text-sm text-gray-600">Running Analyses</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{investigationStats.savedQueries}</div>
        <div class="text-sm text-gray-600">Saved Queries</div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
      <!-- Left Panel: Data Explorer -->
      <div class="xl:col-span-2">
        <!-- Tabs -->
        <div class="bg-white rounded-lg shadow-sm">
          <div class="border-b border-gray-200">
            <nav class="-mb-px flex space-x-8 px-6">
              <button
                on:click={() => activeTab = 'datasets'}
                class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'datasets' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
                Datasets ({datasets.length})
              </button>
              <button
                on:click={() => activeTab = 'cohorts'}
                class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'cohorts' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
                Cohorts ({cohorts.length})
              </button>
              <button
                on:click={() => activeTab = 'queries'}
                class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'queries' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
                Saved Queries ({savedQueries.length})
              </button>
            </nav>
          </div>

          <div class="p-6">
            {#if activeTab === 'datasets'}
              <!-- Dataset Filters -->
              <div class="mb-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <input 
                      bind:value={searchQuery}
                      type="text" 
                      placeholder="Search datasets..."
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                  </div>
                  <div>
                    <select bind:value={datasetFilter} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="all">All Types</option>
                      <option value="hashtags">Hashtags</option>
                      <option value="engagement">Engagement</option>
                      <option value="sentiment">Sentiment</option>
                      <option value="topics">Topics</option>
                      <option value="language">Language</option>
                    </select>
                  </div>
                  <div>
                    <select bind:value={statusFilter} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="processing">Processing</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                  <div>
                    <select bind:value={sourceFilter} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="all">All Sources</option>
                      <option value="twitter">Twitter</option>
                      <option value="facebook">Facebook</option>
                      <option value="instagram">Instagram</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Datasets List -->
              <div class="space-y-4">
                {#each filteredDatasets as dataset}
                  <div 
                    class="border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors {selectedDataset?.id === dataset.id ? 'ring-2 ring-purple-500 bg-purple-50' : ''}"
                    on:click={() => selectDataset(dataset)}>
                    <div class="flex items-start justify-between">
                      <div class="flex items-start space-x-3">
                        <span class="text-xl">{getDatasetTypeIcon(dataset.type)}</span>
                        <div>
                          <h3 class="font-medium text-gray-900">{dataset.name}</h3>
                          <p class="text-sm text-gray-600 mt-1">{dataset.records.toLocaleString()} records • {dataset.dateRange}</p>
                          <div class="flex items-center space-x-2 mt-2">
                            {#each dataset.sources as source}
                              <span class="text-sm">{getPlatformIcon(source)}</span>
                            {/each}
                          </div>
                        </div>
                      </div>
                      <div class="flex flex-col items-end">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(dataset.status)}">
                          {dataset.status}
                        </span>
                        <span class="text-xs text-gray-500 mt-1">{formatTimestamp(dataset.lastUpdated)}</span>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>

            {:else if activeTab === 'cohorts'}
              <!-- Cohorts List -->
              <div class="mb-4 flex justify-between items-center">
                <h3 class="text-lg font-medium text-gray-900">Research Cohorts</h3>
                <button 
                  on:click={createNewCohort}
                  class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors">
                  Create Cohort
                </button>
              </div>
              
              <div class="space-y-4">
                {#each cohorts as cohort}
                  <div 
                    class="border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors {selectedCohort?.id === cohort.id ? 'ring-2 ring-purple-500 bg-purple-50' : ''}"
                    on:click={() => selectCohort(cohort)}>
                    <div class="flex items-start justify-between">
                      <div>
                        <h3 class="font-medium text-gray-900">{cohort.name}</h3>
                        <p class="text-sm text-gray-600 mt-1">{cohort.description}</p>
                        <div class="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span>👥 {cohort.size.toLocaleString()} users</span>
                          <span>📅 {formatTimestamp(cohort.created)}</span>
                        </div>
                        <div class="flex items-center space-x-2 mt-2">
                          {#each cohort.platforms as platform}
                            <span class="text-sm">{getPlatformIcon(platform)}</span>
                          {/each}
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>

            {:else if activeTab === 'queries'}
              <!-- Saved Queries List -->
              <div class="mb-4 flex justify-between items-center">
                <h3 class="text-lg font-medium text-gray-900">Saved Queries</h3>
                <button 
                  on:click={saveQuery}
                  class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors">
                  Save Query
                </button>
              </div>
              
              <div class="space-y-4">
                {#each savedQueries as query}
                  <div 
                    class="border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors {selectedQuery?.id === query.id ? 'ring-2 ring-purple-500 bg-purple-50' : ''}"
                    on:click={() => selectQuery(query)}>
                    <div class="flex items-start justify-between">
                      <div>
                        <h3 class="font-medium text-gray-900">{query.name}</h3>
                        <p class="text-sm text-gray-600 mt-1">{query.description}</p>
                        <div class="bg-gray-100 rounded p-2 mt-2 text-xs font-mono text-gray-700">
                          {query.query.substring(0, 100)}...
                        </div>
                        <div class="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span>🗃️ {query.datasets.length} datasets</span>
                          <span>📅 {formatTimestamp(query.created)}</span>
                          {#if query.lastRun}
                            <span>▶️ {formatTimestamp(query.lastRun)}</span>
                          {/if}
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Right Panel: Analysis Results -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Analysis Results</h2>
        
        {#if isAnalyzing}
          <div class="flex flex-col items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
            <p class="text-gray-600">Running analysis...</p>
          </div>
        {:else if analysisResults}
          <div class="space-y-6">
            <!-- Analysis Summary -->
            <div>
              <h3 class="font-medium text-gray-900 mb-2">Analysis Target</h3>
              <p class="text-sm text-gray-600">{analysisResults.target}</p>
            </div>

            <!-- Key Metrics -->
            <div>
              <h3 class="font-medium text-gray-900 mb-3">Key Metrics</h3>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-purple-600">{analysisResults.metrics.totalRecords.toLocaleString()}</div>
                  <div class="text-xs text-gray-600">Records</div>
                </div>
                <div class="bg-gray-50 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-green-600">{analysisResults.metrics.averageEngagement}%</div>
                  <div class="text-xs text-gray-600">Avg Engagement</div>
                </div>
                <div class="bg-gray-50 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-blue-600">{analysisResults.metrics.sentimentScore}</div>
                  <div class="text-xs text-gray-600">Sentiment Score</div>
                </div>
                <div class="bg-gray-50 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-orange-600">{analysisResults.metrics.platforms.length}</div>
                  <div class="text-xs text-gray-600">Platforms</div>
                </div>
              </div>
            </div>

            <!-- Top Hashtags -->
            <div>
              <h3 class="font-medium text-gray-900 mb-3">Top Hashtags</h3>
              <div class="flex flex-wrap gap-2">
                {#each analysisResults.metrics.topHashtags as hashtag}
                  <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {hashtag}
                  </span>
                {/each}
              </div>
            </div>

            <!-- Insights -->
            <div>
              <h3 class="font-medium text-gray-900 mb-3">Key Insights</h3>
              <ul class="space-y-2">
                {#each analysisResults.insights as insight}
                  <li class="flex items-start">
                    <span class="text-green-500 mr-2">✓</span>
                    <span class="text-sm text-gray-700">{insight}</span>
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        {:else}
          <div class="text-center py-12">
            <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">No Analysis Selected</h3>
            <p class="text-gray-600 mb-4">Select a dataset, cohort, or query from the left panel and click "Run Analysis" to begin your investigation.</p>
            <div class="text-sm text-gray-500">
              <div class="flex items-center justify-center space-x-4">
                <span>📊 Datasets</span>
                <span>👥 Cohorts</span>
                <span>🔍 Queries</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>