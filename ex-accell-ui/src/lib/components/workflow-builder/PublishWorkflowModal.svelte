<script lang="ts">
  /**
   * Publish Workflow Modal Component
   *
   * Dialog for publishing a workflow with metadata (name, description, version, tags).
   * Validates required fields and handles the publish action.
   */

  let {
    show = false,
    loading = false,
    metadata = $bindable({
      name: '',
      description: '',
      version: '1.0.0',
      createdBy: '',
      tags: ''
    }),
    onClose,
    onPublish
  }: {
    show?: boolean;
    loading?: boolean;
    metadata?: {
      name: string;
      description: string;
      version: string;
      createdBy: string;
      tags: string;
    };
    onClose: () => void;
    onPublish: () => void;
  } = $props();

  // Form validation
  let isValid = $derived(metadata.name.trim() !== '');

  // Handle close
  function handleClose() {
    onClose();
  }

  // Handle publish
  function handlePublish() {
    if (!isValid) return;
    onPublish();
  }

  // Handle Enter key in form
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && event.ctrlKey && isValid) {
      handlePublish();
    }
  }
</script>

{#if show}
  <div
    class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="publish-workflow-title"
    onkeydown={handleKeyDown}>

    <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <h3 id="publish-workflow-title" class="text-lg font-semibold text-gray-900">Publish Workflow</h3>
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
          <!-- Workflow Name -->
          <div>
            <label for="workflow-name" class="block text-sm font-medium text-gray-700 mb-2">
              Workflow Name <span class="text-red-500">*</span>
            </label>
            <input
              id="workflow-name"
              type="text"
              bind:value={metadata.name}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter workflow name"
              required
              aria-required="true">
            {#if metadata.name.trim() === ''}
              <p class="text-xs text-gray-500 mt-1">Required field</p>
            {/if}
          </div>

          <!-- Description -->
          <div>
            <label for="workflow-description" class="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="workflow-description"
              bind:value={metadata.description}
              rows={3}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Describe what this workflow does"></textarea>
          </div>

          <!-- Version and Created By -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="workflow-version" class="block text-sm font-medium text-gray-700 mb-2">
                Version
              </label>
              <input
                id="workflow-version"
                type="text"
                bind:value={metadata.version}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="1.0.0">
            </div>
            <div>
              <label for="workflow-creator" class="block text-sm font-medium text-gray-700 mb-2">
                Created By
              </label>
              <input
                id="workflow-creator"
                type="text"
                bind:value={metadata.createdBy}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your name">
            </div>
          </div>

          <!-- Tags -->
          <div>
            <label for="workflow-tags" class="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              id="workflow-tags"
              type="text"
              bind:value={metadata.tags}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="data-processing, analytics, nlp">
            <p class="text-xs text-gray-500 mt-1">Separate multiple tags with commas</p>
          </div>
        </div>

        <!-- Help Text -->
        <div class="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div class="flex items-start space-x-2">
            <svg class="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div class="text-xs text-purple-800">
              <p class="font-medium mb-1">Publishing your workflow</p>
              <p>This will save your workflow to the database and make it available for execution and sharing.</p>
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
            onclick={handlePublish}
            disabled={loading || !isValid}
            class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
            {#if loading}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {/if}
            <span>{loading ? 'Publishing...' : 'Publish Workflow'}</span>
          </button>
        </div>

        <!-- Keyboard Shortcut Hint -->
        <p class="text-xs text-gray-500 text-center mt-2">
          Press <kbd class="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl+Enter</kbd> to publish
        </p>
      </div>
    </div>
  </div>
{/if}
