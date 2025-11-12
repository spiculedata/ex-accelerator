<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import { languageDetectionDb } from '$lib/services/languageDetectionDb';
  import { onMount } from 'svelte';
  
  // Loading state
  let loading = true;
  
  // Redirect to projects if no current project
  onMount(async () => {
    if (!$currentProject) {
      window.location.href = '/projects';
      return;
    }
    
    // Load language detection data from database
    await loadLanguageDetectionData();
  });

  // Language detection data - loaded from database
  let languageStats: any[] = [];
  let languageAnalysis: any[] = [];
  let detectionStats = {};
  let samplePosts: any[] = [];
  let mixingData: any[] = [];
  let geographicData: any[] = [];
  
  // Load language detection data from database service
  async function loadLanguageDetectionData() {
    try {
      // Load all language data from database service
      languageStats = await languageDetectionDb.getLanguageStats();
      languageAnalysis = await languageDetectionDb.getLanguageAnalysis();
      detectionStats = await languageDetectionDb.getLanguageDetectionStats();
      
      // Load posts with current filters
      await loadFilteredPosts();
      
      // Load additional data
      mixingData = await languageDetectionDb.getLanguageMixing();
      geographicData = await languageDetectionDb.getGeographicDistribution();
      
      console.log('Language detection data loaded successfully from database');
      loading = false;
    } catch (error) {
      console.error('Error loading language detection data:', error);
      // Fallback to sample data if database fails
      loadFallbackData();
    }
  }
  
  // Load filtered posts from database
  async function loadFilteredPosts() {
    try {
      const filters = {
        language: selectedLanguage,
        platform: selectedPlatform,
        confidenceThreshold: confidenceThreshold,
        timeRange: timeRange
      };
      samplePosts = await languageDetectionDb.getSamplePosts(filters);
    } catch (error) {
      console.error('Error loading filtered posts:', error);
    }
  }
  
  // Fallback sample data if database connection fails
  function loadFallbackData() {
    languageStats = [
      { code: 'en', name: 'English', count: 45230, percentage: 67.2, confidence: 0.95 },
      { code: 'es', name: 'Spanish', count: 8945, percentage: 13.3, confidence: 0.92 },
      { code: 'fr', name: 'French', count: 4521, percentage: 6.7, confidence: 0.89 },
      { code: 'de', name: 'German', count: 3210, percentage: 4.8, confidence: 0.91 },
      { code: 'pt', name: 'Portuguese', count: 2134, percentage: 3.2, confidence: 0.88 },
      { code: 'it', name: 'Italian', count: 1567, percentage: 2.3, confidence: 0.90 },
      { code: 'ja', name: 'Japanese', count: 987, percentage: 1.5, confidence: 0.87 },
      { code: 'ko', name: 'Korean', count: 678, percentage: 1.0, confidence: 0.85 }
    ];
    
    detectionStats = {
      totalPosts: languageStats.reduce((sum, lang) => sum + lang.count, 0),
      totalLanguages: languageStats.length,
      avgConfidence: 0.90,
      topLanguage: languageStats[0]
    };
    
    loading = false;
  }

  let selectedLanguage = 'all';
  let selectedPlatform = 'all';
  let confidenceThreshold = 0.5;
  let timeRange = '7d';

  // Reactive statements for filter changes
  $: if ((selectedLanguage !== 'all' || selectedPlatform !== 'all' || confidenceThreshold !== 0.5 || timeRange !== '7d') && !loading) {
    loadFilteredPosts();
  }

  // Filtered posts and stats (for display purposes, actual filtering happens in database)
  $: filteredPosts = samplePosts;
  $: totalPosts = detectionStats.totalPosts || languageStats.reduce((sum, lang) => sum + lang.count, 0);

  function getLanguageName(code: string) {
    const lang = languageStats.find(l => l.code === code);
    return lang ? lang.name : code.toUpperCase();
  }

  function getConfidenceColor(confidence: number) {
    if (confidence >= 0.9) return 'bg-amber-100 text-amber-800';
    if (confidence >= 0.8) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  }

  function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleString();
  }

  async function exportLanguageData() {
    try {
      const filters = {
        language: selectedLanguage,
        platform: selectedPlatform,
        confidenceThreshold: confidenceThreshold,
        timeRange: timeRange
      };
      
      const exportData = await languageDetectionDb.exportLanguageData(filters);
      
      // Create CSV from the exported data
      const csvData = exportData.languages.map(lang => 
        `"${lang.name}",${lang.code},${lang.count},${lang.percentage}%,${lang.confidence}`
      ).join('\n');
      
      const header = 'Language,Code,Count,Percentage,Avg Confidence\n';
      const csv = header + csvData;
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'language_detection_report.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting language data:', error);
      // Fallback to current data
      const csvData = languageStats.map(lang => 
        `"${lang.name}",${lang.code},${lang.count},${lang.percentage}%,${lang.confidence}`
      ).join('\n');
      
      const header = 'Language,Code,Count,Percentage,Avg Confidence\n';
      const csv = header + csvData;
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'language_detection_report.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    }
  }

  // Filtered stats for display
  $: filteredStats = selectedLanguage === 'all' 
    ? languageStats 
    : languageStats.filter(lang => lang.code === selectedLanguage);
</script>

<svelte:head>
  <title>Language Detection - Text Analytics - Social Explorer</title>
  <meta name="description" content="Language detection and analysis for social media content" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-amber-900 to-slate-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-amber-900/10 to-slate-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <button 
            on:click={() => window.location.href='/text-analytics'}
            class="mr-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors backdrop-blur-sm">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div class="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Language Detection</h1>
            <p class="text-slate-300 text-lg font-medium">Analyze language distribution and detection confidence in your social media data</p>
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
        
        <div class="flex items-center space-x-3">
          <button 
            on:click={exportLanguageData}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Export Report
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading language detection data from database...</span>
      </div>
    {:else}
    
    <!-- Overview Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-amber-600 mb-1">{detectionStats.totalPosts ? detectionStats.totalPosts.toLocaleString() : totalPosts.toLocaleString()}</div>
        <div class="text-sm text-gray-600">Total Posts Analyzed</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-amber-600 mb-1">{detectionStats.totalLanguages || languageStats.length}</div>
        <div class="text-sm text-gray-600">Languages Detected</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-amber-600 mb-1">{Math.round((detectionStats.avgConfidence || 0.90) * 100)}%</div>
        <div class="text-sm text-gray-600">Avg Confidence</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-amber-600 mb-1">{detectionStats.topLanguage?.name || languageStats[0]?.name || 'English'}</div>
        <div class="text-sm text-gray-600">Top Language</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Filters & Analysis Options</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Language</label>
          <select bind:value={selectedLanguage} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Languages</option>
            {#each languageStats as lang}
              <option value={lang.code}>{lang.name} ({lang.count.toLocaleString()})</option>
            {/each}
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Platform</label>
          <select bind:value={selectedPlatform} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="all">All Platforms</option>
            <option value="twitter">Twitter</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="reddit">Reddit</option>
            <option value="linkedin">LinkedIn</option>
            <option value="telegram">Telegram</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Min Confidence: {confidenceThreshold}</label>
          <input 
            type="range" 
            bind:value={confidenceThreshold}
            min="0.5" 
            max="1" 
            step="0.05"
            class="w-full h-2 bg-gray-200 rounded-xl appearance-none cursor-pointer">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
          <select bind:value={timeRange} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      <!-- Language Distribution -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-900">Language Distribution</h2>
          <span class="text-sm text-gray-500">{filteredStats.length} languages</span>
        </div>
        
        <div class="space-y-4">
          {#each filteredStats as lang}
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-3">
                  <span class="text-white font-bold text-xs">{lang.code.toUpperCase()}</span>
                </div>
                <div>
                  <div class="font-medium text-gray-900">{lang.name}</div>
                  <div class="text-sm text-gray-500">{lang.count.toLocaleString()} posts</div>
                </div>
              </div>
              
              <div class="flex items-center space-x-3">
                <div class="text-right">
                  <div class="font-semibold text-gray-900">{lang.percentage}%</div>
                  <div class="text-xs text-gray-500">Confidence: {(lang.confidence * 100).toFixed(1)}%</div>
                </div>
                <div class="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style="width: {lang.percentage}%"></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Detection Quality -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Detection Quality Analysis</h2>
        
        <div class="space-y-6">
          <!-- Confidence Distribution -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 mb-3">Confidence Distribution</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">High (90-100%)</span>
                <div class="flex items-center">
                  <div class="w-32 bg-gray-200 rounded-full h-2 mr-2">
                    <div class="bg-blue-600 h-2 rounded-full" style="width: 72%"></div>
                  </div>
                  <span class="text-sm font-medium">72%</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">Medium (80-90%)</span>
                <div class="flex items-center">
                  <div class="w-32 bg-gray-200 rounded-full h-2 mr-2">
                    <div class="bg-yellow-600 h-2 rounded-full" style="width: 23%"></div>
                  </div>
                  <span class="text-sm font-medium">23%</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">Low (50-80%)</span>
                <div class="flex items-center">
                  <div class="w-32 bg-gray-200 rounded-full h-2 mr-2">
                    <div class="bg-red-600 h-2 rounded-full" style="width: 5%"></div>
                  </div>
                  <span class="text-sm font-medium">5%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Language Complexity -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 mb-3">Detection Challenges</h3>
            <div class="space-y-3">
              <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <div class="flex items-center">
                  <svg class="w-4 h-4 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-21 12a9 9 0 1118 0 9 9 0 01-18 0z"></path>
                  </svg>
                  <span class="text-sm text-yellow-800">Mixed language posts: 3.2%</span>
                </div>
              </div>
              <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div class="flex items-center">
                  <svg class="w-4 h-4 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span class="text-sm text-amber-800">Short text (&lt;20 chars): 8.7%</span>
                </div>
              </div>
              <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div class="flex items-center">
                  <svg class="w-4 h-4 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span class="text-sm text-amber-800">High quality detections: 88.1%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sample Posts -->
    <div class="mt-8 bg-white rounded-xl shadow-sm p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Sample Posts</h2>
        <span class="text-sm text-gray-500">{filteredPosts.length} posts shown</span>
      </div>
      
      <div class="space-y-4">
        {#each filteredPosts as post}
          <div class="border border-gray-200 rounded-xl p-4">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center space-x-3">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {post.platform}
                </span>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  {getLanguageName(post.language)}
                </span>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getConfidenceColor(post.confidence)}">
                  {(post.confidence * 100).toFixed(1)}% confidence
                </span>
              </div>
              <span class="text-xs text-gray-500">{formatTimestamp(post.timestamp)}</span>
            </div>
            
            <p class="text-gray-900 mb-2">{post.text}</p>
            
            <div class="text-xs text-gray-500">
              Post ID: {post.id} • Language: {post.language} • Detection confidence: {post.confidence}
            </div>
          </div>
        {/each}
      </div>
    </div>
    
    {/if}
  </div>
</div>