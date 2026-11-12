<script lang="ts">
import { getStatusColor } from '$lib/utils/colorUtils';
  import { formatDateTime } from '$lib/utils/dataCapture/jobList';
  import type { UiJob } from '$lib/utils/dataCapture/types';

  export let activeTab: string;
  export let allJobs: UiJob[];
  export let sortedJobs: UiJob[];
  export let sortBy: string;
  export let sortDirection: 'asc' | 'desc';
  export let loadingJobStates: boolean;
  export let loadJobStates: (forceRefresh?: boolean) => void;
  export let handleSort: (field: string) => void;
  export let handleWavePulseStart: () => void;
  export let handleWavePulseStop: () => void;
  export let editJob: (job: UiJob) => void;
  export let confirmDeleteJob: (job: UiJob) => void;
  export let runCrawl: (jobId: string) => void;
  export let openLogViewer: (job: UiJob) => void;
</script>

<div class="space-y-6">
  <!-- Statistics -->
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
    <div class="bg-white rounded-xl shadow-sm p-6 text-center">
      <div class="text-2xl font-bold text-emerald-600 mb-1">{allJobs.filter(job => job.status === 'running').length}</div>
      <div class="text-sm text-gray-600">Running</div>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6 text-center">
      <div class="text-2xl font-bold text-blue-600 mb-1">{allJobs.filter(job => job.status === 'scheduled').length}</div>
      <div class="text-sm text-gray-600">Scheduled</div>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6 text-center">
      <div class="text-2xl font-bold text-indigo-600 mb-1">{allJobs.filter(job => job.status === 'completed').length}</div>
      <div class="text-sm text-gray-600">Completed</div>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6 text-center">
      <div class="text-2xl font-bold text-rose-600 mb-1">{allJobs.filter(job => job.status === 'failed').length}</div>
      <div class="text-sm text-gray-600">Failed</div>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6 text-center">
      <div class="text-2xl font-bold text-signal-700 mb-1">{allJobs.filter(job => job.type === 'wavepulse').length}</div>
      <div class="text-sm text-gray-600">Radio Streams</div>
    </div>
  </div>

  <!-- Jobs List -->
  <div class="bg-white rounded-xl shadow-sm overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-900">All Scheduled Jobs</h2>
        {#if loadingJobStates}
          <div class="flex items-center text-sm text-gray-500">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading jobs...
          </div>
        {:else}
          <button
            on:click={() => loadJobStates()}
            class="flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Refresh
          </button>
        {/if}
      </div>
    </div>

    <!-- Sorting Controls -->
    {#if allJobs.length > 0}
    <div class="px-6 py-3 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center space-x-2 text-sm">
        <span class="text-gray-600 font-medium mr-2">Sort by:</span>
        <button
          on:click={() => handleSort('type')}
          class="px-3 py-1 rounded-md transition-colors {sortBy === 'type' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}"
        >
          Job Type {sortBy === 'type' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          on:click={() => handleSort('date')}
          class="px-3 py-1 rounded-md transition-colors {sortBy === 'date' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}"
        >
          Date {sortBy === 'date' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          on:click={() => handleSort('status')}
          class="px-3 py-1 rounded-md transition-colors {sortBy === 'status' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}"
        >
          Status {sortBy === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          on:click={() => handleSort('repeat')}
          class="px-3 py-1 rounded-md transition-colors {sortBy === 'repeat' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}"
        >
          Repeat/Single {sortBy === 'repeat' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          on:click={() => handleSort('size')}
          class="px-3 py-1 rounded-md transition-colors {sortBy === 'size' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}"
        >
          Size {sortBy === 'size' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          on:click={() => handleSort('nextRun')}
          class="px-3 py-1 rounded-md transition-colors {sortBy === 'nextRun' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}"
        >
          Next Run {sortBy === 'nextRun' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          on:click={() => handleSort('url')}
          class="px-3 py-1 rounded-md transition-colors {sortBy === 'url' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}"
        >
          URL {sortBy === 'url' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
      </div>
    </div>
    {/if}

    <div class="divide-y divide-gray-200">
      {#if loadingJobStates}
        <div class="p-6 text-center text-gray-500">
          <svg class="mx-auto h-8 w-8 animate-spin text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="mt-2">Loading job states from Dapr state store...</p>
        </div>
      {:else if allJobs.length === 0}
        <div class="p-6 text-center text-gray-500">
          <svg class="mx-auto h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
          </svg>
          <p class="mt-2">No jobs scheduled yet</p>
          <p class="text-sm">Create a new crawl job to get started</p>
        </div>
      {:else}
        <!-- Table View -->
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Schedule
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each sortedJobs as job}
                <tr class="hover:bg-gray-50" data-job-id="{job.id}">
                  <!-- Job Name & Type -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      {#if job.type === 'wavepulse'}
                        <svg class="w-5 h-5 text-signal-700 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828a2 2 0 01-1.414-.586l5-5A2 2 0 009 12.172V5L8 4z"></path>
                        </svg>
                      {:else}
                        <svg class="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0 9c-5 0-9-4-9-9m9 9c5 0 9-4 9-9m0-9v9"></path>
                        </svg>
                      {/if}
                      <div class="min-w-0">
                        <div class="text-sm font-medium text-gray-900 truncate">{job.name}</div>
                        <div class="text-xs text-gray-500">
                          {#if job.type === 'wavepulse'}
                            Radio Stream
                          {:else}
                            Crawler Job
                          {/if}
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- Status -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(job.status)}">
                      {job.status}
                    </span>
                    {#if job.status === 'running' && job.progress !== undefined}
                      <div class="mt-1 w-24">
                        <div class="w-full bg-gray-200 rounded-full h-1">
                          <div class="bg-blue-600 h-1 rounded-full" style="width: {job.progress}%"></div>
                        </div>
                        <div class="text-xs text-gray-500 mt-0.5">{job.progress}%</div>
                      </div>
                    {/if}
                  </td>

                  <!-- Schedule -->
                  <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">{job.schedule || '-'}</div>
                  </td>

                  <!-- Items Collected -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">{(job.itemsCollected || 0).toLocaleString()}</div>
                    {#if job.totalEstimated}
                      <div class="text-xs text-gray-500">of {job.totalEstimated.toLocaleString()}</div>
                    {/if}
                  </td>

                  <!-- Time -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                      {#if job.status === 'scheduled' && job.nextRun}
                        {formatDateTime(job.nextRun)}
                      {:else if job.startTime}
                        {formatDateTime(job.startTime)}
                      {:else}
                        -
                      {/if}
                    </div>
                    <div class="text-xs text-gray-500">
                      {job.status === 'running' ? 'Started' : job.status === 'scheduled' ? 'Next Run' : 'Last Run'}
                    </div>
                  </td>

                  <!-- Actions -->
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {#if job.type === 'wavepulse'}
                      <div class="flex items-center justify-end space-x-2">
                        {#if job.status === 'scheduled' || job.status === 'idle'}
                          <button
                            on:click={handleWavePulseStart}
                            class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-md">
                            Start
                          </button>
                        {:else if job.status === 'running'}
                          <button
                            on:click={handleWavePulseStop}
                            class="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-md">
                            Stop
                          </button>
                        {/if}
                        <button
                          on:click={() => activeTab = 'wavepulse'}
                          class="px-3 py-1 border border-gray-300 text-gray-700 text-xs rounded-md hover:bg-gray-50">
                          Configure
                        </button>
                      </div>
                    {:else}
                      <div class="flex items-center justify-end space-x-2">
                        {#if job.status === 'scheduled' || job.status === 'pending'}
                          <button
                            on:click={() => runCrawl(job.id)}
                            class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md">
                            Run
                          </button>
                        {/if}
                        <button
                          on:click={() => editJob(job)}
                          class="px-2.5 py-1 border border-gray-300 text-gray-700 text-xs rounded-md hover:bg-gray-50">
                          Edit
                        </button>
                        <button
                          on:click={() => confirmDeleteJob(job)}
                          class="px-2.5 py-1 border border-red-300 text-red-700 text-xs rounded-md hover:bg-red-50">
                          Delete
                        </button>
                        {#if job.logs && job.logs.length > 0}
                          <button
                            on:click={() => openLogViewer(job)}
                            class="relative px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md">
                            Logs
                            {#if job.hasNewLogs}
                              <span class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            {/if}
                          </button>
                        {/if}
                      </div>
                    {/if}
                  </td>
                </tr>
                {#if job.error}
                  <tr>
                    <td colspan="6" class="px-6 py-2 bg-red-50">
                      <div class="flex items-center text-sm text-red-800">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Error: {job.error}
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>
