<script lang="ts">
  /**
   * Step Configuration Panel Component
   *
   * Displays configuration options for the currently selected workflow step.
   * Provides dynamic form inputs based on step type with real-time updates.
   */

  import { workflowBuilder, type WorkflowStep, type Dataset } from '$lib/stores/workflowBuilderStore';

  // Props
  let {
    availableDatasets = [],
    loadingDatasets = false,
    onRefreshDatasets
  }: {
    availableDatasets?: Dataset[];
    loadingDatasets?: boolean;
    onRefreshDatasets?: () => void;
  } = $props();

  // Subscribe to selected step
  let selectedStep = $derived($workflowBuilder.selectedStep);
  let showPanel = $derived($workflowBuilder.showStepConfig);

  // Update step configuration
  function updateStepConfig(config: Record<string, any>) {
    if (!selectedStep) return;
    workflowBuilder.updateStepConfig(selectedStep.id, config);
  }

  // Get selected dataset info
  function getSelectedDataset(datasetId: string): Dataset | undefined {
    return availableDatasets.find(d => d.id === datasetId);
  }

  // Dataset type icon helper
  function getDatasetIcon(type: string): string {
    const icons: Record<string, string> = {
      unified: '🔗',
      social_media: '📱',
      analytics: '📊',
      mobile_analytics: '📱'
    };
    return icons[type] || '📄';
  }

  // Close panel
  function closePanel() {
    workflowBuilder.toggleStepConfig(false);
  }
</script>

{#if showPanel && selectedStep}
  <div class="w-80 bg-white border-l border-gray-200 overflow-y-auto">
    <div class="p-4">
      <!-- Panel Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Configure Step</h3>
        <button
          onclick={closePanel}
          class="text-gray-500 hover:text-gray-600 transition-colors"
          aria-label="Close configuration panel">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Step Info Card -->
      <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl mb-4">
        <span class="text-xl">{selectedStep.icon}</span>
        <div>
          <h4 class="font-medium text-gray-900">{selectedStep.name}</h4>
          <p class="text-sm text-gray-600">{selectedStep.description}</p>
        </div>
      </div>

      <!-- Dynamic Configuration Form -->
      <div class="space-y-4">
        {#if selectedStep.type === 'dataset_input'}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Dataset</label>
            {#if loadingDatasets}
              <div class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-sm text-gray-600">Loading datasets...</span>
              </div>
            {:else}
              <select
                bind:value={selectedStep.config.dataset_id}
                onchange={(e: Event) => updateStepConfig({ dataset_id: (e.target as HTMLSelectElement).value })}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select dataset...</option>
                {#each availableDatasets as dataset}
                  <option value={dataset.id}>{dataset.name}</option>
                {/each}
              </select>

              {#if selectedStep.config.dataset_id}
                {@const selectedDataset = getSelectedDataset(selectedStep.config.dataset_id)}
                {#if selectedDataset}
                  <div class="mt-2 p-3 bg-blue-50 rounded-lg">
                    <div class="flex items-start space-x-2">
                      <div class="flex-shrink-0 mt-0.5">
                        <span class="text-lg">{getDatasetIcon(selectedDataset.type)}</span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-blue-900">{selectedDataset.name}</p>
                        <p class="text-xs text-blue-700">{selectedDataset.description}</p>
                        <p class="text-xs text-blue-600 mt-1">Table: {selectedDataset.table}</p>
                      </div>
                    </div>
                  </div>
                {/if}
              {/if}

              {#if availableDatasets.length === 0}
                <div class="mt-2 p-3 bg-yellow-50 rounded-lg">
                  <div class="flex items-center space-x-2">
                    <span class="text-signal-700">⚠️</span>
                    <div>
                      <p class="text-sm font-medium text-yellow-800">No datasets available</p>
                      <p class="text-xs text-yellow-700">Run data collection or import datasets to get started</p>
                    </div>
                  </div>
                </div>
              {/if}
            {/if}

            {#if onRefreshDatasets}
              <div class="mt-3">
                <button
                  onclick={onRefreshDatasets}
                  class="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  <span>Refresh datasets</span>
                </button>
              </div>
            {/if}
          </div>

        {:else if selectedStep.type === 'remove_duplicates'}
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Columns to Check for Duplicates</label>
              <input
                type="text"
                value={Array.isArray(selectedStep.config.columns) ? selectedStep.config.columns.join(', ') : ''}
                oninput={(e: Event) => {
                  const value = (e.target as HTMLInputElement).value;
                  const columns = value.split(',').map(c => c.trim()).filter(Boolean);
                  updateStepConfig({ columns });
                }}
                placeholder="e.g., id, email, name (leave empty for all columns)"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <p class="text-xs text-gray-500 mt-1">Enter column names separated by commas, or leave empty to check all columns</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Keep Strategy</label>
              <select
                bind:value={selectedStep.config.keep}
                onchange={(e: Event) => updateStepConfig({ keep: (e.target as HTMLSelectElement).value })}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="first">Keep First Occurrence</option>
                <option value="last">Keep Last Occurrence</option>
              </select>
              <p class="text-xs text-gray-500 mt-1">Choose which duplicate record to keep when duplicates are found</p>
            </div>

            <div class="bg-blue-50 p-3 rounded-lg">
              <div class="flex items-start space-x-2">
                <span class="text-blue-600 mt-0.5">ℹ️</span>
                <div>
                  <p class="text-sm font-medium text-blue-900">Duplicate Detection</p>
                  <p class="text-xs text-blue-700">Uses Polars for high-performance duplicate detection. If no columns are specified, all columns will be compared for exact matches.</p>
                </div>
              </div>
            </div>
          </div>

        {:else if selectedStep.type === 'handle_missing'}
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Strategy</label>
              <select
                bind:value={selectedStep.config.strategy}
                onchange={(e: Event) => updateStepConfig({ strategy: (e.target as HTMLSelectElement).value })}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="drop">Drop rows with missing values</option>
                <option value="fill">Fill with specified value</option>
                <option value="forward">Forward fill</option>
                <option value="backward">Backward fill</option>
                <option value="mean">Fill with mean</option>
                <option value="median">Fill with median</option>
              </select>
            </div>

            {#if selectedStep.config.strategy === 'fill'}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Fill Value</label>
                <input
                  type="text"
                  bind:value={selectedStep.config.fill_value}
                  oninput={(e: Event) => updateStepConfig({ fill_value: (e.target as HTMLInputElement).value })}
                  placeholder="Value to fill missing data"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
            {/if}

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Columns</label>
              <input
                type="text"
                value={Array.isArray(selectedStep.config.columns) ? selectedStep.config.columns.join(', ') : ''}
                oninput={(e: Event) => {
                  const value = (e.target as HTMLInputElement).value;
                  const columns = value.split(',').map(c => c.trim()).filter(Boolean);
                  updateStepConfig({ columns });
                }}
                placeholder="Leave empty for all columns"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

        {:else if selectedStep.type === 'text_preprocessing'}
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Text Columns</label>
              <input
                type="text"
                value={Array.isArray(selectedStep.config.columns) ? selectedStep.config.columns.join(', ') : ''}
                oninput={(e: Event) => {
                  const value = (e.target as HTMLInputElement).value;
                  const columns = value.split(',').map(c => c.trim()).filter(Boolean);
                  updateStepConfig({ columns });
                }}
                placeholder="comma-separated column names"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <div class="space-y-2">
              <label class="flex items-center">
                <input
                  type="checkbox"
                  bind:checked={selectedStep.config.lowercase}
                  onchange={(e: Event) => updateStepConfig({ lowercase: (e.target as HTMLInputElement).checked })}
                  class="rounded">
                <span class="ml-2 text-sm text-gray-700">Convert to lowercase</span>
              </label>
              <label class="flex items-center">
                <input
                  type="checkbox"
                  bind:checked={selectedStep.config.remove_punctuation}
                  onchange={(e: Event) => updateStepConfig({ remove_punctuation: (e.target as HTMLInputElement).checked })}
                  class="rounded">
                <span class="ml-2 text-sm text-gray-700">Remove punctuation</span>
              </label>
              <label class="flex items-center">
                <input
                  type="checkbox"
                  bind:checked={selectedStep.config.remove_stopwords}
                  onchange={(e: Event) => updateStepConfig({ remove_stopwords: (e.target as HTMLInputElement).checked })}
                  class="rounded">
                <span class="ml-2 text-sm text-gray-700">Remove stopwords</span>
              </label>
              <label class="flex items-center">
                <input
                  type="checkbox"
                  bind:checked={selectedStep.config.stem}
                  onchange={(e: Event) => updateStepConfig({ stem: (e.target as HTMLInputElement).checked })}
                  class="rounded">
                <span class="ml-2 text-sm text-gray-700">Apply stemming</span>
              </label>
              <label class="flex items-center">
                <input
                  type="checkbox"
                  bind:checked={selectedStep.config.lemmatize}
                  onchange={(e: Event) => updateStepConfig({ lemmatize: (e.target as HTMLInputElement).checked })}
                  class="rounded">
                <span class="ml-2 text-sm text-gray-700">Apply lemmatization</span>
              </label>
            </div>
          </div>

        {:else if selectedStep.type === 'sentiment_analysis'}
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Text Column</label>
              <input
                type="text"
                bind:value={selectedStep.config.text_column}
                oninput={(e: Event) => updateStepConfig({ text_column: (e.target as HTMLInputElement).value })}
                placeholder="text column name"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Model</label>
              <select
                bind:value={selectedStep.config.model}
                onchange={(e: Event) => updateStepConfig({ model: (e.target as HTMLSelectElement).value })}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="vader">VADER</option>
                <option value="textblob">TextBlob</option>
                <option value="transformer">Transformer (BERT)</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Output Columns</label>
              <input
                type="text"
                value={Array.isArray(selectedStep.config.output_columns) ? selectedStep.config.output_columns.join(', ') : 'sentiment, confidence'}
                oninput={(e: Event) => {
                  const value = (e.target as HTMLInputElement).value;
                  const columns = value.split(',').map(c => c.trim()).filter(Boolean);
                  updateStepConfig({ output_columns: columns });
                }}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

        {:else if selectedStep.type === 'topic_modeling'}
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Text Column</label>
              <input
                type="text"
                bind:value={selectedStep.config.text_column}
                oninput={(e: Event) => updateStepConfig({ text_column: (e.target as HTMLInputElement).value })}
                placeholder="text column name"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Number of Topics</label>
              <input
                type="number"
                bind:value={selectedStep.config.num_topics}
                oninput={(e: Event) => updateStepConfig({ num_topics: parseInt((e.target as HTMLInputElement).value) })}
                min="2"
                max="100"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Method</label>
              <select
                bind:value={selectedStep.config.method}
                onchange={(e: Event) => updateStepConfig({ method: (e.target as HTMLSelectElement).value })}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="lda">LDA (Latent Dirichlet Allocation)</option>
                <option value="nmf">NMF (Non-negative Matrix Factorization)</option>
                <option value="lsi">LSI (Latent Semantic Indexing)</option>
              </select>
            </div>
          </div>

        {:else}
          <div class="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
            <p class="font-medium text-gray-700 mb-1">Configuration Available</p>
            <p>Configuration options for {selectedStep.name} will be displayed here.</p>
          </div>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="pt-4 mt-4 border-t border-gray-200 space-y-2">
        <button
          onclick={closePanel}
          class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
          Save Configuration
        </button>
        <button
          onclick={() => workflowBuilder.deselectStep()}
          class="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors">
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
