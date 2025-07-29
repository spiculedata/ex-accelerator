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
</script>

<svelte:head>
  <title>Text Analytics - Social Explorer</title>
  <meta name="description" content="Advanced NLP and text analysis tools for social media content" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-slate-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center">
        <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <div>
          <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Text Analytics Apps</h1>
          <p class="text-slate-300 text-lg font-medium">Advanced NLP processing for sentiment analysis, topic modeling, and content insights</p>
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
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <!-- Coming Soon Notice -->
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-lg font-medium text-blue-900">Text Analytics Tools In Development</h3>
          <p class="text-blue-700 mt-1">Our NLP processing suite is being built to handle multilingual content analysis at scale.</p>
        </div>
      </div>
    </div>

    <!-- Analytics Apps Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
      <!-- Sentiment Analysis -->
      <div 
        class="bg-white rounded-xl shadow-md hover:shadow-lg p-6 border-l-4 border-blue-500 cursor-pointer transition-all duration-200"
        on:click={() => window.location.href='/text-analytics/sentiment-analysis'}>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900">Sentiment Analysis</h3>
          </div>
          <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Available</span>
        </div>
        <p class="text-gray-600 mb-4">Analyze emotional tone and sentiment across social media posts with AI-powered classification.</p>
        <div class="flex items-center justify-between">
          <div class="space-y-2 flex-1">
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Positive</span>
              <span class="text-blue-600 font-medium">68%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="bg-blue-600 h-2 rounded-full" style="width: 68%"></div>
            </div>
          </div>
          <svg class="w-5 h-5 text-gray-400 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </div>
      </div>

      <!-- Topic Modeling -->
      <div 
        class="bg-white rounded-xl shadow-md hover:shadow-lg p-6 border-l-4 border-blue-500 cursor-pointer transition-all duration-200"
        on:click={() => window.location.href='/text-analytics/topic-modeling'}>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900">Topic Modeling</h3>
          </div>
          <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Available</span>
        </div>
        <p class="text-gray-600 mb-4">Discover hidden themes and topics in large collections of social media content.</p>
        <div class="flex items-center justify-between">
          <div class="flex flex-wrap gap-2">
            <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Technology</span>
            <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Health</span>
            <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Politics</span>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </div>
      </div>

      <!-- Language Detection -->
      <div 
        class="bg-white rounded-xl shadow-md hover:shadow-lg p-6 border-l-4 border-blue-500 cursor-pointer transition-all duration-200"
        on:click={() => window.location.href='/text-analytics/language-detection'}>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900">Language Detection</h3>
          </div>
          <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Available</span>
        </div>
        <p class="text-gray-600 mb-4">Automatically identify and classify content by language with support for 25+ languages.</p>
        <div class="flex items-center justify-between">
          <div class="text-center">
            <span class="text-2xl font-bold text-blue-600">25+</span>
            <p class="text-gray-500 text-sm">Languages Supported</p>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </div>
      </div>

      <!-- Hashtag Analysis -->
      <div 
        class="bg-white rounded-xl shadow-md hover:shadow-lg p-6 border-l-4 border-pink-500 cursor-pointer transition-all duration-200"
        on:click={() => window.location.href='/text-analytics/hashtag-analysis'}>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center mr-3">
              <svg class="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900">Hashtag Analysis</h3>
          </div>
          <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Available</span>
        </div>
        <p class="text-gray-600 mb-4">Analyze trending hashtags, their reach, and impact across social media platforms.</p>
        <div class="flex items-center justify-between">
          <div class="flex flex-wrap gap-2">
            <span class="px-2 py-1 bg-pink-100 text-pink-800 text-xs rounded-full">#trending</span>
            <span class="px-2 py-1 bg-pink-100 text-pink-800 text-xs rounded-full">#viral</span>
            <span class="px-2 py-1 bg-pink-100 text-pink-800 text-xs rounded-full">#popular</span>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </div>
      </div>

      <!-- Engagement Analysis -->
      <div 
        class="bg-white rounded-xl shadow-md hover:shadow-lg p-6 border-l-4 border-cyan-500 cursor-pointer transition-all duration-200"
        on:click={() => window.location.href='/text-analytics/engagement-analysis'}>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center mr-3">
              <svg class="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900">Engagement Analysis</h3>
          </div>
          <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Available</span>
        </div>
        <p class="text-gray-600 mb-4">Track likes, shares, comments, and engagement rates across all your social media content.</p>
        <div class="flex items-center justify-between">
          <div class="text-center">
            <span class="text-2xl font-bold text-cyan-600">4.2%</span>
            <p class="text-gray-500 text-sm">Avg Engagement Rate</p>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </div>
      </div>

      <!-- Entity Recognition -->
      <div class="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
        <div class="flex items-center mb-4">
          <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Entity Recognition</h3>
        </div>
        <p class="text-gray-600 mb-4">Extract and classify named entities like people, organizations, and locations from text.</p>
        <div class="flex flex-wrap gap-2 mt-4">
          <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">@username</span>
          <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Company Inc.</span>
          <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">New York</span>
        </div>
      </div>

      <!-- Content Classification -->
      <div class="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
        <div class="flex items-center mb-4">
          <div class="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mr-3">
            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Content Classification</h3>
        </div>
        <p class="text-gray-600 mb-4">Automatically categorize content by type, safety, and relevance using machine learning.</p>
        <div class="grid grid-cols-2 gap-2 mt-4">
          <div class="text-center">
            <div class="text-lg font-semibold text-red-600">95%</div>
            <div class="text-xs text-gray-500">Accuracy</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-semibold text-red-600">1M+</div>
            <div class="text-xs text-gray-500">Posts/Day</div>
          </div>
        </div>
      </div>

      <!-- Readability Analysis -->
      <div class="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500">
        <div class="flex items-center mb-4">
          <div class="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mr-3">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Readability Analysis</h3>
        </div>
        <p class="text-gray-600 mb-4">Assess content complexity and readability using multiple linguistic metrics and scores.</p>
        <div class="mt-4">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-500">Flesch Score</span>
            <span class="text-indigo-600 font-medium">72 (Easy)</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-indigo-600 h-2 rounded-full" style="width: 72%"></div>
          </div>
        </div>
      </div>

      <!-- Jupyter Lab -->
      <div 
        class="bg-white rounded-xl shadow-md hover:shadow-lg p-6 border-l-4 border-blue-500 cursor-pointer transition-all duration-200"
        on:click={() => window.location.href='/text-analytics/jupyter'}>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900">Jupyter Lab</h3>
          </div>
          <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Interactive</span>
        </div>
        <p class="text-gray-600 mb-4">Full Python environment with pre-installed text analytics libraries for custom research and experimentation.</p>
        <div class="flex items-center justify-between">
          <div class="flex flex-wrap gap-2">
            <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">pandas</span>
            <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">scikit-learn</span>
            <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">nltk</span>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </div>
      </div>
    </div>

    <!-- Features Overview -->
    <div class="bg-white rounded-xl shadow-md p-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Advanced Text Processing Pipeline</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="text-center">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
            </svg>
          </div>
          <h3 class="font-semibold text-gray-900 mb-2">Data Ingestion</h3>
          <p class="text-gray-600 text-sm">Collect and preprocess text from multiple social media sources</p>
        </div>
        
        <div class="text-center">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
          </div>
          <h3 class="font-semibold text-gray-900 mb-2">NLP Processing</h3>
          <p class="text-gray-600 text-sm">Apply advanced natural language processing algorithms</p>
        </div>
        
        <div class="text-center">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
          <h3 class="font-semibold text-gray-900 mb-2">Analysis & Insights</h3>
          <p class="text-gray-600 text-sm">Generate actionable insights and analytics reports</p>
        </div>
        
        <div class="text-center">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h3 class="font-semibold text-gray-900 mb-2">Export & Integration</h3>
          <p class="text-gray-600 text-sm">Export results and integrate with external systems via API</p>
        </div>
      </div>
    </div>
  </div>
</div>