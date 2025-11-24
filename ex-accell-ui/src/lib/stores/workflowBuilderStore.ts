/**
 * Workflow Builder Store
 *
 * Centralized state management for the workflow builder.
 * Manages workflow steps, connections, selection, and drag/drop state.
 */

import { writable, derived, type Readable } from 'svelte/store';

// ===================================================================
// Type Definitions
// ===================================================================

export interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  inputs: string[];
  outputs: string[];
  config: Record<string, any>;
  position: { x: number; y: number };
  status: 'configured' | 'running' | 'completed' | 'error';
}

export interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
}

export interface Workflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
  connections: WorkflowConnection[];
}

export interface WorkflowBuilderState {
  workflow: Workflow;
  selectedStep: WorkflowStep | null;
  selectedStepId: string | null;

  // Drag and drop
  draggedStep: any | null;
  isDraggingStep: boolean;
  draggedStepId: string | null;
  dragOffset: { x: number; y: number };

  // Connection drawing
  isConnecting: boolean;
  connectionStart: string | null;
  tempConnection: { from: string; toX: number; toY: number } | null;
  mousePosition: { x: number; y: number };

  // UI state
  showStepConfig: boolean;
  showCodeExport: boolean;
  showPublishDialog: boolean;
  showExecuteDialog: boolean;
  showExecutionMonitor: boolean;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  table: string;
  type: string;
}

// ===================================================================
// Store Creation
// ===================================================================

function createWorkflowBuilderStore() {
  const initialState: WorkflowBuilderState = {
    workflow: {
      name: 'New Workflow',
      description: '',
      steps: [],
      connections: []
    },
    selectedStep: null,
    selectedStepId: null,
    draggedStep: null,
    isDraggingStep: false,
    draggedStepId: null,
    dragOffset: { x: 0, y: 0 },
    isConnecting: false,
    connectionStart: null,
    tempConnection: null,
    mousePosition: { x: 0, y: 0 },
    showStepConfig: false,
    showCodeExport: false,
    showPublishDialog: false,
    showExecuteDialog: false,
    showExecutionMonitor: false
  };

  const { subscribe, set, update } = writable<WorkflowBuilderState>(initialState);

  return {
    subscribe,

    // ===============================================================
    // Workflow Management
    // ===============================================================

    /**
     * Set workflow name and description
     */
    setWorkflowInfo(name: string, description: string) {
      update(state => ({
        ...state,
        workflow: { ...state.workflow, name, description }
      }));
    },

    /**
     * Reset workflow to initial state
     */
    resetWorkflow() {
      update(state => ({
        ...state,
        workflow: {
          name: 'New Workflow',
          description: '',
          steps: [],
          connections: []
        },
        selectedStep: null,
        selectedStepId: null,
        showStepConfig: false
      }));
    },

    /**
     * Load existing workflow
     */
    loadWorkflow(workflow: Workflow) {
      update(state => ({
        ...state,
        workflow,
        selectedStep: null,
        selectedStepId: null,
        showStepConfig: false
      }));
    },

    // ===============================================================
    // Step Management
    // ===============================================================

    /**
     * Add step to workflow at position
     */
    addStep(stepTemplate: any, x: number, y: number) {
      const newStep: WorkflowStep = {
        id: `step_${Date.now()}`,
        type: stepTemplate.id,
        name: stepTemplate.name,
        description: stepTemplate.description,
        icon: stepTemplate.icon,
        color: stepTemplate.color,
        inputs: stepTemplate.inputs,
        outputs: stepTemplate.outputs,
        config: { ...stepTemplate.config },
        position: { x: Math.max(0, x - 75), y: Math.max(0, y - 40) },
        status: 'configured'
      };

      update(state => ({
        ...state,
        workflow: {
          ...state.workflow,
          steps: [...state.workflow.steps, newStep]
        }
      }));

      return newStep.id;
    },

    /**
     * Select a step
     */
    selectStep(stepId: string) {
      update(state => {
        const step = state.workflow.steps.find(s => s.id === stepId);
        return {
          ...state,
          selectedStep: step || null,
          selectedStepId: stepId,
          showStepConfig: true
        };
      });
    },

    /**
     * Deselect current step
     */
    deselectStep() {
      update(state => ({
        ...state,
        selectedStep: null,
        selectedStepId: null,
        showStepConfig: false
      }));
    },

    /**
     * Delete step from workflow
     */
    deleteStep(stepId: string) {
      update(state => ({
        ...state,
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.filter(s => s.id !== stepId),
          connections: state.workflow.connections.filter(
            c => c.from !== stepId && c.to !== stepId
          )
        },
        selectedStep: state.selectedStepId === stepId ? null : state.selectedStep,
        selectedStepId: state.selectedStepId === stepId ? null : state.selectedStepId,
        showStepConfig: state.selectedStepId === stepId ? false : state.showStepConfig
      }));
    },

    /**
     * Update step configuration
     */
    updateStepConfig(stepId: string, config: Record<string, any>) {
      update(state => ({
        ...state,
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.map(step =>
            step.id === stepId
              ? { ...step, config: { ...step.config, ...config } }
              : step
          )
        },
        selectedStep: state.selectedStepId === stepId
          ? { ...state.selectedStep!, config: { ...state.selectedStep!.config, ...config } }
          : state.selectedStep
      }));
    },

    /**
     * Update step position
     */
    updateStepPosition(stepId: string, x: number, y: number) {
      update(state => ({
        ...state,
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.map(step =>
            step.id === stepId
              ? { ...step, position: { x, y } }
              : step
          )
        }
      }));
    },

    // ===============================================================
    // Connection Management
    // ===============================================================

    /**
     * Start creating a connection
     */
    startConnection(fromStepId: string) {
      update(state => ({
        ...state,
        isConnecting: true,
        connectionStart: fromStepId,
        tempConnection: null
      }));
    },

    /**
     * Update temporary connection position (mouse following)
     */
    updateTempConnection(toX: number, toY: number) {
      update(state => {
        if (!state.isConnecting || !state.connectionStart) return state;

        return {
          ...state,
          tempConnection: {
            from: state.connectionStart,
            toX,
            toY
          }
        };
      });
    },

    /**
     * Complete connection to target step
     */
    completeConnection(toStepId: string) {
      update(state => {
        if (!state.isConnecting || !state.connectionStart) return state;

        // Prevent self-connection
        if (state.connectionStart === toStepId) {
          return {
            ...state,
            isConnecting: false,
            connectionStart: null,
            tempConnection: null
          };
        }

        // Check if connection already exists
        const exists = state.workflow.connections.some(
          c => c.from === state.connectionStart && c.to === toStepId
        );

        if (exists) {
          return {
            ...state,
            isConnecting: false,
            connectionStart: null,
            tempConnection: null
          };
        }

        // Create new connection
        const newConnection: WorkflowConnection = {
          id: `conn_${Date.now()}`,
          from: state.connectionStart,
          to: toStepId
        };

        return {
          ...state,
          workflow: {
            ...state.workflow,
            connections: [...state.workflow.connections, newConnection]
          },
          isConnecting: false,
          connectionStart: null,
          tempConnection: null
        };
      });
    },

    /**
     * Cancel connection creation
     */
    cancelConnection() {
      update(state => ({
        ...state,
        isConnecting: false,
        connectionStart: null,
        tempConnection: null
      }));
    },

    /**
     * Delete a connection
     */
    deleteConnection(connectionId: string) {
      update(state => ({
        ...state,
        workflow: {
          ...state.workflow,
          connections: state.workflow.connections.filter(c => c.id !== connectionId)
        }
      }));
    },

    // ===============================================================
    // Drag and Drop Management
    // ===============================================================

    /**
     * Start dragging a step from library
     */
    startDraggingLibraryStep(step: any) {
      update(state => ({
        ...state,
        draggedStep: step
      }));
    },

    /**
     * Clear dragged library step
     */
    clearDraggedLibraryStep() {
      update(state => ({
        ...state,
        draggedStep: null
      }));
    },

    /**
     * Start dragging a canvas step
     */
    startDraggingCanvasStep(stepId: string, offsetX: number, offsetY: number) {
      update(state => ({
        ...state,
        isDraggingStep: true,
        draggedStepId: stepId,
        dragOffset: { x: offsetX, y: offsetY }
      }));
    },

    /**
     * Stop dragging canvas step
     */
    stopDraggingCanvasStep() {
      update(state => ({
        ...state,
        isDraggingStep: false,
        draggedStepId: null,
        dragOffset: { x: 0, y: 0 }
      }));
    },

    /**
     * Update mouse position (for connection drawing)
     */
    updateMousePosition(x: number, y: number) {
      update(state => ({
        ...state,
        mousePosition: { x, y }
      }));
    },

    // ===============================================================
    // UI State Management
    // ===============================================================

    /**
     * Toggle step configuration panel
     */
    toggleStepConfig(show?: boolean) {
      update(state => ({
        ...state,
        showStepConfig: show !== undefined ? show : !state.showStepConfig
      }));
    },

    /**
     * Toggle code export modal
     */
    toggleCodeExport(show?: boolean) {
      update(state => ({
        ...state,
        showCodeExport: show !== undefined ? show : !state.showCodeExport
      }));
    },

    /**
     * Toggle publish dialog
     */
    togglePublishDialog(show?: boolean) {
      update(state => ({
        ...state,
        showPublishDialog: show !== undefined ? show : !state.showPublishDialog
      }));
    },

    /**
     * Toggle execute dialog
     */
    toggleExecuteDialog(show?: boolean) {
      update(state => ({
        ...state,
        showExecuteDialog: show !== undefined ? show : !state.showExecuteDialog
      }));
    },

    /**
     * Toggle execution monitor
     */
    toggleExecutionMonitor(show?: boolean) {
      update(state => ({
        ...state,
        showExecutionMonitor: show !== undefined ? show : !state.showExecutionMonitor
      }));
    }
  };
}

// ===================================================================
// Exported Stores
// ===================================================================

export const workflowBuilder = createWorkflowBuilderStore();

// Derived stores for convenient access
export const workflow: Readable<Workflow> = derived(
  workflowBuilder,
  $wb => $wb.workflow
);

export const workflowSteps: Readable<WorkflowStep[]> = derived(
  workflow,
  $wf => $wf.steps
);

export const workflowConnections: Readable<WorkflowConnection[]> = derived(
  workflow,
  $wf => $wf.connections
);

export const selectedStep: Readable<WorkflowStep | null> = derived(
  workflowBuilder,
  $wb => $wb.selectedStep
);

export const isConnecting: Readable<boolean> = derived(
  workflowBuilder,
  $wb => $wb.isConnecting
);

export const hasSteps: Readable<boolean> = derived(
  workflowSteps,
  $steps => $steps.length > 0
);
