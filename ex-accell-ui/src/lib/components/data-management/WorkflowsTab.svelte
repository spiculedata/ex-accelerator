<script lang="ts">
  import { getStatusColor } from '$lib/utils/colorUtils';
  import { formatTimestamp, getStatusIcon, type DataRow } from '$lib/utils/dataManagement';

  export let workflows: DataRow[];
  export let onNewWorkflow: () => void;
  export let onOpenInBuilder: (workflow: DataRow) => void;
</script>

<!-- Processing Workflows -->
<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-semibold text-gray-900">Processing Workflows</h2>
    <button
      on:click={onNewWorkflow}
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
              {#if workflow.steps}<span>📊 {workflow.steps} steps</span>{/if}
              {#if workflow.recordsProcessed}
                <span>📈 {workflow.recordsProcessed.toLocaleString()} records</span>
              {/if}
              {#if workflow.created}<span>📅 {formatTimestamp(workflow.created)}</span>{/if}
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(workflow.status)}">
              {getStatusIcon(workflow.status)} {workflow.status}
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between mb-4">
          <div class="text-sm">
            <span class="text-gray-600">Input:</span>
            <span class="font-medium text-gray-900 ml-1">{workflow.inputSource || workflow.input_source || '—'}</span>
            <span class="text-gray-500 mx-2">→</span>
            <span class="text-gray-600">Output:</span>
            <span class="font-medium text-gray-900 ml-1">{workflow.outputDataset || workflow.output_dataset || '—'}</span>
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
            <!-- Only actions that work are shown: a draft opens in the builder. Run, stop, logs, results and download have no handler yet -->
            {#if workflow.status === 'draft'}
              <button
                on:click={() => onOpenInBuilder(workflow)}
                class="text-sm text-blue-600 hover:text-blue-800 font-medium">Open in builder</button>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>
