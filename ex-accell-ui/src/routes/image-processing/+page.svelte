<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
</script>

<svelte:head>
  <title>Image Processing - Social Explorer</title>
  <meta name="description" content="Computer vision and image analysis tools for social media content" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-indigo-900/10 to-slate-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-16 h-16 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Image Processing Suite</h1>
            <p class="text-slate-300 text-lg font-medium">Computer Vision • Content Analysis • Visual Intelligence</p>
            <div class="flex items-center mt-3 space-x-4">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                🖼️ Visual Analysis
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                🤖 AI-Powered
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                ⚡ Real-time Processing
              </span>
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          <button 
            class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center border border-white/20">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            API Settings
          </button>
          <button 
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            Get Started
          </button>
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
          <h3 class="text-lg font-medium text-blue-900">Computer Vision Suite In Development</h3>
          <p class="text-blue-700 mt-1">Our image processing capabilities are being built to handle visual content analysis at scale.</p>
        </div>
      </div>
    </div>

    <!-- Processing Tools Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
      <!-- Object Detection -->
      <div class="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
        <div class="flex items-center mb-4">
          <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Object Detection</h3>
        </div>
        <p class="text-gray-600 mb-4">Identify and locate objects, people, and scenes within social media images.</p>
        <div class="bg-gray-100 rounded-xl h-32 flex items-center justify-center mb-4">
          <span class="text-gray-500">Detection Preview</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Person</span>
          <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Car</span>
          <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Building</span>
        </div>
      </div>

      <!-- Face Recognition -->
      <div class="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
        <div class="flex items-center mb-4">
          <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Face Recognition</h3>
        </div>
        <p class="text-gray-600 mb-4">Detect, analyze, and recognize faces in images with privacy-first processing.</p>
        <div class="space-y-2 mb-4">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Detection Accuracy</span>
            <span class="text-blue-600 font-medium">98.5%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full" style="width: 98.5%"></div>
          </div>
        </div>
        <div class="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          Privacy-compliant processing with opt-out options
        </div>
      </div>

      <!-- Content Moderation -->
      <div class="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
        <div class="flex items-center mb-4">
          <div class="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mr-3">
            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Content Moderation</h3>
        </div>
        <p class="text-gray-600 mb-4">Automatically flag inappropriate, harmful, or policy-violating visual content.</p>
        <div class="grid grid-cols-2 gap-2 mb-4">
          <div>
            <div class="text-sm text-gray-500">Safe Content</div>
            <div class="text-lg font-semibold text-blue-600">94%</div>
          </div>
          <div>
            <div class="text-sm text-gray-500">Flagged</div>
            <div class="text-lg font-semibold text-red-600">6%</div>
          </div>
        </div>
        <div class="flex gap-1">
          <div class="flex-1 bg-blue-200 h-2 rounded-l"></div>
          <div class="w-1/6 bg-red-200 h-2 rounded-r"></div>
        </div>
      </div>

      <!-- OCR & Text Extraction -->
      <div class="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
        <div class="flex items-center mb-4">
          <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">OCR & Text Extraction</h3>
        </div>
        <p class="text-gray-600 mb-4">Extract and process text from images, memes, and screenshots with high accuracy.</p>
        <div class="bg-gray-100 rounded-xl p-3 mb-4 font-mono text-sm">
          <div class="text-gray-600">"Extracted text appears here..."</div>
        </div>
        <div class="text-center">
          <span class="text-lg font-bold text-blue-600">25+</span>
          <p class="text-gray-500 text-sm">Languages Supported</p>
        </div>
      </div>

      <!-- Image Classification -->
      <div class="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
        <div class="flex items-center mb-4">
          <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Image Classification</h3>
        </div>
        <p class="text-gray-600 mb-4">Categorize images by content type, style, and context using deep learning models.</p>
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">Nature</span>
            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">45%</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">Urban</span>
            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">35%</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">People</span>
            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">20%</span>
          </div>
        </div>
      </div>

      <!-- Brand Recognition -->
      <div class="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500">
        <div class="flex items-center mb-4">
          <div class="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mr-3">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Brand Recognition</h3>
        </div>
        <p class="text-gray-600 mb-4">Identify logos, brand mentions, and product placements in social media visuals.</p>
        <div class="grid grid-cols-3 gap-2 mb-4">
          <div class="bg-gray-100 rounded h-8 flex items-center justify-center">
            <span class="text-xs text-gray-500">Logo 1</span>
          </div>
          <div class="bg-gray-100 rounded h-8 flex items-center justify-center">
            <span class="text-xs text-gray-500">Logo 2</span>
          </div>
          <div class="bg-gray-100 rounded h-8 flex items-center justify-center">
            <span class="text-xs text-gray-500">Logo 3</span>
          </div>
        </div>
        <div class="text-center">
          <span class="text-lg font-bold text-indigo-600">10K+</span>
          <p class="text-gray-500 text-sm">Brands Tracked</p>
        </div>
      </div>
    </div>

    <!-- Processing Pipeline -->
    <div class="bg-white rounded-xl shadow-md p-8 mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Image Processing Pipeline</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="text-center">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h3 class="font-semibold text-gray-900 mb-2">Image Ingestion</h3>
          <p class="text-gray-600 text-sm">Collect and preprocess images from social media platforms</p>
        </div>
        
        <div class="text-center">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
          </div>
          <h3 class="font-semibold text-gray-900 mb-2">AI Analysis</h3>
          <p class="text-gray-600 text-sm">Apply computer vision algorithms for content analysis</p>
        </div>
        
        <div class="text-center">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
          <h3 class="font-semibold text-gray-900 mb-2">Data Enrichment</h3>
          <p class="text-gray-600 text-sm">Extract metadata and generate actionable insights</p>
        </div>
        
        <div class="text-center">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h3 class="font-semibold text-gray-900 mb-2">Results & Export</h3>
          <p class="text-gray-600 text-sm">Deliver processed data via API or dashboard interface</p>
        </div>
      </div>
    </div>

    <!-- Performance Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="bg-white rounded-xl shadow-md p-6 text-center">
        <div class="text-3xl font-bold text-blue-600 mb-2">1M+</div>
        <div class="text-gray-600">Images Processed Daily</div>
      </div>
      
      <div class="bg-white rounded-xl shadow-md p-6 text-center">
        <div class="text-3xl font-bold text-blue-600 mb-2">95%</div>
        <div class="text-gray-600">Average Accuracy</div>
      </div>
      
      <div class="bg-white rounded-xl shadow-md p-6 text-center">
        <div class="text-3xl font-bold text-blue-600 mb-2">&lt;2s</div>
        <div class="text-gray-600">Processing Time</div>
      </div>
    </div>
  </div>
</div>