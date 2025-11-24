<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject, loadCurrentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';

  // Redirect to projects if no current project
  onMount(async () => {
    await loadCurrentProject();
    if (!$currentProject) {
      window.location.href = '/projects';
    }
  });

  // Active tab state
  let activeTab = 'capture';

  // Data capture sources and configurations
  let dataSources = [
    {
      id: 'twitter',
      name: 'Twitter',
      description: 'Capture tweets, trends, and user data',
      icon: '🐦',
      color: 'blue',
      status: 'connected',
      lastSync: '2025-01-27T15:30:00Z',
      recordsCaptured: 45672,
      config: {
        keywords: ['#AI', '#tech', 'innovation'],
        languages: ['en', 'es'],
        geoLocation: 'US',
        includeRetweets: true
      }
    },
    {
      id: 'reddit',
      name: 'Reddit',
      description: 'Monitor subreddits and discussions',
      icon: '🤖',
      color: 'orange',
      status: 'connected',
      lastSync: '2025-01-27T15:25:00Z',
      recordsCaptured: 23456,
      config: {
        subreddits: ['technology', 'artificial', 'MachineLearning'],
        postTypes: ['hot', 'new', 'top'],
        timeRange: '24h'
      }
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Capture posts, stories, and hashtags',
      icon: '📷',
      color: 'pink',
      status: 'paused',
      lastSync: '2025-01-27T14:15:00Z',
      recordsCaptured: 18934,
      config: {
        hashtags: ['#lifestyle', '#tech', '#innovation'],
        includeStories: false,
        mediaTypes: ['image', 'video']
      }
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Professional content and company updates',
      icon: '💼',
      color: 'indigo',
      status: 'disconnected',
      lastSync: null,
      recordsCaptured: 0,
      config: {
        companies: [],
        industries: ['Technology', 'AI'],
        postTypes: ['articles', 'posts']
      }
    }
  ];

  // Available datasets for processing
  let availableDatasets = [
    { 
      id: 'ds1', 
      name: 'Twitter Sentiment Dataset', 
      type: 'sentiment', 
      records: 487293, 
      size: '45.2 MB',
      created: '2025-01-25T10:00:00Z',
      status: 'ready',
      source: 'twitter',
      columns: ['id', 'text', 'sentiment', 'confidence', 'platform', 'timestamp', 'user_id']
    },
    { 
      id: 'ds2', 
      name: 'Multi-Platform Engagement Data', 
      type: 'engagement', 
      records: 1234567, 
      size: '156.8 MB',
      created: '2025-01-24T14:30:00Z',
      status: 'ready',
      source: 'multi-platform',
      columns: ['post_id', 'platform', 'likes', 'shares', 'comments', 'reach', 'content_type', 'hashtags']
    },
    { 
      id: 'ds3', 
      name: 'Reddit Discussion Analysis', 
      type: 'discussions', 
      records: 89456, 
      size: '12.4 MB',
      created: '2025-01-23T09:15:00Z',
      status: 'ready',
      source: 'reddit',
      columns: ['post_id', 'subreddit', 'title', 'content', 'score', 'comments', 'author']
    }
  ];

  // Processing workflows
  let workflows = [
    {
      id: 'wf1',
      name: 'Real-time Sentiment Pipeline',
      description: 'Live sentiment analysis on captured Twitter data',
      status: 'running',
      inputSource: 'twitter',
      outputDataset: 'twitter_sentiment_live',
      steps: 6,
      progress: 78,
      recordsProcessed: 12456,
      created: '2025-01-27T09:30:00Z'
    },
    {
      id: 'wf2',
      name: 'Multi-Platform Content Classifier',
      description: 'Classify and tag content across all platforms',
      status: 'completed',
      inputSource: 'multi-platform',
      outputDataset: 'classified_content_v2',
      steps: 8,
      recordsProcessed: 45678,
      created: '2025-01-26T14:20:00Z'
    },
    {
      id: 'wf3',
      name: 'Reddit Topic Extraction',
      description: 'Extract topics and themes from Reddit discussions',
      status: 'draft',
      inputSource: 'reddit',
      outputDataset: 'reddit_topics',
      steps: 5,
      created: '2025-01-27T11:45:00Z'
    }
  ];

  // Combined statistics
  let dataStats = {
    totalRecordsCapture: dataSources.reduce((sum, source) => sum + source.recordsCaptured, 0),
    activeConnections: dataSources.filter(s => s.status === 'connected').length,
    totalDatasets: availableDatasets.length,
    activeWorkflows: workflows.filter(w => w.status === 'running').length,
    totalStorageUsed: '278.5 MB',
    lastCaptureUpdate: '2025-01-27T15:30:00Z'
  };

  let selectedDataset = null;
  let selectedWorkflow = null;

  function getStatusColor(status: string) {
    const colors = {
      'connected': 'bg-blue-100 text-blue-800',
      'paused': 'bg-yellow-100 text-yellow-800',
      'disconnected': 'bg-gray-100 text-gray-800',
      'error': 'bg-red-100 text-red-800',
      'ready': 'bg-blue-100 text-blue-800',
      'processing': 'bg-blue-100 text-blue-800',
      'running': 'bg-blue-100 text-blue-800',
      'completed': 'bg-blue-100 text-blue-800',
      'draft': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  function getStatusIcon(status: string) {
    const icons = {
      'connected': '🟢',
      'paused': '🟡', 
      'disconnected': '⚫',
      'error': '🔴',
      'ready': '✅',
      'processing': '⏳',
      'running': '🔄',
      'completed': '🎉',
      'draft': '📝'
    };
    return icons[status] || '●';
  }

  function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleString();
  }

  function toggleDataSource(sourceId: string) {
    dataSources = dataSources.map(source => {
      if (source.id === sourceId) {
        const newStatus = source.status === 'connected' ? 'paused' : 'connected';
        return { ...source, status: newStatus };
      }
      return source;
    });
  }

  function createWorkflowFromDataset(dataset) {
    selectedDataset = dataset;
    window.location.href = `/data-management/workflow-builder?dataset=${dataset.id}`;
  }

  function editWorkflow(workflow) {
    window.location.href = `/data-management/workflow-builder?workflow=${workflow.id}`;
  }
</script>

<svelte:head>
  <title>Data Management - Social Explorer</title>
  <meta name="description" content="Unified data capture and processing platform for social media analytics" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-teal-900/10 to-slate-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-16 h-16 bg-gradient-to-br from-teal-400 to-cyan-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Data Management</h1>
            <p class="text-slate-300 text-lg font-medium">Capture, process, and transform your social media data with unified workflows</p>
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
            on:click={() => window.location.href = '/data-management/workflow-builder'}
            class="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg">
            Create Workflow
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <!-- Overview Stats -->
    <div class="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-teal-600 mb-1">{dataStats.totalRecordsCapture.toLocaleString()}</div>
        <div class="text-sm text-gray-600">Records Captured</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{dataStats.activeConnections}</div>
        <div class="text-sm text-gray-600">Active Sources</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{dataStats.totalDatasets}</div>
        <div class="text-sm text-gray-600">Datasets</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{dataStats.activeWorkflows}</div>
        <div class="text-sm text-gray-600">Active Workflows</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{dataStats.totalStorageUsed}</div>
        <div class="text-sm text-gray-600">Storage Used</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-xs text-gray-500 mb-1">Last Update</div>
        <div class="text-sm font-medium text-gray-900">{formatTimestamp(dataStats.lastCaptureUpdate).split(',')[1]}</div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="bg-white rounded-xl shadow-sm mb-8">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8 px-6">
          <button
            on:click={() => activeTab = 'capture'}
            class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'capture' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            Data Capture ({dataSources.length})
          </button>
          <button
            on:click={() => activeTab = 'datasets'}
            class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'datasets' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            Datasets ({availableDatasets.length})
          </button>
          <button
            on:click={() => activeTab = 'workflows'}
            class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'workflows' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            Processing Workflows ({workflows.length})
          </button>
        </nav>
      </div>

      <div class="p-6">
        {#if activeTab === 'capture'}
          <!-- Data Capture Sources -->
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">Data Sources</h2>
              <button class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium transition-colors">
                Add Source
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {#each dataSources as source}
                <div class="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-3">
                      <span class="text-2xl">{source.icon}</span>
                      <div>
                        <h3 class="font-medium text-gray-900">{source.name}</h3>
                        <p class="text-sm text-gray-600">{source.description}</p>
                      </div>
                    </div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(source.status)}">
                      {getStatusIcon(source.status)} {source.status}
                    </span>
                  </div>

                  <div class="space-y-3 mb-4">
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-600">Records:</span>
                      <span class="font-medium text-gray-900">{source.recordsCaptured.toLocaleString()}</span>
                    </div>
                    {#if source.lastSync}
                      <div class="flex justify-between text-sm">
                        <span class="text-gray-600">Last Sync:</span>
                        <span class="font-medium text-gray-900">{formatTimestamp(source.lastSync).split(',')[1]}</span>
                      </div>
                    {/if}
                  </div>

                  <div class="flex space-x-2">
                    <button 
                      on:click={() => toggleDataSource(source.id)}
                      class="flex-1 px-3 py-2 {source.status === 'connected' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'} rounded-xl text-sm font-medium transition-colors">
                      {source.status === 'connected' ? 'Pause' : 'Start'}
                    </button>
                    <button class="px-3 py-2 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors">
                      Configure
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>

        {:else if activeTab === 'datasets'}
          <!-- Available Datasets -->
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">Available Datasets</h2>
              <button class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                Import Dataset
              </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {#each availableDatasets as dataset}
                <div class="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div class="flex items-start justify-between mb-4">
                    <div>
                      <h3 class="font-medium text-gray-900 mb-1">{dataset.name}</h3>
                      <p class="text-sm text-gray-600">{dataset.records.toLocaleString()} records • {dataset.size}</p>
                      <div class="flex items-center space-x-2 mt-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {dataset.type}
                        </span>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(dataset.status)}">
                          {getStatusIcon(dataset.status)} {dataset.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="text-xs text-gray-500 mb-4">
                    Created: {formatTimestamp(dataset.created)}
                  </div>

                  <div class="flex flex-wrap gap-1 mb-4">
                    {#each dataset.columns.slice(0, 3) as column}
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {column}
                      </span>
                    {/each}
                    {#if dataset.columns.length > 3}
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        +{dataset.columns.length - 3} more
                      </span>
                    {/if}
                  </div>

                  <div class="flex space-x-2">
                    <button 
                      on:click={() => createWorkflowFromDataset(dataset)}
                      class="flex-1 px-3 py-2 bg-teal-100 text-teal-800 hover:bg-teal-200 rounded-xl text-sm font-medium transition-colors">
                      Process
                    </button>
                    <button class="px-3 py-2 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors">
                      Preview
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>

        {:else if activeTab === 'workflows'}
          <!-- Processing Workflows -->
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">Processing Workflows</h2>
              <button 
                on:click={() => window.location.href = '/data-management/workflow-builder'}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                New Workflow
              </button>
            </div>

            <div class="space-y-4">
              {#each workflows as workflow}
                <div class="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                      <h3 class="font-medium text-gray-900 mb-1">{workflow.name}</h3>
                      <p class="text-sm text-gray-600 mb-2">{workflow.description}</p>
                      <div class="flex items-center space-x-4 text-sm text-gray-500">
                        <span>📊 {workflow.steps} steps</span>
                        {#if workflow.recordsProcessed}
                          <span>📈 {workflow.recordsProcessed.toLocaleString()} records</span>
                        {/if}
                        <span>📅 {formatTimestamp(workflow.created)}</span>
                      </div>
                    </div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(workflow.status)}">
                      {getStatusIcon(workflow.status)} {workflow.status}
                    </span>
                  </div>

                  <div class="flex items-center justify-between mb-4">
                    <div class="text-sm">
                      <span class="text-gray-600">Input:</span>
                      <span class="font-medium text-gray-900 ml-1">{workflow.inputSource}</span>
                      <span class="text-gray-400 mx-2">→</span>
                      <span class="text-gray-600">Output:</span>
                      <span class="font-medium text-gray-900 ml-1">{workflow.outputDataset}</span>
                    </div>
                  </div>

                  {#if workflow.status === 'running' && workflow.progress}
                    <div class="mb-4">
                      <div class="flex justify-between text-sm mb-1">
                        <span class="text-gray-600">Progress</span>
                        <span class="text-gray-900 font-medium">{workflow.progress}%</span>
                      </div>
                      <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-teal-600 h-2 rounded-full transition-all duration-300" style="width: {workflow.progress}%"></div>
                      </div>
                    </div>
                  {/if}

                  <div class="flex items-center justify-between">
                    <div class="flex space-x-2">
                      {#if workflow.status === 'draft'}
                        <button 
                          on:click={() => editWorkflow(workflow)}
                          class="text-sm text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                        <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">Run</button>
                      {:else if workflow.status === 'running'}
                        <button class="text-sm text-red-600 hover:text-red-800 font-medium">Stop</button>
                        <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">View Logs</button>
                      {:else if workflow.status === 'completed'}
                        <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">View Results</button>
                        <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">Download</button>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>