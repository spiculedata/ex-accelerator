<script lang="ts">
  /**
   * Execute Workflow Modal Component
   *
   * Dialog for executing a workflow with configuration options.
   * Allows users to specify execution input (JSON), priority, and trigger type.
   */

  let {
    show = false,
    loading = false,
    executionInput = $bindable('{\n  "dataset_id": "example_dataset",\n  "parameters": {}\n}'),
    executionOptions = $bindable({
      priority: 'medium',
      triggeredBy: 'manual'
    }),
    onClose,
    onExecute
  }: {
    show?: boolean;
    loading?: boolean;
    executionInput?: string;
    executionOptions?: {
      priority: string;
      triggeredBy: string;
    };
    onClose: () => void;
    onExecute: () => void;
  } = $props();

  const inputPlaceholder = '{\n  "dataset_id": "example_dataset",\n  "parameters": {}\n}';

  // JSON validation
  let jsonError = $state('');

  function validateJSON() {
    try {
      if (executionInput.trim()) {
        JSON.parse(executionInput);
        jsonError = '';
      }
    } catch (error) {
      jsonError = error instanceof Error ? error.message : 'Invalid JSON';
    }
  }

  // Handle close
  function handleClose() {
    onClose();
    jsonError = '';
  }

  // Handle execute
  function handleExecute() {
    validateJSON();
    if (jsonError) return;
    onExecute();
  }

  // Handle Enter key (Ctrl+Enter to execute)
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && event.ctrlKey && !jsonError) {
      handleExecute();
    }
  }
</script>

{#if show}
  <div
    class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="execute-workflow-title"
    onkeydown={handleKeyDown}>

    <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <h3 id="execute-workflow-title" class="text-lg font-semibold text-gray-900">Execute Workflow</h3>
          <button
            onclick={handleClose}
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close dialog">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Form -->
        <div class="space-y-4">
          <!-- Execution Input -->
          <div>
            <label for="execution-input" class="block text-sm font-medium text-gray-700 mb-2">
              Execution Input (JSON)
            </label>
            <textarea
              id="execution-input"
              bind:value={executionInput}
              oninput={validateJSON}
              rows={4}
              class="w-full px-3 py-2 border {jsonError ? 'border-red-300' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 {jsonError ? 'focus:ring-red-500' : 'focus:ring-emerald-500'} font-mono text-sm"
              placeholder={inputPlaceholder}
              aria-invalid={jsonError !== ''}
              aria-describedby={jsonError ? 'json-error' : undefined}></textarea>
            {#if jsonError}
              <p id="json-error" class="text-xs text-red-600 mt-1">
                <svg class="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                {jsonError}
              </p>
            {:else}
              <p class="text-xs text-gray-500 mt-1">Provide input data as valid JSON</p>
            {/if}
          </div>

          <!-- Priority and Trigger -->
          <div class="grid grid-cols-2 gap-4">
            <!-- Priority -->
            <div>
              <label for="execution-priority" class="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                id="execution-priority"
                bind:value={executionOptions.priority}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <!-- Triggered By -->
            <div>
              <label for="execution-trigger" class="block text-sm font-medium text-gray-700 mb-2">
                Triggered By
              </label>
              <select
                id="execution-trigger"
                bind:value={executionOptions.triggeredBy}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="manual">Manual</option>
                <option value="api">API</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Help Text -->
        <div class="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div class="flex items-start space-x-2">
            <svg class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div class="text-xs text-emerald-800">
              <p class="font-medium mb-1">Workflow Execution</p>
              <p>Your workflow will be executed using Dapr workflow engine. Monitor progress in real-time after starting.</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end space-x-3 mt-6">
          <button
            onclick={handleClose}
            class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            disabled={loading}>
            Cancel
          </button>
          <button
            onclick={handleExecute}
            disabled={loading || jsonError !== ''}
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
            {#if loading}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {/if}
            <span>{loading ? 'Starting...' : 'Start Execution'}</span>
          </button>
        </div>

        <!-- Keyboard Shortcut Hint -->
        <p class="text-xs text-gray-500 text-center mt-2">
          Press <kbd class="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl+Enter</kbd> to start execution
        </p>
      </div>
    </div>
  </div>
{/if}
