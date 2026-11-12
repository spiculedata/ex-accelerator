<script lang="ts">
  import { formatNumber } from '$lib/utils/formatUtils';

  export let sourceCount: number;
  export let activeWorkflowCount: number;
  export let totalRecords: number;
  export let workflowCount: number;
  export let datasetCount: number;
  /** The tab the stages open, so bind it */
  export let activeTab: string;
  /** Opening the workflows tab clears the "dataset linked" confirmation, so bind it */
  export let linkNotice: string;
</script>

<!-- Pipeline Overview -->
<div class="bg-white rounded-xl shadow-sm p-4 mb-6 overflow-x-auto">
  <div class="flex items-center justify-between min-w-[600px]">
    <button on:click={() => activeTab = 'capture'} class="flex flex-col items-center px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors {activeTab === 'capture' ? 'bg-blue-50' : ''}">
      <span class="text-2xl mb-1">📡</span>
      <span class="text-xs font-medium text-gray-700">Sources</span>
      <span class="text-lg font-bold text-blue-600">{sourceCount}</span>
    </button>
    <div class="flex-shrink-0 w-8 h-0.5 bg-gray-300"></div>
    <button on:click={() => activeTab = 'capture'} class="flex flex-col items-center px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
      <span class="text-2xl mb-1">⚡</span>
      <span class="text-xs font-medium text-gray-700">Jobs</span>
      <span class="text-lg font-bold text-signal-700">{activeWorkflowCount}</span>
    </button>
    <div class="flex-shrink-0 w-8 h-0.5 bg-gray-300"></div>
    <button class="flex flex-col items-center px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
      <span class="text-2xl mb-1">💾</span>
      <span class="text-xs font-medium text-gray-700">Records</span>
      <span class="text-lg font-bold text-emerald-600">{formatNumber(totalRecords)}</span>
    </button>
    <div class="flex-shrink-0 w-8 h-0.5 bg-gray-300"></div>
    <button on:click={() => { activeTab = 'workflows'; linkNotice = ''; }} class="flex flex-col items-center px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors {activeTab === 'workflows' ? 'bg-blue-50' : ''}">
      <span class="text-2xl mb-1">⚙️</span>
      <span class="text-xs font-medium text-gray-700">Workflows</span>
      <span class="text-lg font-bold text-purple-600">{workflowCount}</span>
    </button>
    <div class="flex-shrink-0 w-8 h-0.5 bg-gray-300"></div>
    <button on:click={() => activeTab = 'datasets'} class="flex flex-col items-center px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors {activeTab === 'datasets' ? 'bg-blue-50' : ''}">
      <span class="text-2xl mb-1">📦</span>
      <span class="text-xs font-medium text-gray-700">Datasets</span>
      <span class="text-lg font-bold text-indigo-600">{datasetCount}</span>
    </button>
    <div class="flex-shrink-0 w-8 h-0.5 bg-gray-300"></div>
    <div class="flex flex-col items-center px-4 py-2">
      <span class="text-2xl mb-1">📊</span>
      <span class="text-xs font-medium text-gray-700">Analytics</span>
      <span class="text-lg font-bold text-green-600">✓</span>
    </div>
  </div>
</div>
