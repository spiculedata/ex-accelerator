<script lang="ts">
  /**
   * Workflow Canvas Component
   *
   * Visual canvas for building workflows with drag-and-drop steps and connection drawing.
   * Handles step positioning, connection management, and canvas interactions.
   */

  import { workflowBuilder, type WorkflowStep, type WorkflowConnection } from '$lib/stores/workflowBuilderStore';
  import { stepColorClasses, getStepColorClasses } from './stepLibraryData';
  import { getStatusColor } from '$lib/utils/colorUtils';

  // Props
  let { canvasElement = $bindable(null) }: { canvasElement?: HTMLDivElement | null } = $props();

  // Subscribe to workflow state
  let workflow = $derived($workflowBuilder.workflow);
  let isConnecting = $derived($workflowBuilder.isConnecting);
  let connectionStart = $derived($workflowBuilder.connectionStart);
  let mousePosition = $derived($workflowBuilder.mousePosition);
  let isDraggingStep = $derived($workflowBuilder.isDraggingStep);

  // Canvas interaction handlers
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();

    const draggedStep = $workflowBuilder.draggedStep;
    if (!draggedStep || !canvasElement) return;

    const rect = canvasElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    workflowBuilder.addStep(draggedStep, x, y);
    workflowBuilder.clearDraggedLibraryStep();
  }

  function handleCanvasClick(event: MouseEvent) {
    // Cancel connection if clicking on empty canvas
    if (isConnecting && event.target === canvasElement) {
      workflowBuilder.cancelConnection();
    }
  }

  // Step selection and deletion
  function selectStep(step: WorkflowStep) {
    workflowBuilder.selectStep(step.id);
  }

  function deleteStep(stepId: string) {
    workflowBuilder.deleteStep(stepId);
  }

  // Step dragging functionality
  function startStepDrag(event: MouseEvent, step: WorkflowStep) {
    // Don't start drag if we're clicking on a port or already connecting
    if (isConnecting || (event.target as HTMLElement).closest('.port')) return;

    if (!canvasElement) return;

    const rect = canvasElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - step.position.x;
    const offsetY = event.clientY - rect.top - step.position.y;

    workflowBuilder.startDraggingCanvasStep(step.id, offsetX, offsetY);

    const handleMouseMove = (e: MouseEvent) => {
      if (!$workflowBuilder.isDraggingStep || !$workflowBuilder.draggedStepId || !canvasElement) return;

      const rect = canvasElement.getBoundingClientRect();
      const dragOffset = $workflowBuilder.dragOffset;
      const newX = Math.max(0, e.clientX - rect.left - dragOffset.x);
      const newY = Math.max(0, e.clientY - rect.top - dragOffset.y);

      workflowBuilder.updateStepPosition($workflowBuilder.draggedStepId, newX, newY);
    };

    const handleMouseUp = () => {
      workflowBuilder.stopDraggingCanvasStep();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  // Port connection handling
  function handlePortClick(event: MouseEvent, step: WorkflowStep, portType: 'input' | 'output', portIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!isConnecting) {
      // Start a new connection - only from output ports
      if (portType === 'output') {
        workflowBuilder.startConnection(step.id);

        // Track mouse movement for temporary connection line
        const handleMouseMove = (e: MouseEvent) => {
          if (!canvasElement) return;
          const rect = canvasElement.getBoundingClientRect();
          workflowBuilder.updateMousePosition(e.clientX - rect.left, e.clientY - rect.top);
        };

        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    } else {
      // Complete an existing connection - only to input ports
      if (connectionStart && portType === 'input') {
        workflowBuilder.completeConnection(step.id);
      }
    }
  }

  // Connection visualization helpers
  function getPortPosition(stepId: string, portType: 'input' | 'output', portIndex: number = 0) {
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) return { x: 0, y: 0 };

    const stepWidth = 150;
    const portStartY = 95; // Position where ports start in the component
    const portSpacing = 20; // Space between ports

    const baseX = step.position.x;
    const baseY = step.position.y + portStartY + (portIndex * portSpacing);

    if (portType === 'input') {
      return {
        x: baseX - 6, // Position port at left edge
        y: baseY
      };
    } else {
      return {
        x: baseX + stepWidth, // Position port at right edge
        y: baseY
      };
    }
  }

  function deleteConnection(connectionId: string) {
    workflowBuilder.deleteConnection(connectionId);
  }

</script>

<!-- Canvas Area -->
<div
  bind:this={canvasElement}
  class="flex-1 relative bg-gray-50 overflow-auto"
  role="region"
  aria-label="Workflow canvas"
  ondragover={handleDragOver}
  ondrop={handleDrop}
  onclick={handleCanvasClick}>

  <!-- Grid Background -->
  <div
    class="absolute inset-0 opacity-40"
    style="background-image: radial-gradient(circle, #d1d5db 1px, transparent 1px); background-size: 20px 20px;"
    aria-hidden="true">
  </div>

  <!-- Connection Lines -->
  <svg class="absolute inset-0 w-full h-full pointer-events-none" style="z-index: 1;">
    <!-- Existing connections -->
    {#each workflow.connections as connection (connection.id)}
      {#if workflow.steps.find(s => s.id === connection.from) && workflow.steps.find(s => s.id === connection.to)}
        {@const fromPos = getPortPosition(connection.from, 'output', 0)}
        {@const toPos = getPortPosition(connection.to, 'input', 0)}
        {@const midX = fromPos.x + (toPos.x - fromPos.x) / 2}
        <g>
          <path
            d="M {fromPos.x + 6} {fromPos.y + 6} C {midX} {fromPos.y + 6} {midX} {toPos.y + 6} {toPos.x + 6} {toPos.y + 6}"
            stroke="#06d6a0"
            stroke-width="2"
            fill="none"
            class="connection-line"
          />
          <!-- Delete connection button -->
          <circle
            cx={midX}
            cy={(fromPos.y + toPos.y) / 2 + 6}
            r="8"
            fill="white"
            stroke="#ef4444"
            stroke-width="2"
            class="cursor-pointer pointer-events-auto"
            onclick={() => deleteConnection(connection.id)}
          />
          <text
            x={midX}
            y={(fromPos.y + toPos.y) / 2 + 10}
            text-anchor="middle"
            class="text-xs fill-red-500 pointer-events-auto cursor-pointer"
            onclick={() => deleteConnection(connection.id)}
          >×</text>
        </g>
      {/if}
    {/each}

    <!-- Temporary connection line while dragging -->
    {#if isConnecting && connectionStart}
      {@const startPos = getPortPosition(connectionStart, 'output', 0)}
      {@const midX = startPos.x + (mousePosition.x - startPos.x) / 2}
      <path
        d="M {startPos.x + 6} {startPos.y + 6} C {midX} {startPos.y + 6} {midX} {mousePosition.y} {mousePosition.x} {mousePosition.y}"
        stroke="#26d0ce"
        stroke-width="2"
        stroke-dasharray="5,5"
        fill="none"
        opacity="0.7"
      />
    {/if}
  </svg>

  <!-- Workflow Steps -->
  {#each workflow.steps as step (step.id)}
    <div
      class="absolute bg-white rounded-xl shadow-md border-2 border-gray-300 p-4 min-w-[150px] cursor-move hover:shadow-lg transition-shadow"
      style="left: {step.position.x}px; top: {step.position.y}px; z-index: 10;"
      onmousedown={(e) => startStepDrag(e, step)}
      onclick={() => selectStep(step)}
      role="button"
      tabindex="0"
      aria-label="Workflow step: {step.name}">

      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center space-x-2">
          <span class="text-lg">{step.icon}</span>
          <span class="text-sm font-medium text-gray-900">{step.name}</span>
        </div>
        <button
          onclick={(e: MouseEvent) => {
            e.stopPropagation();
            deleteStep(step.id);
          }}
          class="text-gray-500 hover:text-red-600 transition-colors"
          aria-label="Delete step">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="text-xs text-gray-600 mb-3">{step.description}</div>

      <!-- Input/Output Ports -->
      <div class="flex justify-between">
        <div class="flex flex-col space-y-1">
          {#each step.inputs as input, index}
            <div
              class="port w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow cursor-pointer hover:bg-blue-600 transition-colors relative group"
              onclick={(e) => handlePortClick(e, step, 'input', index)}
              role="button"
              tabindex="0"
              aria-label="Input port: {input}">
              <!-- Tooltip -->
              <div class="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Input: {input}
              </div>
            </div>
          {/each}
        </div>
        <div class="flex flex-col space-y-1">
          {#each step.outputs as output, index}
            <div
              class="port w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow cursor-pointer hover:bg-blue-600 transition-colors relative group"
              onclick={(e) => handlePortClick(e, step, 'output', index)}
              role="button"
              tabindex="0"
              aria-label="Output port: {output}">
              <!-- Tooltip -->
              <div class="absolute right-4 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Output: {output}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Status Indicator -->
      <div class="mt-2 text-center">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getStatusColor(step.status)}">
          {step.status === 'needs-setup' ? 'needs setup' : step.status}
        </span>
      </div>
    </div>
  {/each}

  <!-- Help Text when canvas is empty -->
  {#if workflow.steps.length === 0}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center text-gray-500">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
        </svg>
        <h3 class="text-lg font-medium mb-2">Build Your Workflow</h3>
        <p class="text-sm">Drag components from the library to start building your data processing pipeline</p>
      </div>
    </div>
  {/if}
</div>
