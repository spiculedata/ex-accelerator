<script lang="ts">
import { getStatusColor } from '$lib/utils/colorUtils';
  import type { buildAnalyticsData } from '$lib/utils/dataCapture/jobList';
  import type { UiJob } from '$lib/utils/dataCapture/types';

  export let analyticsData: ReturnType<typeof buildAnalyticsData>;
  export let activeTab: string;
  export let loadingJobStates: boolean;
  export let loadJobStates: (forceRefresh?: boolean) => void;
  export let editJob: (job: UiJob) => void;
  export let confirmDeleteJob: (job: UiJob) => void;
  export let openLogViewer: (job: UiJob) => void;
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-2xl font-semibold text-gray-900">Analytics Dashboard</h2>
      <p class="text-gray-600">Real-time statistics and insights for your data capture operations</p>
    </div>
    <button 
      on:click={() => loadJobStates(true)}
      disabled={loadingJobStates}
      class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center">
      <svg class="w-4 h-4 mr-2 {loadingJobStates ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
      </svg>
      Refresh Data
    </button>
  </div>

  <!-- Key Metrics -->
  <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
    <div class="bg-white rounded-xl shadow-sm p-6 text-center border border-gray-200">
      <div class="text-3xl font-bold text-blue-600 mb-2">{analyticsData.totalJobs}</div>
      <div class="text-sm font-medium text-gray-600">Total Jobs</div>
    </div>
    
    <div class="bg-white rounded-xl shadow-sm p-6 text-center border border-emerald-200">
      <div class="text-3xl font-bold text-emerald-600 mb-2">{analyticsData.runningJobs}</div>
      <div class="text-sm font-medium text-gray-600">Running</div>
    </div>
    
    <div class="bg-white rounded-xl shadow-sm p-6 text-center border border-green-200">
      <div class="text-3xl font-bold text-green-600 mb-2">{analyticsData.completedJobs}</div>
      <div class="text-sm font-medium text-gray-600">Completed</div>
    </div>
    
    <div class="bg-white rounded-xl shadow-sm p-6 text-center border border-red-200">
      <div class="text-3xl font-bold text-red-600 mb-2">{analyticsData.failedJobs}</div>
      <div class="text-sm font-medium text-gray-600">Failed</div>
    </div>
    
    <div class="bg-white rounded-xl shadow-sm p-6 text-center border border-yellow-200">
      <div class="text-3xl font-bold text-signal-700 mb-2">{analyticsData.pendingJobs}</div>
      <div class="text-sm font-medium text-gray-600">Pending</div>
    </div>
    
    <div class="bg-white rounded-xl shadow-sm p-6 text-center border border-purple-200">
      <div class="text-3xl font-bold text-purple-600 mb-2">{analyticsData.totalItemsCollected.toLocaleString()}</div>
      <div class="text-sm font-medium text-gray-600">Items Collected</div>
    </div>
  </div>

  <!-- Platform Distribution -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Jobs by Platform</h3>
      <div class="space-y-3">
        {#each Object.entries(analyticsData.jobsByPlatform) as [platform, count]}
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <span class="text-sm font-medium text-gray-700 capitalize">{platform}</span>
            </div>
            <span class="text-sm font-bold text-gray-900">{count}</span>
          </div>
        {/each}
        {#if Object.keys(analyticsData.jobsByPlatform).length === 0}
          <div class="text-center text-gray-500 py-4">No jobs found</div>
        {/if}
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-600">Avg Items per Job</span>
          <span class="text-sm font-bold text-gray-900">{analyticsData.averageItemsPerJob.toLocaleString()}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-600">Success Rate</span>
          <span class="text-sm font-bold text-gray-900">
            {analyticsData.totalJobs > 0 ? Math.round((analyticsData.completedJobs / analyticsData.totalJobs) * 100) : 0}%
          </span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-600">Active Jobs</span>
          <span class="text-sm font-bold text-gray-900">{analyticsData.runningJobs + analyticsData.pendingJobs}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Recent Jobs -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200">
    <div class="p-6 border-b border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900">Recent Jobs</h3>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each analyticsData.recentJobs as job}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{job.name}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-500 capitalize">{job.platform || 'unknown'}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(job.status)}">
                  {job.status}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {job.itemsCollected || 0}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {job.startTime ? new Date(job.startTime).toLocaleDateString() : 'N/A'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                {#if job.stateData}
                  <button 
                    on:click={() => editJob(job)}
                    class="text-blue-600 hover:text-blue-900 transition-colors">
                    Edit
                  </button>
                  <button 
                    on:click={() => confirmDeleteJob(job)}
                    class="text-red-600 hover:text-red-900 transition-colors">
                    Delete
                  </button>
                {/if}
                {#if job.status === 'running'}
                  <button 
                    on:click={() => openLogViewer(job)}
                    class="text-green-600 hover:text-green-900 transition-colors">
                    Logs
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
          {#if analyticsData.recentJobs.length === 0}
            <tr>
              <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                No recent jobs found
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Jobs by Status -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <div class="bg-white rounded-xl shadow-sm border border-gray-200">
      <div class="p-4 border-b border-gray-200">
        <h4 class="text-md font-semibold text-emerald-600">Running Jobs ({analyticsData.jobsByStatus.running.length})</h4>
      </div>
      <div class="p-4 max-h-64 overflow-y-auto">
        {#each analyticsData.jobsByStatus.running as job}
          <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
            <span class="text-sm text-gray-700 truncate">{job.name}</span>
            <span class="text-xs text-gray-500">{job.progress || 0}%</span>
          </div>
        {/each}
        {#if analyticsData.jobsByStatus.running.length === 0}
          <div class="text-center text-gray-500 py-4 text-sm">No running jobs</div>
        {/if}
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200">
      <div class="p-4 border-b border-gray-200">
        <h4 class="text-md font-semibold text-green-600">Completed Jobs ({analyticsData.jobsByStatus.completed.length})</h4>
      </div>
      <div class="p-4 max-h-64 overflow-y-auto">
        {#each analyticsData.jobsByStatus.completed.slice(0, 10) as job}
          <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
            <span class="text-sm text-gray-700 truncate">{job.name}</span>
            <span class="text-xs text-gray-500">{job.itemsCollected || 0} items</span>
          </div>
        {/each}
        {#if analyticsData.jobsByStatus.completed.length === 0}
          <div class="text-center text-gray-500 py-4 text-sm">No completed jobs</div>
        {/if}
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200">
      <div class="p-4 border-b border-gray-200">
        <h4 class="text-md font-semibold text-red-600">Failed Jobs ({analyticsData.jobsByStatus.failed.length})</h4>
      </div>
      <div class="p-4 max-h-64 overflow-y-auto">
        {#each analyticsData.jobsByStatus.failed as job}
          <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
            <span class="text-sm text-gray-700 truncate">{job.name}</span>
            <button 
              on:click={() => editJob(job)}
              class="text-xs text-blue-600 hover:text-blue-800">
              Retry
            </button>
          </div>
        {/each}
        {#if analyticsData.jobsByStatus.failed.length === 0}
          <div class="text-center text-gray-500 py-4 text-sm">No failed jobs</div>
        {/if}
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200">
      <div class="p-4 border-b border-gray-200">
        <h4 class="text-md font-semibold text-signal-700">Pending Jobs ({analyticsData.jobsByStatus.pending.length})</h4>
      </div>
      <div class="p-4 max-h-64 overflow-y-auto">
        {#each analyticsData.jobsByStatus.pending as job}
          <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
            <span class="text-sm text-gray-700 truncate">{job.name}</span>
            <span class="text-xs text-gray-500">Scheduled</span>
          </div>
        {/each}
        {#if analyticsData.jobsByStatus.pending.length === 0}
          <div class="text-center text-gray-500 py-4 text-sm">No pending jobs</div>
        {/if}
      </div>
    </div>
  </div>
</div>
