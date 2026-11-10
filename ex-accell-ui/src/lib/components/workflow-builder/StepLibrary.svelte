<script lang="ts">
  /**
   * Step Library Sidebar Component
   *
   * Displays categorized workflow steps that users can drag onto the canvas.
   * Provides search functionality and visual feedback during drag operations.
   */

  import { get } from 'svelte/store';
  import { workflowBuilder, workflowSteps } from '$lib/stores/workflowBuilderStore';
  import { nextFreePosition } from '$lib/utils/workflowSteps';
  import { stepLibrary, getStepColorClasses, searchSteps, type StepTemplate } from './stepLibraryData';

  // Search state
  let searchQuery = $state('');
  let filteredSteps = $derived(
    searchQuery.trim() === ''
      ? stepLibrary
      : [{ category: 'Search Results', steps: searchSteps(searchQuery) }]
  );

  // Drag handlers
  function handleDragStart(event: DragEvent, step: StepTemplate) {
    if (!event.dataTransfer) return;

    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', JSON.stringify(step));

    workflowBuilder.startDraggingLibraryStep(step);
  }

  function handleDragEnd() {
    workflowBuilder.clearDraggedLibraryStep();
  }

  // Helper to get color classes for step visual
  function getStepBgClass(color: string): string {
    const classes = getStepColorClasses(color);
    return `${classes.bg} ${classes.border} ${classes.text}`;
  }

  // Clicking, or pressing Enter or Space on, a component adds it to the canvas, so the library works
  // without a mouse drag. The announcement tells screen reader users what happened.
  let announcement = '';
  function addToCanvas(step: StepTemplate) {
    const { x, y } = nextFreePosition(get(workflowSteps).map((step) => step.position));
    workflowBuilder.addStep(step, x, y);
    announcement = `Added ${step.name} to the workflow`;
  }

  function handleKeyDown(event: KeyboardEvent, step: StepTemplate) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      addToCanvas(step);
    }
  }
</script>

<span class="sr-only" role="status" aria-live="polite">{announcement}</span>

<!-- Component Library Sidebar -->
<div class="w-80 bg-white border-r border-gray-200 overflow-y-auto">
  <div class="p-4">
    <!-- Header -->
    <div class="mb-4">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Component Library</h2>

      <!-- Search Input -->
      <div class="relative">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search components..."
          class="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          aria-label="Search workflow components"
        />
        <svg
          class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
    </div>

    <!-- Step Categories -->
    {#if filteredSteps.length === 0}
      <div class="text-center py-8">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p class="text-sm text-gray-500">No components found</p>
        <p class="text-xs text-gray-500 mt-1">Try a different search term</p>
      </div>
    {:else}
      {#each filteredSteps as category}
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <span class="flex-1">{category.category}</span>
            <span class="text-xs font-normal text-gray-500">
              {category.steps.length} {category.steps.length === 1 ? 'component' : 'components'}
            </span>
          </h3>

          <div class="space-y-2">
            {#each category.steps as step (step.id)}
              <div
                class="p-3 border border-gray-200 rounded-xl cursor-move hover:shadow-md transition-all {getStepBgClass(step.color)}"
                draggable="true"
                ondragstart={(e) => handleDragStart(e, step)}
                ondragend={handleDragEnd}
                onclick={() => addToCanvas(step)}
                onkeydown={(e) => handleKeyDown(e, step)}
                role="button"
                tabindex="0"
                aria-label="Add {step.name} to the workflow, or drag it onto the canvas">

                <div class="flex items-center space-x-3">
                  <span class="text-lg" aria-hidden="true">{step.icon}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">{step.name}</p>
                    <p class="text-xs text-gray-600 truncate">{step.description}</p>
                  </div>
                </div>

                <!-- Input/Output Indicators -->
                <div class="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <div class="flex items-center space-x-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                    </svg>
                    <span>{step.inputs.length} in</span>
                  </div>
                  <div class="flex items-center space-x-1">
                    <span>{step.outputs.length} out</span>
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}

    <!-- Usage Instructions -->
    {#if searchQuery === ''}
      <div class="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div class="flex items-start space-x-2">
          <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="text-xs text-blue-800">
            <p class="font-medium mb-1">How to use:</p>
            <ul class="space-y-1 list-disc list-inside">
              <li>Drag components to canvas</li>
              <li>Click output ports to connect</li>
              <li>Select steps to configure</li>
            </ul>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
