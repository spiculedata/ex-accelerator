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

  // Available datasets (would come from API in real implementation)
  let availableDatasets = [
    { 
      id: 'ds1', 
      name: 'Twitter Sentiment Dataset', 
      type: 'sentiment', 
      records: 487293, 
      size: '45.2 MB',
      created: '2025-01-25T10:00:00Z',
      status: 'ready',
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
      columns: ['post_id', 'platform', 'likes', 'shares', 'comments', 'reach', 'content_type', 'hashtags']
    },
    { 
      id: 'ds3', 
      name: 'Hashtag Analysis Results', 
      type: 'hashtags', 
      records: 89456, 
      size: '12.4 MB',
      created: '2025-01-23T09:15:00Z',
      status: 'ready',
      columns: ['hashtag', 'count', 'reach', 'engagement_rate', 'sentiment', 'trend', 'platforms']
    },
    { 
      id: 'ds4', 
      name: 'Topic Modeling Corpus', 
      type: 'topics', 
      records: 567890, 
      size: '78.9 MB',
      created: '2025-01-22T16:45:00Z',
      status: 'processing',
      columns: ['doc_id', 'text', 'topics', 'topic_weights', 'language', 'source']
    }
  ];

  // Processing workflows
  let workflows = [
    {
      id: 'wf1',
      name: 'Sentiment Enhancement Pipeline',
      description: 'Advanced sentiment analysis with emotion detection and confidence scoring',
      status: 'completed',
      inputDataset: 'ds1',
      outputDataset: 'ds1_enhanced',
      steps: 5,
      runtime: '12m 34s',
      created: '2025-01-26T11:20:00Z'
    },
    {
      id: 'wf2', 
      name: 'Content Classification Workflow',
      description: 'Multi-label content classification with toxicity detection',
      status: 'running',
      inputDataset: 'ds2',
      outputDataset: 'ds2_classified',
      steps: 8,
      runtime: '45m 12s',
      progress: 67,
      created: '2025-01-27T09:30:00Z'
    },
    {
      id: 'wf3',
      name: 'Feature Engineering Pipeline',
      description: 'Extract temporal, linguistic, and engagement features',
      status: 'draft',
      inputDataset: 'ds3',
      outputDataset: 'ds3_features',
      steps: 12,
      created: '2025-01-27T14:15:00Z'
    }
  ];

  // Processing statistics
  let processingStats = {
    totalWorkflows: workflows.length,
    runningWorkflows: workflows.filter(w => w.status === 'running').length,
    completedWorkflows: workflows.filter(w => w.status === 'completed').length,
    totalProcessingTime: '2h 45m',
    datasetsProcessed: 24,
    averageProcessingTime: '15m 23s'
  };

  let selectedDataset = null;

  function selectDataset(dataset) {
    selectedDataset = dataset;
  }

  function createNewWorkflow() {
    if (!selectedDataset) {
      alert('Please select a dataset first');
      return;
    }
    // Navigate to workflow builder with selected dataset
    window.location.href = `/data-processing/workflow-builder?dataset=${selectedDataset.id}`;
  }

  function getStatusColor(status: string) {
    const colors = {
      'ready': 'bg-blue-100 text-blue-800',
      'processing': 'bg-yellow-100 text-yellow-800', 
      'completed': 'bg-blue-100 text-blue-800',
      'running': 'bg-blue-100 text-blue-800',
      'draft': 'bg-gray-100 text-gray-800',
      'error': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  function getStatusIcon(status: string) {
    const icons = {
      'ready': '✅',
      'processing': '⏳',
      'completed': '🎉',
      'running': '🔄', 
      'draft': '📝',
      'error': '❌'
    };
    return icons[status] || '●';
  }

  function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleString();
  }

  function formatFileSize(size: string) {
    return size;
  }
</script>

<svelte:head>
  <title>Data Processing - Social Explorer</title>
  <meta name="description" content="Advanced data processing workflows for dataset augmentation and transformation" />
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
          <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-red-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Data Processing</h1>
            <p class="text-slate-300 text-lg font-medium">Create custom workflows to augment and transform your datasets with advanced processing pipelines</p>
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
            on:click={createNewWorkflow}
            class="px-6 py-3 bg-gradient-to-r from-blue-500 to-red-600 hover:from-blue-600 hover:to-red-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg">
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
        <div class="text-2xl font-bold text-blue-600 mb-1">{processingStats.totalWorkflows}</div>
        <div class="text-sm text-gray-600">Total Workflows</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{processingStats.runningWorkflows}</div>
        <div class="text-sm text-gray-600">Running Now</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{processingStats.completedWorkflows}</div>
        <div class="text-sm text-gray-600">Completed</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{processingStats.datasetsProcessed}</div>
        <div class="text-sm text-gray-600">Datasets Processed</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-indigo-600 mb-1">{processingStats.totalProcessingTime}</div>
        <div class="text-sm text-gray-600">Total Runtime</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-cyan-600 mb-1">{processingStats.averageProcessingTime}</div>
        <div class="text-sm text-gray-600">Avg Runtime</div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
      <!-- Dataset Selection Panel -->
      <div class="xl:col-span-1">
        <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-6">Select Input Dataset</h2>
          
          <div class="space-y-4">
            {#each availableDatasets as dataset}
              <div 
                class="border border-gray-200 rounded-xl p-4 cursor-pointer hover:bg-gray-50 transition-colors {selectedDataset?.id === dataset.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}"
                on:click={() => selectDataset(dataset)}>
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-start space-x-3">
                    <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 class="font-medium text-gray-900">{dataset.name}</h3>
                      <p class="text-sm text-gray-600 mt-1">{dataset.records.toLocaleString()} records • {dataset.size}</p>
                    </div>
                  </div>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(dataset.status)}">
                    {getStatusIcon(dataset.status)} {dataset.status}
                  </span>
                </div>
                
                <div class="text-xs text-gray-500 mb-2">
                  Created: {formatTimestamp(dataset.created)}
                </div>
                
                <div class="flex flex-wrap gap-1">
                  {#each dataset.columns.slice(0, 4) as column}
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {column}
                    </span>
                  {/each}
                  {#if dataset.columns.length > 4}
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      +{dataset.columns.length - 4} more
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>

        {#if selectedDataset}
          <!-- Dataset Preview -->
          <div class="bg-white rounded-xl shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Dataset Preview</h3>
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">Type:</span>
                <span class="text-sm font-medium text-gray-900">{selectedDataset.type}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">Records:</span>
                <span class="text-sm font-medium text-gray-900">{selectedDataset.records.toLocaleString()}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">Size:</span>
                <span class="text-sm font-medium text-gray-900">{selectedDataset.size}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">Columns:</span>
                <span class="text-sm font-medium text-gray-900">{selectedDataset.columns.length}</span>
              </div>
            </div>
            
            <div class="mt-4 pt-4 border-t border-gray-200">
              <h4 class="text-sm font-medium text-gray-900 mb-2">All Columns</h4>
              <div class="flex flex-wrap gap-1">
                {#each selectedDataset.columns as column}
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {column}
                  </span>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Workflows Panel -->
      <div class="xl:col-span-2">
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-gray-900">Processing Workflows</h2>
            <span class="text-sm text-gray-500">{workflows.length} workflows</span>
          </div>
          
          <div class="space-y-4">
            {#each workflows as workflow}
              <div class="border border-gray-200 rounded-xl p-6">
                <div class="flex items-start justify-between mb-4">
                  <div>
                    <h3 class="font-medium text-gray-900">{workflow.name}</h3>
                    <p class="text-sm text-gray-600 mt-1">{workflow.description}</p>
                    <div class="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span>📊 {workflow.steps} steps</span>
                      <span>⏱️ {workflow.runtime || 'Not started'}</span>
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
                    <span class="font-medium text-gray-900 ml-1">{workflow.inputDataset}</span>
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
                      <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {workflow.progress}%"></div>
                    </div>
                  </div>
                {/if}
                
                <div class="flex items-center justify-between">
                  <div class="flex space-x-2">
                    {#if workflow.status === 'draft'}
                      <button 
                        on:click={() => window.location.href = '/data-processing/workflow-builder'}
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
                  <button class="text-sm text-gray-600 hover:text-gray-800">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

