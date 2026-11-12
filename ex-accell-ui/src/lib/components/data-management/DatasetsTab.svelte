<script lang="ts">
  import { getStatusColor } from '$lib/utils/colorUtils';
  import { formatTimestamp, type DataRow } from '$lib/utils/dataManagement';
  import { formatNumber } from '$lib/utils/formatUtils';

  export let datasets: DataRow[];
  export let onStartCrawl: () => void;
  export let onProcessDataset: (dataset: DataRow) => void;
  export let onPreviewDataset: (dataset: DataRow) => void;
</script>

<!-- Available Datasets -->
<div class="flex items-center justify-between mb-4">
  <h3 class="text-lg font-semibold text-gray-900">Available Datasets</h3>
  <button on:click={onStartCrawl} class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
    Start crawl
  </button>
</div>

<div class="bg-white rounded-xl shadow-sm overflow-hidden">
  <table class="min-w-full divide-y divide-gray-200">
    <thead class="bg-gray-50">
      <tr>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dataset</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Records</th>
        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100">
      {#each datasets as dataset}
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-gray-900">{dataset.name}</div>
            {#if dataset.columns && dataset.columns.length > 0}
              <div class="flex flex-wrap gap-1 mt-1">
                {#each dataset.columns.slice(0, 3) as column}
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{column}</span>
                {/each}
                {#if dataset.columns.length > 3}
                  <span class="text-xs text-gray-500">+{dataset.columns.length - 3}</span>
                {/if}
              </div>
            {/if}
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{dataset.dataset_type || dataset.type || 'unknown'}</span>
          </td>
          <td class="px-4 py-3 text-right text-sm font-medium text-gray-900">{formatNumber(parseInt(dataset.record_count) || dataset.records || 0)}</td>
          <td class="px-4 py-3 text-center">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getStatusColor(dataset.status)}">
              {dataset.status}
            </span>
          </td>
          <td class="px-4 py-3 text-xs text-gray-500">
            {#if dataset.created || dataset.last_updated}
              {formatTimestamp(dataset.created || dataset.last_updated).split(',')[0]}
            {:else}
              —
            {/if}
          </td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end space-x-2">
              <button on:click={() => onProcessDataset(dataset)} class="text-xs text-teal-600 hover:text-teal-800 font-medium">Process</button>
              <button on:click={() => onPreviewDataset(dataset)} class="text-xs text-blue-600 hover:text-blue-800 font-medium">Preview</button>
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
