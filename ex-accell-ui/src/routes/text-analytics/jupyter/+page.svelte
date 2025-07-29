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

  let jupyterUrl = 'http://localhost:8888';
  let isJupyterRunning = false;
  let showFullScreen = false;
  
  function checkJupyterStatus() {
    fetch(`${jupyterUrl}/api/status`)
      .then(response => {
        isJupyterRunning = response.ok;
      })
      .catch(() => {
        isJupyterRunning = false;
      });
  }

  function openInNewTab() {
    window.open(`${jupyterUrl}/lab`, '_blank');
  }

  function toggleFullScreen() {
    showFullScreen = !showFullScreen;
  }

  // Check Jupyter status on mount and periodically
  onMount(() => {
    checkJupyterStatus();
    const interval = setInterval(checkJupyterStatus, 5000);
    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  <title>Jupyter Lab - Text Analytics - Social Explorer</title>
  <meta name="description" content="Jupyter Lab interface for interactive text analytics research" />
</svelte:head>

{#if !showFullScreen}
  <Navigation />
{/if}

<div class="min-h-screen bg-gray-50 {showFullScreen ? 'fixed inset-0 z-50' : ''}">
  {#if !showFullScreen}
    <!-- Page Header -->
    <div class="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
      <!-- Background pattern -->
      <div class="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-slate-900/10 opacity-40"></div>
      
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
            <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-red-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
            <div>
              <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Jupyter Lab</h1>
              <p class="text-slate-300 text-lg font-medium">Interactive Python environment for text analytics research and data science</p>
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
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full {isJupyterRunning ? 'bg-blue-400' : 'bg-red-400'}"></div>
              <span class="text-white text-sm">Jupyter Lab {isJupyterRunning ? 'Running' : 'Stopped'}</span>
            </div>
            
            <button 
              on:click={toggleFullScreen}
              class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors border border-white/20 backdrop-blur-sm">
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
              </svg>
              Full Screen
            </button>
            
            <button 
              on:click={openInNewTab}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
              Open in New Tab
            </button>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Full Screen Controls -->
    <div class="absolute top-4 right-4 z-10 flex items-center space-x-2">
      <div class="flex items-center space-x-2 bg-black/20 backdrop-blur-sm rounded-xl px-3 py-2">
        <div class="w-3 h-3 rounded-full {isJupyterRunning ? 'bg-blue-400' : 'bg-red-400'}"></div>
        <span class="text-white text-sm">Jupyter Lab {isJupyterRunning ? 'Running' : 'Stopped'}</span>
      </div>
      
      <button 
        on:click={openInNewTab}
        class="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
      </button>
      
      <button 
        on:click={toggleFullScreen}
        class="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Jupyter Lab Content -->
  <div class="{showFullScreen ? 'h-full' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}">
    <div class="bg-white rounded-xl shadow-sm overflow-hidden {showFullScreen ? 'h-full' : ''}">
      {#if isJupyterRunning}
        <iframe 
          src="{jupyterUrl}/lab" 
          class="w-full {showFullScreen ? 'h-full' : 'h-[800px]'}"
          title="Jupyter Lab Interface">
        </iframe>
      {:else}
        <div class="flex items-center justify-center {showFullScreen ? 'h-full' : 'h-[800px]'} bg-gray-50">
          <div class="text-center">
            <svg class="w-24 h-24 text-gray-400 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
            <h3 class="text-2xl font-bold text-gray-900 mb-4">Jupyter Lab Not Running</h3>
            <p class="text-gray-600 mb-6 max-w-md">Jupyter Lab server is not currently running. Please start it to access the interactive Python environment.</p>
            
            <div class="space-y-4">
              <div class="bg-gray-100 rounded-xl p-4 text-left max-w-lg mx-auto">
                <p class="font-medium text-gray-900 mb-2">Start Jupyter Lab:</p>
                <code class="block bg-gray-900 text-blue-400 p-3 rounded text-sm font-mono">
                  npm run jupyter:start
                </code>
              </div>
              
              <div class="bg-gray-100 rounded-xl p-4 text-left max-w-lg mx-auto">
                <p class="font-medium text-gray-900 mb-2">Or start full development environment:</p>
                <code class="block bg-gray-900 text-blue-400 p-3 rounded text-sm font-mono">
                  npm run dev:jupyter
                </code>
              </div>
            </div>
            
            <button 
              on:click={checkJupyterStatus}
              class="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors">
              Check Status Again
            </button>
          </div>
        </div>
      {/if}
    </div>
    
    {#if !showFullScreen && isJupyterRunning}
      <!-- Quick Access Panel -->
      <div class="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Quick Actions -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div class="space-y-3">
            <button 
              on:click={() => window.open(`${jupyterUrl}/lab/tree/notebooks`, '_blank')}
              class="w-full text-left p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <div>
                  <div class="font-medium text-gray-900">Browse Notebooks</div>
                  <div class="text-sm text-gray-600">View all available notebook templates</div>
                </div>
              </div>
            </button>
            
            <button 
              on:click={() => window.open(`${jupyterUrl}/lab/tree/notebooks/sentiment_analysis.ipynb`, '_blank')}
              class="w-full text-left p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div>
                  <div class="font-medium text-gray-900">Sentiment Analysis</div>
                  <div class="text-sm text-gray-600">Start with sentiment analysis template</div>
                </div>
              </div>
            </button>
            
            <button 
              on:click={() => window.open(`${jupyterUrl}/lab/tree/notebooks/custom_research.ipynb`, '_blank')}
              class="w-full text-left p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                <div>
                  <div class="font-medium text-gray-900">New Notebook</div>
                  <div class="text-sm text-gray-600">Start with blank custom template</div>
                </div>
              </div>
            </button>
          </div>
        </div>
        
        <!-- Available Libraries -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Pre-installed Libraries</h3>
          <div class="grid grid-cols-1 gap-2">
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span class="font-medium text-gray-900 text-sm">pandas</span>
              <span class="text-xs text-gray-600">Data Analysis</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span class="font-medium text-gray-900 text-sm">scikit-learn</span>
              <span class="text-xs text-gray-600">ML</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span class="font-medium text-gray-900 text-sm">nltk</span>
              <span class="text-xs text-gray-600">NLP</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span class="font-medium text-gray-900 text-sm">textblob</span>
              <span class="text-xs text-gray-600">Text Processing</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span class="font-medium text-gray-900 text-sm">matplotlib</span>
              <span class="text-xs text-gray-600">Visualization</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span class="font-medium text-gray-900 text-sm">plotly</span>
              <span class="text-xs text-gray-600">Interactive Charts</span>
            </div>
          </div>
        </div>
        
        <!-- Tips -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Tips & Shortcuts</h3>
          <div class="space-y-3 text-sm">
            <div>
              <div class="font-medium text-gray-900">Shift + Enter</div>
              <div class="text-gray-600">Run current cell</div>
            </div>
            <div>
              <div class="font-medium text-gray-900">Ctrl/Cmd + S</div>
              <div class="text-gray-600">Save notebook</div>
            </div>
            <div>
              <div class="font-medium text-gray-900">A / B</div>
              <div class="text-gray-600">Insert cell above/below</div>
            </div>
            <div>
              <div class="font-medium text-gray-900">M / Y</div>
              <div class="text-gray-600">Change to markdown/code</div>
            </div>
            <div>
              <div class="font-medium text-gray-900">DD</div>
              <div class="text-gray-600">Delete cell</div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>