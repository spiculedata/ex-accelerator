<script lang="ts">
import { getStatusColor } from '$lib/utils/colorUtils';
  import { formatDateTime } from '$lib/utils/dataCapture/jobList';
  import type { UiJob } from '$lib/utils/dataCapture/types';

  export let currentLogJob: UiJob;
  export let logContainer: HTMLElement | null;
  export let logScrollAnchor: HTMLElement | null;
  export let closeLogViewer: () => void;
</script>

<div class="fixed inset-0 bg-gray-500/20 backdrop-blur-sm flex items-center justify-center z-50 p-4" on:click={closeLogViewer}>
  <div class="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col" on:click|stopPropagation>
    <!-- Modal Header -->
    <div class="flex items-center justify-between p-6 border-b border-gray-200">
      <div class="flex items-center space-x-3">
        <h2 class="text-xl font-semibold text-gray-900">Crawl Logs</h2>
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(currentLogJob.status)}">
          {currentLogJob.status}
        </span>
      </div>
      <button 
        on:click={closeLogViewer}
        class="text-gray-500 hover:text-gray-600 transition-colors">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>

    <!-- Job Info -->
    <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <span class="font-medium text-gray-700">Job Name:</span>
          <span class="ml-2 text-gray-900">{currentLogJob.name}</span>
        </div>
        <div>
          <span class="font-medium text-gray-700">Started:</span>
          <span class="ml-2 text-gray-900">
            {currentLogJob.startTime ? formatDateTime(currentLogJob.startTime) : 'Not started'}
          </span>
        </div>
        <div>
          <span class="font-medium text-gray-700">Items Collected:</span>
          <span class="ml-2 text-gray-900">{(currentLogJob.itemsCollected || 0).toLocaleString()}</span>
        </div>
      </div>
      
      {#if currentLogJob.status === 'running' && currentLogJob.progress !== undefined}
        <div class="mt-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium text-gray-700">Progress</span>
            <span class="text-sm text-gray-500">{currentLogJob.progress}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {currentLogJob.progress}%"></div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Logs Container -->
    <div class="flex-1 overflow-hidden p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">
          {currentLogJob.status === 'running' ? 'Live Logs' : 'Complete Log Output'}
        </h3>
        {#if currentLogJob.status === 'running'}
          <div class="flex items-center space-x-4">
            <div class="flex items-center text-sm text-blue-600">
              <div class="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
              Live updating
            </div>
            <div class="text-xs text-gray-500">
              Updates every 2 seconds
            </div>
          </div>
        {/if}
      </div>
      
      <div 
        bind:this={logContainer}
        class="bg-gray-900 rounded-xl p-4 overflow-y-auto font-mono text-sm" style="height: 24rem; max-height: 50vh;">
        {#if currentLogJob.logs && currentLogJob.logs.length > 0}
          {#each currentLogJob.logs as logLine, index}
            <div class="mb-1 {logLine.includes('ERROR') ? 'text-red-400' : logLine.includes('WARN') ? 'text-yellow-400' : logLine.includes('DEBUG') ? 'text-blue-400' : logLine.includes('INFO') ? 'text-green-400' : 'text-gray-300'}">
              <span class="text-gray-500 text-xs mr-2">{index + 1}</span>
              {logLine}
            </div>
          {/each}
          <!-- Auto-scroll anchor -->
          <div bind:this={logScrollAnchor}></div>
        {:else}
          <div class="text-gray-500 italic">No logs available for this job.</div>
        {/if}
      </div>
    </div>

    <!-- Modal Footer -->
    <div class="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
      <div class="text-sm text-gray-500">
        {currentLogJob.logs ? currentLogJob.logs.length : 0} log entries
      </div>
      <div class="flex space-x-3">
        <button 
          on:click={() => navigator.clipboard.writeText(currentLogJob.logs.join('\n'))}
          class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors">
          Copy Logs
        </button>
        <button 
          on:click={closeLogViewer}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors">
          Close
        </button>
      </div>
    </div>
  </div>
</div>
