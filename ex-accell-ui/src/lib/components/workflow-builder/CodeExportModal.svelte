<script lang="ts">
  /**
   * Code Export Modal Component
   *
   * Displays generated Python workflow code with multiple tabs for different files.
   * Allows users to view, copy, and download the generated workflow code.
   */

  let {
    show = false,
    pythonWorkflow = null,
    onClose,
    onDownload,
    onCopyToClipboard
  }: {
    show?: boolean;
    pythonWorkflow?: any;
    onClose: () => void;
    onDownload: () => void;
    onCopyToClipboard: (text: string) => void;
  } = $props();

  type CodeTab = 'python' | 'requirements' | 'dapr' | 'activities';
  let activeTab = $state<CodeTab>('python');

  // Close handler
  function handleClose() {
    onClose();
    // Reset to first tab when closing
    activeTab = 'python';
  }

  // Tab configuration
  const tabs = [
    { id: 'python' as CodeTab, label: '🐍 Python Script', icon: '🐍' },
    { id: 'requirements' as CodeTab, label: '📦 Requirements', icon: '📦' },
    { id: 'dapr' as CodeTab, label: '⚡ Dapr Workflow', icon: '⚡' },
    { id: 'activities' as CodeTab, label: '🔧 Activities', icon: '🔧' }
  ];

  // Get code content for active tab
  function getCodeContent(tab: CodeTab): string {
    if (!pythonWorkflow) return '';

    switch (tab) {
      case 'python':
        return pythonWorkflow.pythonScript || '';
      case 'requirements':
        return pythonWorkflow.requirements || '';
      case 'dapr':
        return pythonWorkflow.workflowCode || '';
      case 'activities':
        return pythonWorkflow.activityCode || '';
      default:
        return '';
    }
  }

  // Get tab title
  function getTabTitle(tab: CodeTab): string {
    switch (tab) {
      case 'python':
        return '🐍 Python Workflow Script';
      case 'requirements':
        return '📦 Python Requirements';
      case 'dapr':
        return '⚡ Dapr Workflow Orchestration';
      case 'activities':
        return '🔧 Dapr Activities';
      default:
        return '';
    }
  }
</script>

{#if show && pythonWorkflow}
  <div
    class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="code-export-title">

    <div class="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col">
      <!-- Modal Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
            </svg>
          </div>
          <div>
            <h3 id="code-export-title" class="text-xl font-semibold text-gray-900">Generated Python Workflow</h3>
            <p class="text-sm text-gray-600">
              Pattern: {pythonWorkflow.workflowPattern || 'N/A'} •
              {pythonWorkflow.executionOrder?.length || 0} steps •
              Virtual Environment Enabled
            </p>
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <button
            onclick={onDownload}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
            aria-label="Download workflow files">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span>Download Files</span>
          </button>
          <button
            onclick={handleClose}
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Code Tabs -->
      <div class="border-b border-gray-200">
        <nav class="flex space-x-8 px-6" role="tablist">
          {#each tabs as tab}
            <button
              onclick={() => activeTab = tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="{tab.id}-panel"
              class="py-3 border-b-2 font-medium text-sm transition-colors {activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
              {tab.label}
            </button>
          {/each}
        </nav>
      </div>

      <!-- Code Content -->
      <div class="flex-1 overflow-hidden">
        {#each tabs as tab}
          {#if activeTab === tab.id}
            <div
              id="{tab.id}-panel"
              role="tabpanel"
              aria-labelledby="{tab.id}-tab"
              class="h-full flex flex-col">

              <div class="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                <h4 class="text-sm font-medium text-gray-900">{getTabTitle(tab.id)}</h4>
                <button
                  onclick={() => onCopyToClipboard(getCodeContent(tab.id))}
                  class="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  aria-label="Copy {tab.label} to clipboard">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                  <span>Copy</span>
                </button>
              </div>

              <div class="flex-1 overflow-auto">
                <pre class="text-xs text-gray-800 p-4 bg-gray-50 h-full overflow-auto"><code>{getCodeContent(tab.id)}</code></pre>
              </div>
            </div>
          {/if}
        {/each}
      </div>

      <!-- Modal Footer -->
      <div class="p-6 border-t border-gray-200 bg-gray-50">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-600">
            <p><strong>Workflow Pattern:</strong> {pythonWorkflow.workflowPattern || 'N/A'}</p>
            <p><strong>Steps:</strong> {pythonWorkflow.executionOrder?.length || 0} activities</p>
            <p><strong>Runtime:</strong> Python + Dapr with Virtual Environment</p>
          </div>
          <div class="flex items-center space-x-3">
            <button
              onclick={handleClose}
              class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg text-sm font-medium transition-colors">
              Close
            </button>
            <button
              onclick={onDownload}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              Download All Files
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
