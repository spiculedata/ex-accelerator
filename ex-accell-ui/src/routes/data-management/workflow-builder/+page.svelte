<script lang="ts">
  /**
   * Workflow Builder Page - Refactored
   *
   * Visual workflow builder for creating custom data processing pipelines.
   * Refactored to use modular components for better maintainability.
   */

  import WorkflowCanvas from '$lib/components/workflow-builder/WorkflowCanvas.svelte';
  import StepLibrary from '$lib/components/workflow-builder/StepLibrary.svelte';
  import StepConfigPanel from '$lib/components/workflow-builder/StepConfigPanel.svelte';
  import CodeExportModal from '$lib/components/workflow-builder/CodeExportModal.svelte';
  import PublishWorkflowModal from '$lib/components/workflow-builder/PublishWorkflowModal.svelte';
  import ExecuteWorkflowModal from '$lib/components/workflow-builder/ExecuteWorkflowModal.svelte';

  import { goto } from '$app/navigation';
  import { workflowBuilder, type Dataset } from '$lib/stores/workflowBuilderStore';
  import { currentProject, loadCurrentProject } from '$lib/stores/projectStore';
  import { onMount, onDestroy } from 'svelte';

  // ===================================================================
  // Type Definitions
  // ===================================================================

  interface PythonDaprWorkflow {
    pythonScript: string;
    requirements: string;
    workflowCode: string;
    activityCode: string;
    appCode: string;
    workflowPattern: string;
    executionOrder: string[];
    workflowName: string;
  }

  // ===================================================================
  // State Management
  // ===================================================================

  // Lifecycle tracking to prevent race conditions
  let mounted = $state(false);

  let availableDatasets: Dataset[] = $state([]);
  let loadingDatasets = $state(false);

  // Python workflow generation
  let pythonWorkflow: PythonDaprWorkflow | null = $state(null);

  // Publish workflow state
  let loadingPublish = $state(false);
  let publishMetadata = $state({
    name: '',
    description: '',
    version: '1.0.0',
    createdBy: '',
    tags: ''
  });

  // Execute workflow state
  let loadingExecute = $state(false);
  let executionInput = $state('{\n  "dataset_id": "example_dataset",\n  "parameters": {}\n}');
  let executionOptions = $state({
    priority: 'medium',
    triggeredBy: 'manual'
  });

  // Canvas reference for components
  let canvasElement: HTMLDivElement | null = $state(null);

  // Subscribe to workflow state
  let workflow = $derived($workflowBuilder.workflow);
  let showCodeExport = $derived($workflowBuilder.showCodeExport);
  let showPublishDialog = $derived($workflowBuilder.showPublishDialog);
  let showExecuteDialog = $derived($workflowBuilder.showExecuteDialog);

  // ===================================================================
  // Lifecycle
  // ===================================================================

  onMount(async () => {
    mounted = true;

    // Load current project from localStorage first
    const projectLoaded = await loadCurrentProject();

    if (!mounted) return;

    // Redirect to projects if no current project after loading
    if (!projectLoaded || !$currentProject) {
      goto('/projects');
      return;
    }

    // Load available datasets
    await loadAvailableDatasets();
  });

  onDestroy(() => {
    mounted = false;
  });

  // ===================================================================
  // Dataset Management
  // ===================================================================

  async function loadAvailableDatasets() {
    if (!mounted) return;

    try {
      loadingDatasets = true;
      const response = await fetch('/api/unified-analytics?type=workflow-datasets');
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) throw new Error(body.error || `Request failed (${response.status})`);

      if (mounted) {
        availableDatasets = body.data;
      }
    } catch (error) {
      if (mounted) {
        console.error('Error loading datasets:', error);
        availableDatasets = [];
      }
    } finally {
      if (mounted) {
        loadingDatasets = false;
      }
    }
  }

  // ===================================================================
  // Workflow Actions
  // ===================================================================

  function saveWorkflow() {
    console.log('Saving workflow:', workflow);
    alert('Workflow saved successfully!');
  }

  function runWorkflow() {
    if (workflow.steps.length === 0) {
      alert('Please add steps to your workflow before running');
      return;
    }
    workflowBuilder.toggleExecuteDialog(true);
  }

  async function publishWorkflow() {
    if (workflow.steps.length === 0) {
      alert('Please add steps to your workflow before publishing');
      return;
    }

    // Pre-fill metadata
    publishMetadata.name = workflow.name || 'Untitled Workflow';
    publishMetadata.description = workflow.description || '';

    workflowBuilder.togglePublishDialog(true);
  }

  async function confirmPublishWorkflow() {
    try {
      loadingPublish = true;

      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowDefinition: workflow,
          metadata: {
            ...publishMetadata,
            tags: publishMetadata.tags.split(',').map(t => t.trim()).filter(Boolean)
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to publish workflow');
      }

      const result = await response.json();

      if (result.success) {
        alert(`Workflow "${publishMetadata.name}" published successfully!`);
        workflowBuilder.togglePublishDialog(false);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error publishing workflow:', error);
      alert('Error publishing workflow: ' + (error as Error).message);
    } finally {
      loadingPublish = false;
    }
  }

  async function executeWorkflow() {
    try {
      loadingExecute = true;

      // First publish the current workflow
      const tempMetadata = {
        name: workflow.name || `Temp Workflow ${Date.now()}`,
        description: workflow.description || 'Temporary workflow for execution',
        version: '1.0.0',
        tags: [],
        createdBy: 'current-user'
      };

      const publishResponse = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowDefinition: workflow,
          metadata: tempMetadata
        })
      });

      if (!publishResponse.ok) {
        throw new Error('Failed to publish workflow for execution');
      }

      const publishResult = await publishResponse.json();
      if (!publishResult.success) {
        throw new Error(publishResult.error || 'Failed to publish workflow');
      }

      const workflowId = publishResult.workflow.id;

      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: executionInput,
          options: executionOptions
        })
      });

      if (!response.ok) {
        throw new Error('Failed to execute workflow');
      }

      const result = await response.json();

      if (result.success) {
        workflowBuilder.toggleExecuteDialog(false);
        alert('Workflow execution started successfully!');
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error executing workflow:', error);
      alert('Error executing workflow: ' + (error as Error).message);
    } finally {
      loadingExecute = false;
    }
  }

  // ===================================================================
  // Code Generation
  // ===================================================================

  async function generateDaprCode() {
    if (workflow.steps.length === 0) {
      alert('Please add steps to your workflow before generating code');
      return;
    }

    try {
      const response = await fetch('/api/generate-python-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow: workflow,
          options: {
            language: 'python',
            framework: 'dapr',
            includeVirtualEnv: true
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate Python workflow: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        pythonWorkflow = result.pythonWorkflow;
        workflowBuilder.toggleCodeExport(true);
        console.log('Generated Python-based Dapr workflow:', pythonWorkflow);
      } else {
        throw new Error(result.error || 'Unknown error generating Python workflow');
      }
    } catch (error) {
      console.error('Error generating Python workflow code:', error);
      alert('Error generating Python workflow code: ' + (error as Error).message);
    }
  }

  function downloadCode() {
    if (!pythonWorkflow) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const workflowName = workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    // Download each file separately
    const files = [
      {
        name: `${workflowName}_workflow.py`,
        content: pythonWorkflow.pythonScript
      },
      {
        name: 'requirements.txt',
        content: pythonWorkflow.requirements
      },
      {
        name: `${workflowName}_dapr_workflow.ts`,
        content: pythonWorkflow.workflowCode
      },
      {
        name: `${workflowName}_dapr_activities.ts`,
        content: pythonWorkflow.activityCode
      },
      {
        name: `${workflowName}_dapr_app.ts`,
        content: pythonWorkflow.appCode
      }
    ];

    files.forEach(file => {
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Success feedback handled by modal
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard');
    });
  }
</script>

<svelte:head>
  <title>Workflow Builder - Data Processing - Social Explorer</title>
  <meta name="description" content="Visual workflow builder for creating custom data processing pipelines" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <button
            onclick={() => goto('/data-management')}
            class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
            aria-label="Back to data management">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Workflow Builder</h1>
            <p class="text-gray-600">Drag and drop components to create your data processing pipeline</p>
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <button
            onclick={saveWorkflow}
            class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl text-sm font-medium transition-colors">
            Save Workflow
          </button>
          <button
            onclick={generateDaprCode}
            disabled={workflow.steps.length === 0}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
            </svg>
            <span>Generate Code</span>
          </button>
          <button
            onclick={publishWorkflow}
            disabled={workflow.steps.length === 0}
            class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <span>Publish</span>
          </button>
          <button
            onclick={runWorkflow}
            disabled={workflow.steps.length === 0}
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-7-9h6M12 5V3"></path>
            </svg>
            <span>Run</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="flex h-screen">
    <!-- Step Library Sidebar -->
    <StepLibrary />

    <!-- Workflow Canvas -->
    <div class="flex-1 flex flex-col">
      <!-- Canvas Header -->
      <div class="bg-white border-b border-gray-200 p-4">
        <div class="flex items-center justify-between">
          <div>
            <input
              bind:value={workflow.name}
              onchange={(e: Event) => workflowBuilder.setWorkflowInfo((e.target as HTMLInputElement).value, workflow.description)}
              class="text-lg font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2"
              placeholder="Workflow name">
            <input
              bind:value={workflow.description}
              onchange={(e: Event) => workflowBuilder.setWorkflowInfo(workflow.name, (e.target as HTMLInputElement).value)}
              class="block text-sm text-gray-600 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 mt-1"
              placeholder="Workflow description">
          </div>
          <div class="text-sm text-gray-500">
            {workflow.steps.length} steps • {workflow.connections.length} connections
          </div>
        </div>
      </div>

      <!-- Canvas Area -->
      <WorkflowCanvas bind:canvasElement={canvasElement} />
    </div>

    <!-- Configuration Panel -->
    <StepConfigPanel
      {availableDatasets}
      {loadingDatasets}
      onRefreshDatasets={loadAvailableDatasets}
    />
  </div>
</div>

<!-- Code Export Modal -->
<CodeExportModal
  show={showCodeExport}
  {pythonWorkflow}
  onClose={() => workflowBuilder.toggleCodeExport(false)}
  onDownload={downloadCode}
  onCopyToClipboard={copyToClipboard}
/>

<!-- Publish Workflow Modal -->
<PublishWorkflowModal
  show={showPublishDialog}
  loading={loadingPublish}
  bind:metadata={publishMetadata}
  onClose={() => workflowBuilder.togglePublishDialog(false)}
  onPublish={confirmPublishWorkflow}
/>

<!-- Execute Workflow Modal -->
<ExecuteWorkflowModal
  show={showExecuteDialog}
  loading={loadingExecute}
  bind:executionInput={executionInput}
  bind:executionOptions={executionOptions}
  onClose={() => workflowBuilder.toggleExecuteDialog(false)}
  onExecute={executeWorkflow}
/>
