<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentProject, loadCurrentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  import ErrorAlert from '$lib/components/ui/ErrorAlert.svelte';

  // Load current project and check if exists
  onMount(async () => {
    await loadCurrentProject();

    // Only redirect after we've tried to load the project
    if (!$currentProject) {
      goto('/projects');
    }
  });

  let errorMessage = '';
  let jupyterUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8888` : 'http://localhost:8888';
  let isJupyterRunning = false;
  let notebookFile = '';
  let notebookTemplate = 'sentiment_analysis';
  
  // Available notebook templates
  const notebookTemplates = [
    { 
      id: 'sentiment_analysis', 
      name: 'Sentiment Analysis',
      description: 'Analyze sentiment patterns in social media data using NLTK and TextBlob',
      file: 'sentiment_analysis.ipynb'
    },
    { 
      id: 'topic_modeling', 
      name: 'Topic Modeling',
      description: 'Discover hidden topics using LDA and word embeddings',
      file: 'topic_modeling.ipynb'
    },
    { 
      id: 'text_classification', 
      name: 'Text Classification',
      description: 'Build custom classifiers for content categorization',
      file: 'text_classification.ipynb'
    },
    { 
      id: 'language_detection', 
      name: 'Language Detection',
      description: 'Multi-language text detection and analysis',
      file: 'language_detection.ipynb'
    },
    { 
      id: 'deepseek_openllm_demo', 
      name: 'DeepSeek R1 OpenLLM Demo',
      description: 'Comprehensive demo of DeepSeek R1 model capabilities via OpenLLM',
      file: 'deepseek_openllm_demo.ipynb'
    },
    { 
      id: 'deepseek_gdelt_integration', 
      name: 'DeepSeek + GDELT Integration',
      description: 'AI-powered analysis of global events using DeepSeek R1 and GDELT data',
      file: 'deepseek_gdelt_integration.ipynb'
    },
    { 
      id: 'ollama_gdelt_integration', 
      name: 'Ollama + GDELT Integration',
      description: 'Local AI model deployment with Ollama for GDELT analysis - easier setup alternative to OpenLLM',
      file: 'ollama_gdelt_integration.ipynb'
    },
    { 
      id: 'custom_research', 
      name: 'Custom Research',
      description: 'Blank notebook for custom text analytics research',
      file: 'custom_research.ipynb'
    }
  ];

  let selectedTemplate = notebookTemplates[0];

  function startJupyter() {
    // Open JupyterLab in a new tab
    window.open(jupyterUrl, '_blank');
  }

  let showEmbeddedNotebook = false;

  function createNotebook() {
    if (selectedTemplate) {
      notebookFile = selectedTemplate.file;
      showEmbeddedNotebook = true;
    }
  }

  function openInJupyterLab() {
    const url = `${jupyterUrl}/lab/tree/notebooks/${notebookFile}`;
    window.open(url, '_blank');
  }

  async function checkJupyterStatus() {
    try {
      const response = await fetch(`${jupyterUrl}/api`, { method: 'GET' });
      isJupyterRunning = response.ok;
    } catch (error) {
      isJupyterRunning = false;
    }
  }

  // Check Jupyter status periodically
  onMount(() => {
    const interval = setInterval(checkJupyterStatus, 2000);
    return () => clearInterval(interval);
  });

  // Sample notebook content for demonstration
  const sampleNotebookContent = `{
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "# ${selectedTemplate.name}\\n",
    "\\n",
    "${selectedTemplate.description}\\n",
    "\\n",
    "This notebook provides an interactive environment for text analytics research and experimentation."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "source": [
    "# Import required libraries\\n",
    "import pandas as pd\\n",
    "import numpy as np\\n",
    "import matplotlib.pyplot as plt\\n",
    "import seaborn as sns\\n",
    "from textblob import TextBlob\\n",
    "import nltk\\n",
    "\\n",
    "# Download required NLTK data\\n",
    "nltk.download('punkt')\\n",
    "nltk.download('vader_lexicon')\\n",
    "\\n",
    "print('Libraries loaded successfully!')"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "source": [
    "# Load sample data\\n",
    "sample_texts = [\\n",
    "    \\"I love this new product! It's amazing!\\",\\n",
    "    \\"This is terrible, worst experience ever.\\",\\n",
    "    \\"It's okay, nothing special but not bad either.\\",\\n",
    "    \\"Absolutely fantastic! Highly recommend!\\",\\n",
    "    \\"Not worth the money, very disappointed.\\"\\n",
    "]\\n",
    "\\n",
    "df = pd.DataFrame({'text': sample_texts})\\n",
    "print(f'Loaded {len(df)} sample texts')\\n",
    "df.head()"
   ]
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "Python 3",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.12.0"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 4
}`;

  function downloadNotebook() {
    const blob = new Blob([sampleNotebookContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedTemplate.file;
    a.click();
    window.URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>Research Investigation - Text Analytics - Social Explorer</title>
  <meta name="description" content="Interactive Jupyter notebooks for text analytics research and experimentation" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-slate-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <button 
            on:click={() => goto('/text-analytics')}
            class="mr-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors backdrop-blur-sm">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Research Investigation</h1>
            <p class="text-slate-300 text-lg font-medium">Interactive Jupyter notebooks for advanced text analytics research and experimentation</p>
            {#if $currentProject}
              <div class="flex items-center mt-3">
                <span class="text-sm text-slate-400">Project:</span>
                <span class="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                  {$currentProject.name}
                </span>
              </div>
            {/if}
          </div>
        </div>
        
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 rounded-full {isJupyterRunning ? 'bg-green-400' : 'bg-red-400'}"></div>
            <span class="text-white text-sm">JupyterLab {isJupyterRunning ? 'Running' : 'Stopped'}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

    <!-- Quick Start Section -->
    <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Quick Start</h2>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Template Selection -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-4">Choose Research Template</h3>
          <div class="space-y-3">
            {#each notebookTemplates as template}
              <div 
                class="p-4 border rounded-xl cursor-pointer transition-colors {selectedTemplate.id === template.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}"
                on:click={() => selectedTemplate = template}>
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center">
                    <h4 class="font-medium text-gray-900">{template.name}</h4>
                    {#if template.id.includes('deepseek') || template.id.includes('ollama')}
                      <span class="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        AI-Powered
                      </span>
                    {/if}
                  </div>
                  <input 
                    type="radio" 
                    bind:group={selectedTemplate} 
                    value={template}
                    class="text-blue-600">
                </div>
                <p class="text-sm text-gray-600">{template.description}</p>
                {#if template.id.includes('deepseek')}
                  <div class="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                    <strong>⚠️ Setup Required:</strong> Run <code class="bg-amber-100 px-1 rounded">poetry run openllm serve deepseek:r1-llama3.1-8b --port 3000</code> first
                  </div>
                {:else if template.id.includes('ollama')}
                  <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                    <strong>✅ Setup Required:</strong> Install <a href="https://ollama.ai/" target="_blank" class="underline">Ollama</a> then run <code class="bg-green-100 px-1 rounded">ollama pull llama3.3:8b</code>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Actions -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-4">Get Started</h3>
          
          <div class="space-y-4">
            <!-- Step 1: Start Jupyter -->
            <div class="p-4 border border-gray-200 rounded-xl">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-gray-900">Step 1: Start JupyterLab Server</span>
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {isJupyterRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                  {isJupyterRunning ? 'Running' : 'Stopped'}
                </span>
              </div>

              {#if !isJupyterRunning}
                <button
                  on:click={startJupyter}
                  class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                  Start JupyterLab
                </button>
              {:else}
                <div class="bg-green-50 rounded-xl p-4 text-sm">
                  <p class="font-medium text-green-900 mb-2">✓ JupyterLab is running</p>
                  <p class="text-green-700">Server available at <a href="{jupyterUrl}" target="_blank" class="text-blue-600 hover:underline font-medium">{jupyterUrl}</a></p>
                </div>
              {/if}
            </div>

            <!-- Step 2: Create Notebook -->
            <div class="p-4 border border-gray-200 rounded-xl">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-gray-900">Step 2: Create Research Notebook</span>
              </div>
              
              <div class="space-y-2">
                <button 
                  on:click={downloadNotebook}
                  class="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
                  Download {selectedTemplate.name} Template
                </button>
                
                <button 
                  on:click={createNotebook}
                  class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                  Open in Embedded Viewer
                </button>
                
                {#if isJupyterRunning}
                  <button 
                    on:click={openInJupyterLab}
                    class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                    Open in JupyterLab
                  </button>
                {:else}
                  <button 
                    on:click={() => goto('/text-analytics/jupyter')}
                    class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                    Go to Jupyter Lab Page
                  </button>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Embedded Notebook Viewer -->
    {#if showEmbeddedNotebook}
      <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-900">Notebook: {selectedTemplate.name}</h2>
          <div class="flex items-center space-x-2">
            <button 
              on:click={() => showEmbeddedNotebook = false}
              class="px-3 py-1 text-gray-600 hover:text-gray-800 text-sm">
              Hide
            </button>
            {#if isJupyterRunning}
              <button 
                on:click={openInJupyterLab}
                class="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm">
                Open in JupyterLab
              </button>
            {/if}
          </div>
        </div>
        
        <!-- Notebook iframe placeholder -->
        <div class="border border-gray-200 rounded-xl overflow-hidden" style="height: 600px;">
          {#if isJupyterRunning}
            <iframe 
              src="{jupyterUrl}/lab/tree/notebooks/{notebookFile}" 
              class="w-full h-full"
              title="Jupyter Notebook">
            </iframe>
          {:else}
            <div class="flex items-center justify-center h-full bg-gray-50">
              <div class="text-center">
                <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                <h3 class="text-lg font-medium text-gray-900 mb-2">JupyterLab Not Running</h3>
                <p class="text-gray-600">Start JupyterLab server to view notebooks in embedded mode</p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Features Overview -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <!-- Research Capabilities -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Research Capabilities</h3>
        <div class="space-y-3">
          <div class="flex items-start space-x-3">
            <div class="w-6 h-6 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">Interactive Data Analysis</h4>
              <p class="text-sm text-gray-600">Explore and visualize text data with Python libraries</p>
            </div>
          </div>
          
          <div class="flex items-start space-x-3">
            <div class="w-6 h-6 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">Advanced NLP Techniques</h4>
              <p class="text-sm text-gray-600">Implement custom algorithms and models</p>
            </div>
          </div>
          
          <div class="flex items-start space-x-3">
            <div class="w-6 h-6 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
              </svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">Real-time Collaboration</h4>
              <p class="text-sm text-gray-600">Share notebooks and collaborate with team members</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Available Libraries -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Pre-installed Libraries</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-gray-50 rounded-xl text-center">
            <div class="font-medium text-gray-900 text-sm">pandas</div>
            <div class="text-xs text-gray-600">Data Analysis</div>
          </div>
          <div class="p-3 bg-gray-50 rounded-xl text-center">
            <div class="font-medium text-gray-900 text-sm">scikit-learn</div>
            <div class="text-xs text-gray-600">Machine Learning</div>
          </div>
          <div class="p-3 bg-gray-50 rounded-xl text-center">
            <div class="font-medium text-gray-900 text-sm">nltk</div>
            <div class="text-xs text-gray-600">NLP Toolkit</div>
          </div>
          <div class="p-3 bg-gray-50 rounded-xl text-center">
            <div class="font-medium text-gray-900 text-sm">textblob</div>
            <div class="text-xs text-gray-600">Text Processing</div>
          </div>
          <div class="p-3 bg-gray-50 rounded-xl text-center">
            <div class="font-medium text-gray-900 text-sm">matplotlib</div>
            <div class="text-xs text-gray-600">Visualization</div>
          </div>
          <div class="p-3 bg-gray-50 rounded-xl text-center">
            <div class="font-medium text-gray-900 text-sm">seaborn</div>
            <div class="text-xs text-gray-600">Statistical Plots</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Usage Instructions -->
    <div class="bg-white rounded-xl shadow-sm p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Getting Started with Jupyter Research</h3>
      
      <div class="prose max-w-none">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="text-center">
            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span class="text-xl font-bold text-blue-600">1</span>
            </div>
            <h4 class="font-medium text-gray-900 mb-2">Choose Template</h4>
            <p class="text-sm text-gray-600">Select a pre-configured notebook template that matches your research goals</p>
          </div>
          
          <div class="text-center">
            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span class="text-xl font-bold text-blue-600">2</span>
            </div>
            <h4 class="font-medium text-gray-900 mb-2">Start JupyterLab</h4>
            <p class="text-sm text-gray-600">Launch the JupyterLab server to access the full interactive environment</p>
          </div>
          
          <div class="text-center">
            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span class="text-xl font-bold text-blue-600">3</span>
            </div>
            <h4 class="font-medium text-gray-900 mb-2">Analyze & Export</h4>
            <p class="text-sm text-gray-600">Run analysis, create visualizations, and export results for sharing</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Footer -->
<footer class="bg-gray-50 border-t border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex flex-col sm:flex-row justify-between items-center">
      <!-- Brand -->
      <div class="flex items-center mb-4 sm:mb-0">
        <div class="h-6 w-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mr-2">
          <span class="text-white font-bold text-sm">SE</span>
        </div>
        <span class="text-sm text-gray-600">Social Explorer - Research Investigation</span>
      </div>
      
      <!-- Links -->
      <div class="flex items-center space-x-6 text-sm text-gray-600">
        <a href="/text-analytics" class="hover:text-gray-900 transition-colors">Back to Text Analytics</a>
        <a href="/help" class="hover:text-gray-900 transition-colors">Help</a>
        <span class="text-gray-300">|</span>
        <a href="https://concepttocloud.com/" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 font-medium transition-colors">
          Concept to Cloud
        </a>
      </div>
    </div>
  </div>
</footer>