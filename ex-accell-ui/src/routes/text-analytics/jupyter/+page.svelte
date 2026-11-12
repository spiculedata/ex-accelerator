<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { goto } from '$app/navigation';
  import { currentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  import {
    connectJupyter,
    fetchJupyterStatus,
    initialJupyterPoll,
    jupyterLink,
    nextJupyterPoll,
    type JupyterConnection,
    type JupyterPoll
  } from '$lib/utils/jupyterClient';
  import CopyCommand from '$lib/components/ui/CopyCommand.svelte';
  
  // Redirect to projects if no current project
  onMount(() => {
    if (!$currentProject) {
      goto('/projects');
    }
  });

  let connection: JupyterConnection | null = null;
  let poll: JupyterPoll = initialJupyterPoll;
  let isLaunching = false;
  let showFullScreen = false;

  $: isJupyterRunning = poll.phase === 'running' && connection !== null;
  $: isStarting = isLaunching || poll.phase === 'starting';
  $: statusLabel = isJupyterRunning ? 'Running' : isStarting ? 'Starting…' : 'Stopped';

  // Only an explicit click starts the server; the status check below never launches anything
  let errorMessage = '';

  async function startJupyter() {
    if (isLaunching) return;
    errorMessage = '';
    isLaunching = true;
    try {
      const started = await connectJupyter((message) => (errorMessage = message));
      if (!started) return;
      connection = started;
      poll = nextJupyterPoll(poll, 'running');
    } finally {
      isLaunching = false;
    }
  }

  let isChecking = false;

  // Asks the server, which can see a Jupyter that was already running before this page loaded. One failed
  // check does not drop an open notebook (see nextJupyterPoll).
  async function checkJupyterStatus() {
    if (isChecking || isLaunching) return;
    isChecking = true;
    try {
      const { observed, connection: found } = await fetchJupyterStatus();
      poll = nextJupyterPoll(poll, observed);
      if (found) connection = found;
      else if (poll.phase !== 'running') connection = null;
    } finally {
      isChecking = false;
    }
  }

  function openInNewTab() {
    if (!connection) return;
    window.open(jupyterLink(connection, '/lab'), '_blank');
  }

  function toggleFullScreen() {
    showFullScreen = !showFullScreen;
  }

  // Check Jupyter status as soon as the page loads, then periodically
  onMount(() => {
    void checkJupyterStatus();
    const interval = setInterval(checkJupyterStatus, 5000);
    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  <title>Jupyter Lab - Text Analytics - Social Explorer</title>
  <meta name="description" content="Jupyter Lab interface for interactive text analytics research" />
</svelte:head>

<div class="min-h-screen bg-gray-50 {showFullScreen ? 'fixed inset-0 z-50' : ''}">
  {#if !showFullScreen}
    <PageHeader
      title="Jupyter Lab"
      subtitle="Interactive Python environment for text analytics research and data science"
      backHref="/text-analytics"
      iconPath="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z">
      <svelte:fragment slot="actions">
        <span class="inline-flex items-center gap-2 text-sm text-white">
          <span class="w-3 h-3 rounded-full {isJupyterRunning ? 'bg-success-400' : isStarting ? 'bg-signal-400' : 'bg-danger-400'}" aria-hidden="true"></span>
          Jupyter Lab {statusLabel}
        </span>
        <button
          on:click={toggleFullScreen}
          class="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
          </svg>
          Full Screen
        </button>
        <button
          on:click={openInNewTab}
          class="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-primary-600 hover:bg-primary-500 text-white transition-colors">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
          Open in New Tab
        </button>
      </svelte:fragment>
    </PageHeader>

  {:else}
    <!-- Full Screen Controls -->
    <div class="absolute top-4 right-4 z-10 flex items-center space-x-2">
      <div class="flex items-center space-x-2 bg-black/20 backdrop-blur-sm rounded-xl px-3 py-2">
        <div class="w-3 h-3 rounded-full {isJupyterRunning ? 'bg-blue-400' : 'bg-red-400'}"></div>
        <span class="text-white text-sm">Jupyter Lab {statusLabel}</span>
      </div>
      
      <button 
        on:click={openInNewTab}
        class="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
        aria-label="Open Jupyter Lab in new tab">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
      </button>
      
      <button 
        on:click={toggleFullScreen}
        class="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors"
        aria-label="Exit full screen mode">
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
          src="{jupyterLink(connection, '/lab')}" 
          class="w-full {showFullScreen ? 'h-full' : 'h-[800px]'}"
          title="Jupyter Lab Interface">
        </iframe>
      {:else}
        <div class="flex items-center justify-center {showFullScreen ? 'h-full' : 'h-[800px]'} bg-gray-50">
          <div class="text-center">
            <svg class="w-24 h-24 text-gray-500 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
            <h3 class="text-2xl font-bold text-gray-900 mb-4">{isStarting ? 'Starting Jupyter Lab…' : 'Jupyter Lab Not Running'}</h3>
            <p class="text-gray-600 mb-6 max-w-md">
              {isStarting
                ? 'Jupyter Lab is starting. It opens here as soon as it is ready.'
                : 'Jupyter Lab server is not currently running. Please start it to access the interactive Python environment.'}
            </p>
            
            <div class="space-y-4">
              <div class="max-w-lg mx-auto text-left space-y-3">
                <div>
                  <p class="mb-1 font-medium text-ink-900">1. First time only: set Jupyter up</p>
                  <CopyCommand command="npm run jupyter:bootstrap" />
                </div>
                <div>
                  <p class="mb-1 font-medium text-ink-900">2. Start it</p>
                  <CopyCommand command="npm run jupyter:start" />
                </div>
                <p class="text-sm text-ink-600">
                  Or use the Start Jupyter Lab button on the
                  <a class="text-primary-700 underline" href="/text-analytics/research-investigation">Research page</a>.
                  See the <a class="text-primary-700 underline" href="https://spiculedata.github.io/social-explorer/tutorials/jupyter" target="_blank" rel="noopener">Jupyter guide</a>.
                </p>
              </div>
            </div>
            
            {#if errorMessage}
              <p class="mt-4 text-sm text-red-700 max-w-md mx-auto" role="alert">{errorMessage}</p>
            {/if}

            <button 
              on:click={startJupyter}
              class="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors">
              Start Jupyter Lab
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
              on:click={() => window.open(jupyterLink(connection, '/lab/tree'), '_blank')}
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
              on:click={() => window.open(jupyterLink(connection, '/lab/tree/sentiment_analysis.ipynb'), '_blank')}
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
              on:click={() => window.open(jupyterLink(connection, '/lab/tree/custom_research.ipynb'), '_blank')}
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