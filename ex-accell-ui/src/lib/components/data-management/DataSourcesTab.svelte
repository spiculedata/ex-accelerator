<script lang="ts">
  import { formatNumber } from '$lib/utils/formatUtils';
  import type { DataSource } from '$lib/utils/dataManagement';

  export let dataSources: DataSource[];
  export let onLinkDataset: () => void;
  export let onStartCrawl: () => void;
  export let onConfigureSource: (source: DataSource) => void;
  export let onPreviewSource: (source: DataSource) => void;
</script>

<!-- Data Sources -->
<div class="flex items-center justify-between mb-4">
  <h3 class="text-lg font-semibold text-gray-900">Data Sources</h3>
  <div class="flex space-x-2">
    <button on:click={onLinkDataset} class="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
      Link dataset
    </button>
    <button on:click={onStartCrawl} class="px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors">
      Start Crawl
    </button>
  </div>
</div>

<div class="bg-white rounded-xl shadow-sm overflow-hidden">
  <table class="min-w-full divide-y divide-gray-200">
    <thead class="bg-gray-50">
      <tr>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Records</th>
        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100">
      {#each dataSources as source}
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="px-4 py-3">
            <div class="flex items-center">
              <span class="text-xl mr-3">{source.icon}</span>
              <div>
                <div class="text-sm font-medium text-gray-900">{source.name}</div>
                <div class="text-xs text-gray-500 truncate max-w-xs">{source.description?.substring(0, 60) || ''}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{source.datasetType || source.sourcePlatform || '—'}</span>
          </td>
          <td class="px-4 py-3 text-right text-sm font-medium text-gray-900">{formatNumber(source.recordsCaptured)}</td>
          <td class="px-4 py-3 text-center">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {
              source.status === 'connected' || source.status === 'available' ? 'bg-green-100 text-green-700' :
              source.status === 'recording' ? 'bg-blue-100 text-blue-700' :
              source.status === 'idle' ? 'bg-gray-100 text-gray-600' :
              'bg-yellow-100 text-yellow-700'
            }">
              {source.status}
            </span>
          </td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end space-x-2">
              {#if source.isRadio}
                <button on:click={() => onConfigureSource(source)} class="text-xs text-blue-600 hover:text-blue-800 font-medium">Configure</button>
              {:else}
                <button on:click={() => onPreviewSource(source)} class="text-xs text-blue-600 hover:text-blue-800 font-medium">Preview</button>
              {/if}
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
