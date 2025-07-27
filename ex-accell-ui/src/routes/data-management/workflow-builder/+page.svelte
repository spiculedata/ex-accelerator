<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  
  // Redirect to projects if no current project
  onMount(() => {
    if (!$currentProject) {
      window.location.href = '/projects';
    }
  });

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
      'green': 'bg-green-100 border-green-300 text-green-800',
      'yellow': 'bg-yellow-100 border-yellow-300 text-yellow-800',
      'purple': 'bg-purple-100 border-purple-300 text-purple-800',
      'indigo': 'bg-indigo-100 border-indigo-300 text-indigo-800',
      'orange': 'bg-orange-100 border-orange-300 text-orange-800',
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
    console.log('Running workflow:', workflow);
    alert('Workflow execution started!');
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
            class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
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
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            Save Workflow
          </button>
          <button 
            on:click={runWorkflow}
            class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
            Run Workflow
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
                  class="p-3 border border-gray-200 rounded-lg cursor-move hover:shadow-md transition-shadow {getStepColor(step.color)}"
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
            class="absolute bg-white rounded-lg shadow-md border-2 border-gray-300 p-4 min-w-[150px] cursor-move hover:shadow-lg transition-shadow"
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
                    class="port w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow cursor-pointer hover:bg-green-600 transition-colors relative group"
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
            <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
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
                <select class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select dataset...</option>
                  <option value="ds1">Twitter Sentiment Dataset</option>
                  <option value="ds2">Multi-Platform Engagement Data</option>
                  <option value="ds3">Hashtag Analysis Results</option>
                </select>
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
              <button class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                Update Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>