<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  import { trigramsDb, type TrigramData, type TrigramFilters, type TrigramStats } from '$lib/services/trigramsDb';
  
  // Trigrams analysis data
  let loading = true;
  let trigramsData: TrigramData[] = [];
  let trigramStats: TrigramStats = {
    totalTrigrams: 0,
    uniqueTrigrams: 0,
    averageFrequency: 0,
    topCategories: [],
    sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
    trendDistribution: { up: 0, stable: 0, down: 0 }
  };
  let selectedPlatform = 'all';
  let selectedTimeRange = '7d';
  let minFrequency = 5;
  let showChart = 'frequency';
  let searchQuery = '';
  
  // Filtering
  let filteredTrigrams: TrigramData[] = [];
  
  onMount(async () => {
    await loadTrigramsData();
  });

  async function loadTrigramsData() {
    try {
      loading = true;
      
      const filters: TrigramFilters = {
        platform: selectedPlatform,
        timeRange: selectedTimeRange,
        minFrequency,
        maxResults: 100,
        searchQuery
      };
      
      // Load trigrams data and stats from database
      const [data, stats] = await Promise.all([
        trigramsDb.getTrigramsData(filters),
        trigramsDb.getTrigramStats(filters)
      ]);
      
      trigramsData = data;
      trigramStats = stats;
      filteredTrigrams = data;
      
      console.log('Trigrams data loaded successfully from database');
    } catch (error) {
      console.error('Error loading trigrams data:', error);
    } finally {
      loading = false;
    }
  }

  function applyFilters() {
    filteredTrigrams = trigramsData.filter(trigram => {
      const matchesSearch = searchQuery === '' || 
        trigram.trigram.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFreq = trigram.frequency >= minFrequency;
      const matchesPlatform = selectedPlatform === 'all' || 
        trigram.platforms.includes(selectedPlatform);
      
      return matchesSearch && matchesFreq && matchesPlatform;
    });
  }

  function getSentimentColor(sentiment: number) {
    if (sentiment > 0.3) return 'text-green-600';
    if (sentiment < -0.3) return 'text-red-600';
    return 'text-yellow-600';
  }

  function getSentimentLabel(sentiment: number) {
    if (sentiment > 0.3) return 'Positive';
    if (sentiment < -0.3) return 'Negative';
    return 'Neutral';
  }

  function getTrendIcon(trend: string) {
    const icons = {
      'up': 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
      'down': 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
      'stable': 'M20 12H4'
    };
    return icons[trend] || icons.stable;
  }

  function getTrendColor(trend: string) {
    const colors = {
      'up': 'text-green-600',
      'down': 'text-red-600',
      'stable': 'text-gray-500'
    };
    return colors[trend] || colors.stable;
  }

  async function exportTrigrams() {
    try {
      const filters: TrigramFilters = {
        platform: selectedPlatform,
        timeRange: selectedTimeRange,
        minFrequency,
        searchQuery
      };
      
      const csvContent = await trigramsDb.exportTrigramsData(filters);
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trigrams_analysis_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting trigrams data:', error);
    }
  }

  // Reactive filtering
  $: {
    if (trigramsData.length > 0) {
      applyFilters();
    }
  }
</script>

<svelte:head>
  <title>Trigrams Analysis - Social Explorer</title>
  <meta name="description" content="N-gram analysis for discovering phrase patterns and linguistic trends in social media content" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-slate-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Trigrams Analysis</h1>
            <p class="text-slate-300 text-lg font-medium">Discover three-word phrase patterns and linguistic trends in your content</p>
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
        
        <!-- Quick Stats -->
        <div class="hidden lg:flex items-center space-x-6">
          <div class="text-center">
            <div class="text-3xl font-bold text-white">{trigramStats.totalTrigrams.toLocaleString()}</div>
            <div class="text-purple-200 text-sm font-medium">Total Trigrams</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-white">{trigramStats.uniqueTrigrams}</div>
            <div class="text-purple-200 text-sm font-medium">Unique Patterns</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Controls Section -->
  <div class="bg-white border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <!-- Filters -->
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700">Platform:</label>
            <select bind:value={selectedPlatform} class="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="all">All Platforms</option>
              <option value="twitter">Twitter</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
          
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700">Time Range:</label>
            <select bind:value={selectedTimeRange} class="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="1d">Last Day</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
          
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700">Min Frequency:</label>
            <input type="number" bind:value={minFrequency} min="1" max="1000" 
                   class="border border-gray-300 rounded-md px-3 py-1 w-20 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
          </div>
          
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700">Search:</label>
            <input type="text" bind:value={searchQuery} placeholder="Search trigrams..."
                   class="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center space-x-3">
          <select bind:value={showChart} class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="frequency">Frequency Chart</option>
            <option value="sentiment">Sentiment Chart</option>
            <option value="trend">Trend Chart</option>
          </select>
          
          <button on:click={exportTrigrams}
                  class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <!-- Trigrams List -->
      <div class="lg:col-span-3">
        <div class="bg-white rounded-xl shadow-lg">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold text-gray-900">Top Trigrams</h2>
              <span class="text-sm text-gray-500">{filteredTrigrams.length} results</span>
            </div>
          </div>
          
          <div class="divide-y divide-gray-200">
            {#if loading}
              {#each Array(10) as _, i}
                <div class="p-6">
                  <div class="animate-pulse">
                    <div class="h-6 bg-gray-300 rounded mb-2"></div>
                    <div class="flex items-center space-x-4">
                      <div class="h-4 bg-gray-300 rounded w-20"></div>
                      <div class="h-4 bg-gray-300 rounded w-16"></div>
                      <div class="h-4 bg-gray-300 rounded w-24"></div>
                    </div>
                  </div>
                </div>
              {/each}
            {:else}
              {#each filteredTrigrams as trigram, i}
                <div class="p-6 hover:bg-gray-50 transition-colors">
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-3">
                      <span class="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full">#{i + 1}</span>
                      <h3 class="text-lg font-semibold text-gray-900">"{trigram.trigram}"</h3>
                    </div>
                    <div class="flex items-center space-x-2">
                      <svg class="w-4 h-4 {getTrendColor(trigram.trend)}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{getTrendIcon(trigram.trend)}"></path>
                      </svg>
                      <span class="text-sm text-gray-500 capitalize">{trigram.trend}</span>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span class="text-sm text-gray-500">Frequency</span>
                      <div class="text-xl font-bold text-purple-600">{trigram.frequency.toLocaleString()}</div>
                    </div>
                    <div>
                      <span class="text-sm text-gray-500">Sentiment</span>
                      <div class="text-sm font-medium {getSentimentColor(trigram.sentiment)}">
                        {getSentimentLabel(trigram.sentiment)} ({trigram.sentiment > 0 ? '+' : ''}{trigram.sentiment.toFixed(2)})
                      </div>
                    </div>
                    <div>
                      <span class="text-sm text-gray-500">Platforms</span>
                      <div class="flex flex-wrap gap-1 mt-1">
                        {#each trigram.platforms as platform}
                          <span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full capitalize">{platform}</span>
                        {/each}
                      </div>
                    </div>
                    <div>
                      <span class="text-sm text-gray-500">Share</span>
                      <div class="text-sm font-medium text-gray-700">
                        {trigramStats.totalTrigrams > 0 ? ((trigram.frequency / trigramStats.totalTrigrams) * 100).toFixed(1) : '0.0'}%
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <!-- Sidebar Stats -->
      <div class="space-y-6">
        <!-- Overview Card -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Analysis Overview</h3>
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">Total Trigrams</span>
              <span class="font-semibold text-gray-900">{trigramStats.totalTrigrams.toLocaleString()}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">Unique Patterns</span>
              <span class="font-semibold text-gray-900">{trigramStats.uniqueTrigrams}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">Avg Frequency</span>
              <span class="font-semibold text-gray-900">{trigramStats.averageFrequency}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">Filtered Results</span>
              <span class="font-semibold text-purple-600">{filteredTrigrams.length}</span>
            </div>
          </div>
        </div>

        <!-- Top Categories -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Trending Topics</h3>
          <div class="space-y-3">
            {#each trigramStats.topCategories as category}
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-700">{category.category}</span>
                <span class="text-sm font-medium text-purple-600">{category.percentage}%</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Pattern Insights -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Pattern Insights</h3>
          <div class="space-y-4">
            <div class="bg-green-50 border border-green-200 rounded-lg p-3">
              <div class="flex items-center mb-2">
                <svg class="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                </svg>
                <span class="text-sm font-medium text-green-800">Most Positive</span>
              </div>
              <p class="text-sm text-green-700">"sustainable energy solutions"</p>
              <p class="text-xs text-green-600 mt-1">+0.78 sentiment score</p>
            </div>
            
            <div class="bg-red-50 border border-red-200 rounded-lg p-3">
              <div class="flex items-center mb-2">
                <svg class="w-4 h-4 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path>
                </svg>
                <span class="text-sm font-medium text-red-800">Most Critical</span>
              </div>
              <p class="text-sm text-red-700">"data privacy concerns"</p>
              <p class="text-xs text-red-600 mt-1">-0.34 sentiment score</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>