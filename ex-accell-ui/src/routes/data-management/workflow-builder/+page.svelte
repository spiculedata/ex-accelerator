<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  import { unifiedDb } from '$lib/services/duckdb';
  import { daprWorkflowGenerator, type GeneratedWorkflow } from '$lib/services/daprWorkflowGenerator';
  // Remove client-side import - Python workflow generation now happens on server
  import type { PublishedWorkflow, WorkflowExecution } from '$lib/services/serverWorkflowService';
  
  // Type definition for Python workflow (matches server response)
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
  
  // Available datasets from unified database
  let availableDatasets = [];
  let loadingDatasets = false;

  // Redirect to projects if no current project
  onMount(async () => {
    if (!$currentProject) {
      window.location.href = '/projects';
      return;
    }
    
    // Load available datasets on component mount
    await loadAvailableDatasets();
  });

  async function loadAvailableDatasets() {
    try {
      loadingDatasets = true;
      await unifiedDb.connect();
      
      // Get available datasets from various sources
      const datasets = [];
      
      // Check for posts data (main social media data)
      try {
        const postsCount = await unifiedDb.query(`
          SELECT COUNT(*) as count 
          FROM posts 
          WHERE created_at >= '2024-01-01'
        `);
        if (postsCount[0]?.count > 0) {
          datasets.push({
            id: 'social_posts',
            name: 'Social Media Posts',
            description: `${postsCount[0].count.toLocaleString()} posts from social platforms`,
            table: 'posts',
            type: 'social_media'
          });
        }
      } catch (e) {}
      
      // Check for sentiment analysis data
      try {
        const sentimentCount = await unifiedDb.query(`
          SELECT COUNT(*) as count 
          FROM sentiment_classifications
        `);
        if (sentimentCount[0]?.count > 0) {
          datasets.push({
            id: 'sentiment_data',
            name: 'Sentiment Analysis Results',
            description: `${sentimentCount[0].count.toLocaleString()} sentiment classifications`,
            table: 'unified_post_analysis',
            type: 'analytics'
          });
        }
      } catch (e) {}
      
      // Check for topic modeling data
      try {
        const topicsCount = await unifiedDb.query(`
          SELECT COUNT(DISTINCT topic_id) as count 
          FROM topics
        `);
        if (topicsCount[0]?.count > 0) {
          datasets.push({
            id: 'topic_data',
            name: 'Topic Modeling Results',
            description: `${topicsCount[0].count} discovered topics`,
            table: 'unified_post_analysis',
            type: 'analytics'
          });
        }
      } catch (e) {}
      
      // Check for language detection data
      try {
        const languageCount = await unifiedDb.query(`
          SELECT COUNT(*) as count 
          FROM language_detection
        `);
        if (languageCount[0]?.count > 0) {
          datasets.push({
            id: 'language_data',
            name: 'Language Detection Results',
            description: `${languageCount[0].count.toLocaleString()} language classifications`,
            table: 'unified_post_analysis',
            type: 'analytics'
          });
        }
      } catch (e) {}
      
      // Check for engagement analysis data
      try {
        const engagementCount = await unifiedDb.query(`
          SELECT COUNT(*) as count 
          FROM post_engagement
        `);
        if (engagementCount[0]?.count > 0) {
          datasets.push({
            id: 'engagement_data',
            name: 'Engagement Analysis Data',
            description: `${engagementCount[0].count.toLocaleString()} engagement records`,
            table: 'unified_post_analysis',
            type: 'analytics'
          });
        }
      } catch (e) {}
      
      // Check for Android analytics data
      try {
        const androidCount = await unifiedDb.query(`
          SELECT COUNT(*) as count 
          FROM android_app_usage
        `);
        if (androidCount[0]?.count > 0) {
          datasets.push({
            id: 'android_data',
            name: 'Android Analytics Data',
            description: `${androidCount[0].count.toLocaleString()} app usage records`,
            table: 'android_app_usage',
            type: 'mobile_analytics'
          });
        }
      } catch (e) {}
      
      // Add unified cross-analysis dataset if we have multiple data types
      if (datasets.length > 1) {
        datasets.unshift({
          id: 'unified_analysis',
          name: 'Unified Cross-Platform Analysis',
          description: 'Combined data from all analytics modules for cross-table analysis',
          table: 'unified_post_analysis',
          type: 'unified'
        });
      }
      
      availableDatasets = datasets;
    } catch (error) {
      console.error('Failed to load available datasets:', error);
      // Fallback to sample datasets if database connection fails
      availableDatasets = [
        {
          id: 'sample_social',
          name: 'Sample Social Media Data',
          description: 'Sample dataset for testing workflows',
          table: 'posts',
          type: 'sample'
        }
      ];
    } finally {
      loadingDatasets = false;
    }
  }

  // Workflow step types and their configurations
  let stepLibrary = [
    {
      category: 'Data Input',
      steps: [
        {
          id: 'dataset_input',
          name: 'Dataset Input',
          description: 'Load dataset from available sources',
          icon: '📊',
          color: 'blue',
          inputs: [],
          outputs: ['dataset'],
          config: { dataset_id: '', columns: [] }
        }
      ]
    },
    {
      category: 'Data Cleaning',
      steps: [
        {
          id: 'remove_duplicates',
          name: 'Remove Duplicates',
          description: 'Remove duplicate records based on specified columns',
          icon: '🧹',
          color: 'green',
          inputs: ['dataset'],
          outputs: ['dataset'],
          config: { columns: [], keep: 'first' }
        },
        {
          id: 'handle_missing',
          name: 'Handle Missing Values',
          description: 'Fill, drop, or interpolate missing values',
          icon: '🔧',
          color: 'yellow',
          inputs: ['dataset'],
          outputs: ['dataset'],
          config: { strategy: 'drop', columns: [], fill_value: '' }
        },
        {
          id: 'filter_rows',
          name: 'Filter Rows',
          description: 'Filter rows based on conditions',
          icon: '🔍',
          color: 'purple',
          inputs: ['dataset'],
          outputs: ['dataset'],
          config: { conditions: [] }
        }
      ]
    },
    {
      category: 'Feature Engineering',
      steps: [
        {
          id: 'text_preprocessing',
          name: 'Text Preprocessing',
          description: 'Clean and normalize text data',
          icon: '📝',
          color: 'indigo',
          inputs: ['dataset'],
          outputs: ['dataset'],
          config: { 
            columns: [], 
            lowercase: true, 
            remove_punctuation: true, 
            remove_stopwords: true,
            stem: false,
            lemmatize: false
          }
        },
        {
          id: 'feature_extraction',
          name: 'Feature Extraction',
          description: 'Extract features from text or structured data',
          icon: '⚙️',
          color: 'orange',
          inputs: ['dataset'],
          outputs: ['dataset'],
          config: { 
            method: 'tfidf', 
            max_features: 1000, 
            ngram_range: [1, 1],
            columns: []
          }
        },
        {
          id: 'datetime_features',
          name: 'DateTime Features',
          description: 'Extract temporal features from datetime columns',
          icon: '🕒',
          color: 'pink',
          inputs: ['dataset'],
          outputs: ['dataset'],
          config: { 
            columns: [],
            features: ['hour', 'day_of_week', 'month', 'year']
          }
        }
      ]
    },
    {
      category: 'ML & Analytics',
      steps: [
        {
          id: 'sentiment_analysis',
          name: 'Sentiment Analysis',
          description: 'Analyze sentiment of text content',
          icon: '😊',
          color: 'emerald',
          inputs: ['dataset'],
          outputs: ['dataset'],
          config: { 
            text_column: '', 
            model: 'vader',
            output_columns: ['sentiment', 'confidence']
          }
        },
        {
          id: 'topic_modeling',
          name: 'Topic Modeling',
          description: 'Discover topics in text data using LDA',
          icon: '🏷️',
          color: 'cyan',
          inputs: ['dataset'],
          outputs: ['dataset'],
          config: { 
            text_column: '', 
            num_topics: 10, 
            method: 'lda',
            output_columns: ['topics', 'topic_weights']
          }
        },
        {
          id: 'clustering',
          name: 'Clustering',
          description: 'Group similar records using clustering algorithms',
          icon: '🎯',
          color: 'rose',
          inputs: ['dataset'],
          outputs: ['dataset'],
          config: { 
            features: [], 
            algorithm: 'kmeans', 
            n_clusters: 5,
            output_column: 'cluster'
          }
        }
      ]
    },
    {
      category: 'Data Output',
      steps: [
        {
          id: 'dataset_output',
          name: 'Dataset Output',
          description: 'Save processed dataset',
          icon: '💾',
          color: 'gray',
          inputs: ['dataset'],
          outputs: [],
          config: { 
            name: '', 
            format: 'csv', 
            description: ''
          }
        }
      ]
    }
  ];

  // Current workflow being built
  let workflow = {
    name: 'New Workflow',
    description: '',
    steps: [],
    connections: []
  };

  let selectedStep = null;
  let draggedStep = null;
  let workflowCanvas = null;
  let showStepConfig = false;
  
  // Code generation and export
  let showCodeExport = false;
  let generatedWorkflow: GeneratedWorkflow | null = null;
  let pythonWorkflow: PythonDaprWorkflow | null = null;
  let activeCodeTab = 'python';
  
  // Workflow publishing and execution
  let showPublishDialog = false;
  let showExecuteDialog = false;
  let showExecutionMonitor = false;
  let publishMetadata = {
    name: '',
    description: '',
    version: '1.0.0',
    tags: '',
    createdBy: 'current-user' // TODO: Get from auth
  };
  let executionInput = {};
  let executionOptions = {
    priority: 'medium',
    triggeredBy: 'manual'
  };
  let currentExecution: WorkflowExecution | null = null;
  let publishedWorkflows: PublishedWorkflow[] = [];
  let workflowExecutions: WorkflowExecution[] = [];
  let loadingPublish = false;
  let loadingExecute = false;
  
  // Placeholder text for execution input
  const executionInputPlaceholder = '{"dataset": "social_posts", "parameters": {}}';
  
  // Connection state
  let isConnecting = false;
  let connectionStart = null;
  let tempConnection = null;
  let mousePosition = { x: 0, y: 0 };
  
  // Step dragging state
  let isDraggingStep = false;
  let draggedStepId = null;
  let dragOffset = { x: 0, y: 0 };

  // Drag and drop functionality
  function handleDragStart(event, step) {
    draggedStep = step;
    event.dataTransfer.effectAllowed = 'copy';
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(event) {
    event.preventDefault();
    if (draggedStep) {
      const rect = workflowCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      addStepToWorkflow(draggedStep, x, y);
      draggedStep = null;
    }
  }

  function addStepToWorkflow(stepTemplate, x, y) {
    const newStep = {
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
    
    workflow.steps = [...workflow.steps, newStep];
  }

  function selectStep(step) {
    selectedStep = step;
    showStepConfig = true;
  }

  function deleteStep(stepId) {
    workflow.steps = workflow.steps.filter(s => s.id !== stepId);
    workflow.connections = workflow.connections.filter(
      c => c.from !== stepId && c.to !== stepId
    );
    if (selectedStep?.id === stepId) {
      selectedStep = null;
      showStepConfig = false;
    }
  }

  function updateStepConfig(stepId, config) {
    workflow.steps = workflow.steps.map(step => 
      step.id === stepId ? { ...step, config: { ...step.config, ...config } } : step
    );
  }

  function getStepColor(color) {
    const colors = {
      'blue': 'bg-blue-100 border-blue-300 text-blue-800',
      'green': 'bg-blue-100 border-blue-300 text-blue-800',
      'yellow': 'bg-yellow-100 border-yellow-300 text-yellow-800',
      'purple': 'bg-blue-100 border-blue-300 text-blue-800',
      'indigo': 'bg-indigo-100 border-indigo-300 text-indigo-800',
      'orange': 'bg-blue-100 border-blue-300 text-blue-800',
      'pink': 'bg-pink-100 border-pink-300 text-pink-800',
      'emerald': 'bg-emerald-100 border-emerald-300 text-emerald-800',
      'cyan': 'bg-cyan-100 border-cyan-300 text-cyan-800',
      'rose': 'bg-rose-100 border-rose-300 text-rose-800',
      'gray': 'bg-gray-100 border-gray-300 text-gray-800'
    };
    return colors[color] || colors.gray;
  }

  function saveWorkflow() {
    console.log('Saving workflow:', workflow);
    alert('Workflow saved successfully!');
  }

  function runWorkflow() {
    if (workflow.steps.length === 0) {
      alert('Please add steps to your workflow before running');
      return;
    }
    showExecuteDialog = true;
  }

  async function publishWorkflow() {
    if (workflow.steps.length === 0) {
      alert('Please add steps to your workflow before publishing');
      return;
    }
    
    // Pre-fill metadata
    publishMetadata.name = workflow.name || 'Untitled Workflow';
    publishMetadata.description = workflow.description || '';
    
    showPublishDialog = true;
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
        showPublishDialog = false;
        loadPublishedWorkflows();
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error publishing workflow:', error);
      alert('Error publishing workflow: ' + error.message);
    } finally {
      loadingPublish = false;
    }
  }

  async function executeWorkflow(workflowId?: string) {
    try {
      loadingExecute = true;
      
      // If no workflowId provided, we need to publish the current workflow first
      let id = workflowId;
      
      if (!id) {
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
        
        id = publishResult.workflow.id;
      }
      
      const response = await fetch(`/api/workflows/${id}/execute`, {
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
        currentExecution = result.execution;
        showExecuteDialog = false;
        showExecutionMonitor = true;
        
        // Start monitoring the execution
        monitorExecution(result.execution.id);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error executing workflow:', error);
      alert('Error executing workflow: ' + error.message);
    } finally {
      loadingExecute = false;
    }
  }

  async function loadPublishedWorkflows() {
    try {
      const response = await fetch('/api/workflows');
      if (response.ok) {
        const result = await response.json();
        publishedWorkflows = result.workflows || [];
      }
    } catch (error) {
      console.error('Error loading published workflows:', error);
    }
  }

  async function loadWorkflowExecutions() {
    try {
      const response = await fetch('/api/workflow-executions?limit=20');
      if (response.ok) {
        const result = await response.json();
        workflowExecutions = result.executions || [];
      }
    } catch (error) {
      console.error('Error loading workflow executions:', error);
    }
  }

  async function monitorExecution(executionId: string) {
    if (!executionId) return;
    
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/workflow-executions/${executionId}`);
        if (response.ok) {
          const result = await response.json();
          currentExecution = result.execution;
          
          // Continue monitoring if still running
          if (currentExecution && (currentExecution.status === 'running' || currentExecution.status === 'queued')) {
            setTimeout(checkStatus, 2000); // Check every 2 seconds
          }
        }
      } catch (error) {
        console.error('Error monitoring execution:', error);
      }
    };
    
    checkStatus();
  }

  async function cancelExecution() {
    if (!currentExecution) return;
    
    try {
      const response = await fetch(`/api/workflow-executions/${currentExecution.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        currentExecution.status = 'cancelled';
        alert('Workflow execution cancelled');
      }
    } catch (error) {
      console.error('Error cancelling execution:', error);
      alert('Error cancelling execution: ' + error.message);
    }
  }

  async function generateDaprCode() {
    try {
      // Generate Python-based Dapr workflow via server API
      const response = await fetch('/api/generate-python-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowDefinition: workflow
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate Python workflow: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        pythonWorkflow = result.pythonWorkflow;
        showCodeExport = true;
        console.log('Generated Python-based Dapr workflow:', pythonWorkflow);
      } else {
        throw new Error(result.error || 'Unknown error generating Python workflow');
      }
    } catch (error) {
      console.error('Error generating Python workflow code:', error);
      alert('Error generating Python workflow code: ' + error.message);
    }
  }

  function downloadCode() {
    if (!pythonWorkflow) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const workflowName = workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    // Create a zip-like structure with multiple Python workflow files
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
      },
      {
        name: `${workflowName}_readme.md`,
        content: generatePythonReadme()
      }
    ];
    
    // Download each file separately (since we can't create zip in browser easily)
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

  function generateReadme(): string {
    return `# ${workflow.name} - Dapr Workflow

## Description
${workflow.description || 'Generated Dapr workflow from visual workflow builder'}

## Workflow Pattern
**Pattern:** ${generatedWorkflow?.workflowPattern || 'activity-sequence'}

## Execution Order
${generatedWorkflow?.executionOrder.map((stepId, index) => {
  const step = workflow.steps.find(s => s.id === stepId);
  return `${index + 1}. ${step?.name || stepId} (${step?.type || 'unknown'})`;
}).join('\n') || 'No steps defined'}

## Setup Instructions

1. **Install Dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start Dapr Sidecar**
   \`\`\`bash
   dapr run --app-id workflow-app --app-port 3000 --dapr-http-port 3500 --dapr-grpc-port 50001
   \`\`\`

3. **Run the Workflow**
   \`\`\`bash
   npm start
   \`\`\`

## Configuration

Update the workflow input data in the main function to match your dataset and requirements.

## Data Processing Steps

${workflow.steps.filter(s => s.type !== 'dataset_input' && s.type !== 'dataset_output').map(step => 
  `- **${step.name}**: ${step.description} (Type: ${step.type})`
).join('\n') || 'No processing steps defined'}

## Generated Files

- \`${workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_workflow.ts\`: Workflow and activity definitions
- \`${workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_app.ts\`: Main application code
- \`package.json\`: Dependencies and scripts
- \`README.md\`: This documentation

## Notes

- This code is generated from the visual workflow builder
- TODO comments indicate where you need to implement your specific data processing logic
- Make sure to implement the data processing utility functions referenced in the activities
- Adjust timeouts and retry policies based on your requirements
`;
  }

  function generatePythonReadme(): string {
    return `# ${workflow.name} - Python + Dapr Workflow

## Description
${workflow.description || 'Generated Python-based Dapr workflow from visual workflow builder'}

## Architecture
This workflow combines **Python data processing** with **Dapr workflow orchestration**:

- **🐍 Python Script**: Contains the actual data processing logic with ML/NLP libraries
- **⚡ Dapr Workflow**: Orchestrates Python script execution with monitoring and error handling
- **🔧 Dapr Activities**: Bridge between Dapr workflow and Python script execution
- **📦 Virtual Environment**: Isolated Python environment for dependencies

## Workflow Pattern
**Pattern:** ${pythonWorkflow?.workflowPattern || 'python-activity-sequence'}

## Processing Steps
${pythonWorkflow?.executionOrder.map((stepId, index) => {
  const step = workflow.steps.find(s => s.id === stepId);
  return `${index + 1}. ${step?.name || stepId} (${step?.type || 'unknown'})`;
}).join('\n') || 'No steps defined'}

## Setup Instructions

### 1. Python Environment Setup
\`\`\`bash
# Create virtual environment
python3 -m venv workflow_env
source workflow_env/bin/activate  # On Windows: workflow_env\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt
\`\`\`

### 2. Dapr Setup
\`\`\`bash
# Initialize Dapr (if not already done)
dapr init

# Start the Dapr workflow runtime
npm install
npm start
\`\`\`

### 3. Test Python Script Directly
\`\`\`bash
# Test the Python workflow script directly
python ${workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_workflow.py '{"dataset": "test_data", "parameters": {}}'
\`\`\`

### 4. Run Complete Workflow
\`\`\`bash
# Run through Dapr workflow orchestration
dapr run --app-id python-workflow --app-port 3000 --dapr-http-port 3500 \\
  node ${workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_dapr_app.ts
\`\`\`

## Python Dependencies
The following libraries are included for advanced data processing:
- **pandas**: Data manipulation and analysis
- **numpy**: Numerical computing
- **scikit-learn**: Machine learning algorithms
- **textblob**: Text processing and sentiment analysis
- **nltk**: Natural language processing toolkit

## Generated Files
1. **\`${workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_workflow.py\`**: Main Python script with ML/NLP processing
2. **\`requirements.txt\`**: Python dependencies
3. **\`${workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_dapr_workflow.ts\`**: Dapr workflow orchestration
4. **\`${workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_dapr_activities.ts\`**: Dapr activities for Python execution
5. **\`${workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_dapr_app.ts\`**: Complete Dapr application

## Features
- ✅ **Real Python ML/NLP Processing**: Uses actual libraries like scikit-learn, pandas, textblob
- ✅ **Virtual Environment Isolation**: Each workflow has its own Python environment
- ✅ **Dapr Orchestration**: Enterprise-grade workflow management
- ✅ **Error Handling**: Comprehensive error handling and logging
- ✅ **Monitoring**: Real-time progress tracking and status updates
- ✅ **Scalability**: Dapr provides distributed computing capabilities

## Workflow Execution Flow
1. **Visual Design** → User creates workflow in visual builder
2. **Code Generation** → System generates Python + Dapr code
3. **Environment Setup** → Creates virtual environment and installs dependencies
4. **Dapr Orchestration** → Dapr workflow manages Python script execution
5. **Data Processing** → Python script performs actual ML/NLP operations
6. **Results** → Comprehensive output with processing results

## Notes
- Ensure Python 3.8+ is installed
- NLTK data will be downloaded automatically on first run
- Virtual environment path: \`workflow-venvs/<workflow-id>/\`
- Adjust timeout settings in Dapr activities based on your data size
- Monitor logs through Dapr dashboard or application logs
`;
  }

  function generatePackageJson(): string {
    const workflowName = workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    return JSON.stringify({
      "name": `${workflowName}-dapr-workflow`,
      "version": "1.0.0",
      "description": workflow.description || "Generated Dapr workflow",
      "main": `${workflowName}_app.ts`,
      "scripts": {
        "start": `ts-node ${workflowName}_app.ts`,
        "build": "tsc",
        "dev": "ts-node-dev --respawn --transpile-only src/app.ts"
      },
      "dependencies": {
        "@dapr/dapr": "^3.0.0",
        "typescript": "^5.0.0",
        "ts-node": "^10.9.0"
      },
      "devDependencies": {
        "@types/node": "^20.0.0",
        "ts-node-dev": "^2.0.0"
      },
      "keywords": ["dapr", "workflow", "data-processing"],
      "author": "Workflow Builder",
      "license": "MIT"
    }, null, 2);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Show a temporary success message
      const button = event?.target as HTMLElement;
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard');
    });
  }

  // Connection functionality
  function handlePortClick(event, step, portType, portIndex) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Port clicked:', { step: step.id, portType, portIndex, isConnecting });
    
    if (!isConnecting) {
      // Start a new connection - only from output ports
      if (portType === 'output') {
        isConnecting = true;
        connectionStart = { step: step.id, portType, portIndex };
        console.log('Starting connection from:', connectionStart);
        
        // Track mouse movement for temporary connection line
        const handleMouseMove = (e) => {
          const rect = workflowCanvas.getBoundingClientRect();
          mousePosition = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };
        };
        
        const handleMouseUp = (e) => {
          // Don't cancel immediately - let port clicks handle completion
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      } else {
        console.log('Cannot start connection from input port');
      }
    } else {
      // Complete an existing connection - only to input ports
      if (connectionStart && connectionStart.portType === 'output' && portType === 'input') {
        console.log('Completing connection to:', { step: step.id, portType, portIndex });
        
        const newConnection = {
          id: `conn_${Date.now()}`,
          from: connectionStart.step,
          fromPort: connectionStart.portIndex,
          to: step.id,
          toPort: portIndex
        };
        
        // Check if connection already exists
        const exists = workflow.connections.some(conn => 
          conn.from === newConnection.from && 
          conn.to === newConnection.to &&
          conn.fromPort === newConnection.fromPort &&
          conn.toPort === newConnection.toPort
        );
        
        if (!exists) {
          workflow.connections = [...workflow.connections, newConnection];
          console.log('Connection created:', newConnection);
        } else {
          console.log('Connection already exists');
        }
        
        isConnecting = false;
        connectionStart = null;
        tempConnection = null;
      } else {
        console.log('Invalid connection attempt');
      }
    }
  }

  function deleteConnection(connectionId) {
    workflow.connections = workflow.connections.filter(c => c.id !== connectionId);
  }

  function getStepPosition(stepId) {
    const step = workflow.steps.find(s => s.id === stepId);
    return step ? step.position : { x: 0, y: 0 };
  }

  function getPortPosition(stepId, portType, portIndex) {
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

  // Step dragging functionality
  function handleCanvasClick(event) {
    // Cancel connection if clicking on empty canvas
    if (isConnecting && event.target === workflowCanvas) {
      console.log('Canceling connection - clicked on empty canvas');
      isConnecting = false;
      connectionStart = null;
      tempConnection = null;
    }
  }

  function startStepDrag(event, step) {
    // Don't start drag if we're clicking on a port or already connecting
    if (isConnecting || event.target.closest('.port')) return;
    
    isDraggingStep = true;
    draggedStepId = step.id;
    
    const rect = workflowCanvas.getBoundingClientRect();
    dragOffset = {
      x: event.clientX - rect.left - step.position.x,
      y: event.clientY - rect.top - step.position.y
    };
    
    const handleMouseMove = (e) => {
      if (isDraggingStep && draggedStepId) {
        const rect = workflowCanvas.getBoundingClientRect();
        const newX = Math.max(0, e.clientX - rect.left - dragOffset.x);
        const newY = Math.max(0, e.clientY - rect.top - dragOffset.y);
        
        workflow.steps = workflow.steps.map(s => 
          s.id === draggedStepId 
            ? { ...s, position: { x: newX, y: newY } }
            : s
        );
      }
    };
    
    const handleMouseUp = () => {
      isDraggingStep = false;
      draggedStepId = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
</script>

<svelte:head>
  <title>Workflow Builder - Data Processing - Social Explorer</title>
  <meta name="description" content="Visual workflow builder for creating custom data processing pipelines" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <button 
            on:click={() => window.location.href='/data-management'}
            class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors">
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
            on:click={saveWorkflow}
            class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl text-sm font-medium transition-colors">
            Save Workflow
          </button>
          <button 
            on:click={generateDaprCode}
            disabled={workflow.steps.length === 0}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
            </svg>
            <span>Generate Code</span>
          </button>
          <button 
            on:click={publishWorkflow}
            disabled={workflow.steps.length === 0}
            class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <span>Publish</span>
          </button>
          <button 
            on:click={runWorkflow}
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
    <!-- Component Library Sidebar -->
    <div class="w-80 bg-white border-r border-gray-200 overflow-y-auto">
      <div class="p-4">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Component Library</h2>
        
        {#each stepLibrary as category}
          <div class="mb-6">
            <h3 class="text-sm font-medium text-gray-700 mb-3">{category.category}</h3>
            <div class="space-y-2">
              {#each category.steps as step}
                <div 
                  class="p-3 border border-gray-200 rounded-xl cursor-move hover:shadow-md transition-shadow {getStepColor(step.color)}"
                  draggable="true"
                  on:dragstart={(e) => handleDragStart(e, step)}>
                  <div class="flex items-center space-x-3">
                    <span class="text-lg">{step.icon}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900">{step.name}</p>
                      <p class="text-xs text-gray-600 truncate">{step.description}</p>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Workflow Canvas -->
    <div class="flex-1 flex flex-col">
      <!-- Canvas Header -->
      <div class="bg-white border-b border-gray-200 p-4">
        <div class="flex items-center justify-between">
          <div>
            <input 
              bind:value={workflow.name}
              class="text-lg font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2"
              placeholder="Workflow name">
            <input 
              bind:value={workflow.description}
              class="block text-sm text-gray-600 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 mt-1"
              placeholder="Workflow description">
          </div>
          <div class="text-sm text-gray-500">
            {workflow.steps.length} steps • {workflow.connections.length} connections
          </div>
        </div>
      </div>

      <!-- Canvas Area -->
      <div 
        bind:this={workflowCanvas}
        class="flex-1 relative bg-gray-50 overflow-auto"
        on:dragover={handleDragOver}
        on:drop={handleDrop}
        on:click={handleCanvasClick}>
        
        <!-- Grid Background -->
        <div class="absolute inset-0 opacity-40" style="background-image: radial-gradient(circle, #d1d5db 1px, transparent 1px); background-size: 20px 20px;"></div>
        
        <!-- Connection Lines -->
        <svg class="absolute inset-0 w-full h-full pointer-events-none" style="z-index: 1;">
          <!-- Existing connections -->
          {#each workflow.connections as connection (connection.id)}
            {#if workflow.steps.find(s => s.id === connection.from) && workflow.steps.find(s => s.id === connection.to)}
              {@const fromPos = getPortPosition(connection.from, 'output', connection.fromPort)}
              {@const toPos = getPortPosition(connection.to, 'input', connection.toPort)}
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
                  on:click={() => deleteConnection(connection.id)}
                />
                <text
                  x={midX}
                  y={(fromPos.y + toPos.y) / 2 + 10}
                  text-anchor="middle"
                  class="text-xs fill-red-500 pointer-events-auto cursor-pointer"
                  on:click={() => deleteConnection(connection.id)}
                >×</text>
              </g>
            {/if}
          {/each}
          
          <!-- Temporary connection line while dragging -->
          {#if isConnecting && connectionStart}
            {@const startPos = getPortPosition(connectionStart.step, connectionStart.portType, connectionStart.portIndex)}
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
            on:mousedown={(e) => startStepDrag(e, step)}
            on:click={() => selectStep(step)}>
            
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-2">
                <span class="text-lg">{step.icon}</span>
                <span class="text-sm font-medium text-gray-900">{step.name}</span>
              </div>
              <button 
                on:click|stopPropagation={() => deleteStep(step.id)}
                class="text-gray-400 hover:text-red-600 transition-colors">
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
                    on:click={(e) => handlePortClick(e, step, 'input', index)}
                    on:mouseenter={() => {}}
                  >
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
                    on:click={(e) => handlePortClick(e, step, 'output', index)}
                    on:mouseenter={() => {}}
                  >
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
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {step.status}
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
    </div>

    <!-- Configuration Panel -->
    {#if showStepConfig && selectedStep}
      <div class="w-80 bg-white border-l border-gray-200 overflow-y-auto">
        <div class="p-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Configure Step</h3>
            <button 
              on:click={() => showStepConfig = false}
              class="text-gray-400 hover:text-gray-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <div class="space-y-4">
            <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
              <span class="text-xl">{selectedStep.icon}</span>
              <div>
                <h4 class="font-medium text-gray-900">{selectedStep.name}</h4>
                <p class="text-sm text-gray-600">{selectedStep.description}</p>
              </div>
            </div>

            <!-- Dynamic configuration form based on step type -->
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
                    on:change={(e) => updateStepConfig(selectedStep.id, { dataset_id: e.target.value })}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select dataset...</option>
                    {#each availableDatasets as dataset}
                      <option value={dataset.id}>{dataset.name}</option>
                    {/each}
                  </select>
                  
                  {#if selectedStep.config.dataset_id}
                    {@const selectedDataset = availableDatasets.find(d => d.id === selectedStep.config.dataset_id)}
                    {#if selectedDataset}
                      <div class="mt-2 p-3 bg-blue-50 rounded-lg">
                        <div class="flex items-start space-x-2">
                          <div class="flex-shrink-0 mt-0.5">
                            {#if selectedDataset.type === 'unified'}
                              <span class="text-lg">🔗</span>
                            {:else if selectedDataset.type === 'social_media'}
                              <span class="text-lg">📱</span>
                            {:else if selectedDataset.type === 'analytics'}
                              <span class="text-lg">📊</span>
                            {:else if selectedDataset.type === 'mobile_analytics'}
                              <span class="text-lg">📱</span>
                            {:else}
                              <span class="text-lg">📄</span>
                            {/if}
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
                        <span class="text-yellow-600">⚠️</span>
                        <div>
                          <p class="text-sm font-medium text-yellow-800">No datasets available</p>
                          <p class="text-xs text-yellow-700">Run data collection or import datasets to get started</p>
                        </div>
                      </div>
                    </div>
                  {/if}
                {/if}
                
                <div class="mt-3">
                  <button 
                    on:click={loadAvailableDatasets}
                    class="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    <span>Refresh datasets</span>
                  </button>
                </div>
              </div>
            {:else if selectedStep.type === 'text_preprocessing'}
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Text Columns</label>
                  <input type="text" placeholder="comma-separated column names" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="space-y-2">
                  <label class="flex items-center">
                    <input type="checkbox" checked class="rounded">
                    <span class="ml-2 text-sm text-gray-700">Convert to lowercase</span>
                  </label>
                  <label class="flex items-center">
                    <input type="checkbox" checked class="rounded">
                    <span class="ml-2 text-sm text-gray-700">Remove punctuation</span>
                  </label>
                  <label class="flex items-center">
                    <input type="checkbox" checked class="rounded">
                    <span class="ml-2 text-sm text-gray-700">Remove stopwords</span>
                  </label>
                  <label class="flex items-center">
                    <input type="checkbox" class="rounded">
                    <span class="ml-2 text-sm text-gray-700">Apply stemming</span>
                  </label>
                </div>
              </div>
            {:else if selectedStep.type === 'sentiment_analysis'}
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Text Column</label>
                  <input type="text" placeholder="text column name" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Model</label>
                  <select class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="vader">VADER</option>
                    <option value="textblob">TextBlob</option>
                    <option value="transformer">Transformer (BERT)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Output Columns</label>
                  <input type="text" value="sentiment,confidence" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
              </div>
            {:else}
              <div class="text-sm text-gray-500">
                Configuration options for {selectedStep.name} will be displayed here.
              </div>
            {/if}

            <div class="pt-4 border-t border-gray-200">
              <button class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                Update Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Code Export Modal -->
{#if showCodeExport && pythonWorkflow}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
            <h3 class="text-xl font-semibold text-gray-900">Generated Python Workflow</h3>
            <p class="text-sm text-gray-600">Pattern: {pythonWorkflow.workflowPattern} • {workflow.steps.length} steps • Virtual Environment Enabled</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <button 
            on:click={downloadCode}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span>Download Files</span>
          </button>
          <button 
            on:click={() => showCodeExport = false}
            class="text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Code Tabs -->
      <div class="border-b border-gray-200">
        <nav class="flex space-x-8 px-6">
          <button 
            on:click={() => activeCodeTab = 'python'}
            class="py-3 border-b-2 font-medium text-sm transition-colors {activeCodeTab === 'python' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            🐍 Python Script
          </button>
          <button 
            on:click={() => activeCodeTab = 'requirements'}
            class="py-3 border-b-2 font-medium text-sm transition-colors {activeCodeTab === 'requirements' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            📦 Requirements
          </button>
          <button 
            on:click={() => activeCodeTab = 'dapr'}
            class="py-3 border-b-2 font-medium text-sm transition-colors {activeCodeTab === 'dapr' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            ⚡ Dapr Workflow
          </button>
          <button 
            on:click={() => activeCodeTab = 'activities'}
            class="py-3 border-b-2 font-medium text-sm transition-colors {activeCodeTab === 'activities' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            🔧 Activities
          </button>
        </nav>
      </div>

      <!-- Code Content -->
      <div class="flex-1 overflow-hidden">
        {#if activeCodeTab === 'python'}
          <div class="h-full flex flex-col">
            <div class="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
              <h4 class="text-sm font-medium text-gray-900">🐍 Python Workflow Script</h4>
              <button 
                on:click={() => copyToClipboard(pythonWorkflow.pythonScript)}
                class="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <div class="flex-1 overflow-auto">
              <pre class="text-xs text-gray-800 p-4 bg-gray-50 h-full overflow-auto"><code>{pythonWorkflow.pythonScript}</code></pre>
            </div>
          </div>
        {:else if activeCodeTab === 'requirements'}
          <div class="h-full flex flex-col">
            <div class="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
              <h4 class="text-sm font-medium text-gray-900">📦 Python Requirements</h4>
              <button 
                on:click={() => copyToClipboard(pythonWorkflow.requirements)}
                class="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <div class="flex-1 overflow-auto">
              <pre class="text-xs text-gray-800 p-4 bg-gray-50 h-full overflow-auto"><code>{pythonWorkflow.requirements}</code></pre>
            </div>
          </div>
        {:else if activeCodeTab === 'dapr'}
          <div class="h-full flex flex-col">
            <div class="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
              <h4 class="text-sm font-medium text-gray-900">⚡ Dapr Workflow Orchestration</h4>
              <button 
                on:click={() => copyToClipboard(pythonWorkflow.workflowCode)}
                class="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <div class="flex-1 overflow-auto">
              <pre class="text-xs text-gray-800 p-4 bg-gray-50 h-full overflow-auto"><code>{pythonWorkflow.workflowCode}</code></pre>
            </div>
          </div>
        {:else if activeCodeTab === 'activities'}
          <div class="h-full flex flex-col">
            <div class="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
              <h4 class="text-sm font-medium text-gray-900">🔧 Dapr Activities</h4>
              <button 
                on:click={() => copyToClipboard(pythonWorkflow.activityCode)}
                class="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <div class="flex-1 overflow-auto">
              <pre class="text-xs text-gray-800 p-4 bg-gray-50 h-full overflow-auto"><code>{pythonWorkflow.activityCode}</code></pre>
            </div>
          </div>
        {/if}
      </div>

      <!-- Modal Footer -->
      <div class="p-6 border-t border-gray-200 bg-gray-50">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-600">
            <p><strong>Workflow Pattern:</strong> {pythonWorkflow.workflowPattern}</p>
            <p><strong>Steps:</strong> {pythonWorkflow.executionOrder.length} activities</p>
            <p><strong>Runtime:</strong> Python + Dapr with Virtual Environment</p>
          </div>
          <div class="flex items-center space-x-3">
            <button 
              on:click={() => showCodeExport = false}
              class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg text-sm font-medium transition-colors">
              Close
            </button>
            <button 
              on:click={downloadCode}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              Download All Files
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Publish Workflow Dialog -->
{#if showPublishDialog}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Publish Workflow</h3>
          <button 
            on:click={() => showPublishDialog = false}
            class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Workflow Name</label>
            <input 
              bind:value={publishMetadata.name}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter workflow name">
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea 
              bind:value={publishMetadata.description}
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Describe what this workflow does"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Version</label>
              <input 
                bind:value={publishMetadata.version}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="1.0.0">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Created By</label>
              <input 
                bind:value={publishMetadata.createdBy}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your name">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
            <input 
              bind:value={publishMetadata.tags}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="data-processing, analytics, nlp">
          </div>
        </div>

        <div class="flex items-center justify-end space-x-3 mt-6">
          <button 
            on:click={() => showPublishDialog = false}
            class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg text-sm font-medium transition-colors">
            Cancel
          </button>
          <button 
            on:click={confirmPublishWorkflow}
            disabled={loadingPublish || !publishMetadata.name}
            class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
            {#if loadingPublish}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {/if}
            <span>{loadingPublish ? 'Publishing...' : 'Publish Workflow'}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Execute Workflow Dialog -->
{#if showExecuteDialog}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Execute Workflow</h3>
          <button 
            on:click={() => showExecuteDialog = false}
            class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Execution Input (JSON)</label>
            <textarea 
              bind:value={executionInput}
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
              placeholder={executionInputPlaceholder}></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select 
                bind:value={executionOptions.priority}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Triggered By</label>
              <select 
                bind:value={executionOptions.triggeredBy}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="manual">Manual</option>
                <option value="api">API</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end space-x-3 mt-6">
          <button 
            on:click={() => showExecuteDialog = false}
            class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg text-sm font-medium transition-colors">
            Cancel
          </button>
          <button 
            on:click={() => executeWorkflow()}
            disabled={loadingExecute}
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
            {#if loadingExecute}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {/if}
            <span>{loadingExecute ? 'Starting...' : 'Start Execution'}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Execution Monitor Dialog -->
{#if showExecutionMonitor && currentExecution}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl shadow-xl max-w-7xl w-full mx-4 max-h-[95vh] flex flex-col">
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
            {#if currentExecution.status === 'running'}
              <div class="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            {:else if currentExecution.status === 'completed'}
              <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            {:else if currentExecution.status === 'failed'}
              <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            {:else}
              <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            {/if}
          </div>
          <div>
            <h3 class="text-xl font-semibold text-gray-900">Workflow Execution</h3>
            <p class="text-sm text-gray-600">{currentExecution.workflowName} • {currentExecution.status}</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          {#if currentExecution.status === 'running'}
            <button 
              on:click={cancelExecution}
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
          {/if}
          <button 
            on:click={() => showExecutionMonitor = false}
            class="text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-auto p-6">
        <!-- Progress Bar -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700">Progress</span>
            <span class="text-sm text-gray-600">{currentExecution.progress}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-emerald-600 h-2 rounded-full transition-all duration-300" style="width: {currentExecution.progress}%"></div>
          </div>
          {#if currentExecution.currentStep}
            <p class="text-sm text-gray-600 mt-2">Current step: {currentExecution.currentStep}</p>
          {/if}
        </div>

        <!-- Execution Logs (Primary Focus) -->
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 class="text-sm font-medium text-gray-900 mb-4">Execution Logs</h4>
          <div class="space-y-1 max-h-[50vh] overflow-auto bg-gray-900 rounded-lg p-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {#each currentExecution.logs as log}
              <div class="flex items-start space-x-3 text-sm font-mono hover:bg-gray-800 px-2 py-1 rounded">
                <span class="text-xs text-gray-400 w-20 flex-shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span class="w-12 flex-shrink-0 font-semibold {log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-green-400'}">
                  {log.level.toUpperCase()}
                </span>
                <span class="text-gray-100 flex-1 break-words leading-relaxed">{log.message}</span>
              </div>
            {/each}
            {#if currentExecution.logs.length === 0}
              <p class="text-sm text-gray-400 italic">No logs available yet...</p>
            {/if}
          </div>
        </div>

        <!-- Execution Details & Results -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="text-sm font-medium text-gray-900 mb-2">Execution Details</h4>
            <div class="text-sm text-gray-600 space-y-1">
              <p><strong>ID:</strong> {currentExecution.id}</p>
              <p><strong>Started:</strong> {new Date(currentExecution.startedAt).toLocaleString()}</p>
              {#if currentExecution.completedAt}
                <p><strong>Completed:</strong> {new Date(currentExecution.completedAt).toLocaleString()}</p>
              {/if}
              {#if currentExecution.duration}
                <p><strong>Duration:</strong> {Math.round(currentExecution.duration / 1000)}s</p>
              {/if}
              <p><strong>Priority:</strong> {currentExecution.metadata.priority}</p>
            </div>
          </div>

          {#if currentExecution.output}
            <div class="bg-gray-50 rounded-lg p-4">
              <h4 class="text-sm font-medium text-gray-900 mb-2">Results</h4>
              <div class="text-sm text-gray-600 max-h-64 overflow-auto">
                <pre class="whitespace-pre-wrap font-mono bg-gray-800 text-gray-100 p-3 rounded">{JSON.stringify(currentExecution.output, null, 2)}</pre>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}