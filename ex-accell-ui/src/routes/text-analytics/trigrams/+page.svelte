<script lang="ts">
  import { page } from '$app/stores';
  import PostDrilldown from '$lib/components/ui/PostDrilldown.svelte';
  import { filtersFromParams, type PostFilters } from '$lib/services/postsApi';
  import { currentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { summarizeTrigrams, trigramsDb, type TrigramData, type TrigramFilters, type TrigramStats } from '$lib/services/trigramsDb';
  import { getTrendColor } from '$lib/utils/colorUtils';
  import ErrorAlert from '$lib/components/ui/ErrorAlert.svelte';
  import { platformOptions } from '$lib/utils/platformOptions';
  import FilterBar from '$lib/components/ui/FilterBar.svelte';
  import { currentRangeQuery } from '$lib/utils/filterRange';

  // The phrase the visitor chose; its posts open in the side panel
  let drilldown: { title: string; filters: PostFilters } | null = null;

  $: workspaceId = $page.url.searchParams.get('workspace');
  
  let errorMessage = '';
  let truncated = false;

  // Trigrams analysis data
  let loading = true;
  let trigramsData: TrigramData[] = [];
  // Only platforms that appear in the data are offered
  $: platformChoices = platformOptions(trigramsData.flatMap((t) => t.platforms ?? []));
  let trigramStats: TrigramStats = {
    totalTrigrams: 0,
    uniqueTrigrams: 0,
    averageFrequency: 0,
    sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
    trendDistribution: { up: 0, stable: 0, down: 0 }
  };
  let selectedPlatform = 'all';
  // Phrases are counted over the last 7 days unless the date bar sets a range
  const DEFAULT_TIME_RANGE = '7d';
  let hasRange = false;
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
        timeRange: DEFAULT_TIME_RANGE,
        minFrequency,
        maxResults: 100,
        searchQuery
      };
      
      errorMessage = '';
      const { data, truncated: wasTruncated } = await trigramsDb.getTrigramsResult(filters, workspaceId || undefined);
      truncated = wasTruncated;

      trigramsData = data;
      trigramStats = summarizeTrigrams(data);
      filteredTrigrams = data;
    } catch (error) {
      console.error('Error loading trigrams data:', error);
      trigramsData = [];
      filteredTrigrams = [];
      trigramStats = summarizeTrigrams([]);
      errorMessage = 'Failed to load trigrams data. Please try again.';
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

  // Highlights computed from the phrases currently shown
  $: risingTrigrams = filteredTrigrams.filter((t) => t.trend === 'up').slice(0, 5);
  $: mostPositive = filteredTrigrams.reduce<TrigramData | null>((best, t) => (t.sentiment > (best?.sentiment ?? 0) ? t : best), null);
  $: mostCritical = filteredTrigrams.reduce<TrigramData | null>((worst, t) => (t.sentiment < (worst?.sentiment ?? 0) ? t : worst), null);
  const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

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
    const icons: Record<string, string> = {
      'up': 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
      'down': 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
      'stable': 'M20 12H4'
    };
    return icons[trend] || icons.stable;
  }


  async function exportTrigrams() {
    try {
      const filters: TrigramFilters = {
        platform: selectedPlatform,
        timeRange: DEFAULT_TIME_RANGE,
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
      errorMessage = 'Failed to export trigrams data. Please try again.';
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

<div class="min-h-screen bg-gray-50">
  <PageHeader
    title="Trigram Analysis"
    subtitle="Discover three-word phrase patterns and linguistic trends in your content"
    accentColor="purple">
    <svelte:fragment slot="icon">
      <div class="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="actions">
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
    </svelte:fragment>
  </PageHeader>

  <!-- Dates: the same bar as the other analysis pages; with no dates set the last 7 days are analysed -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
    <FilterBar datesOnly compact on:change={() => { hasRange = Object.keys(currentRangeQuery()).length > 0; if (!loading) loadTrigramsData(); }} />
    {#if !hasRange}
      <p class="mt-2 text-xs text-ink-600">Showing the last 7 days. Pick dates above to analyse a different period.</p>
    {/if}
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
              {#each platformChoices as choice}
                <option value={choice.value}>{choice.label}</option>
              {/each}
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
    {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}
    {#if truncated}
      <p class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        This period has more posts than can be analysed at once, so only the most recent ones are included. Choose a shorter time range for complete results.
      </p>
    {/if}
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
                      <h3 class="text-lg font-semibold text-gray-900"><button type="button" class="text-left hover:text-primary-700 hover:underline" on:click={() => (drilldown = { title: `Phrase: “${trigram.trigram}”`, filters: { q: trigram.trigram, ...(workspaceId ? { workspaceId } : {}) } })}>"{trigram.trigram}"</button></h3>
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

        <!-- Rising phrases -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Rising Phrases</h3>
          <div class="space-y-3">
            {#each risingTrigrams as rising}
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-700">{rising.trigram}</span>
                <span class="text-sm font-medium text-purple-600">{rising.frequency}</span>
              </div>
            {:else}
              <p class="text-sm text-gray-500">No rising phrases in this period.</p>
            {/each}
          </div>
        </div>

        <!-- Pattern Insights -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Pattern Insights</h3>
          <div class="space-y-4">
            {#if mostPositive}
              <div class="bg-sentiment-positive/10 border border-sentiment-positive/40 rounded-lg p-3">
                <span class="text-sm font-medium text-ink-900">Most positive</span>
                <p class="text-sm text-ink-700">"{mostPositive.trigram}"</p>
                <p class="text-xs text-ink-600 mt-1">{signed(mostPositive.sentiment)} sentiment score</p>
              </div>
            {/if}
            {#if mostCritical}
              <div class="bg-sentiment-negative/10 border border-sentiment-negative/40 rounded-lg p-3">
                <span class="text-sm font-medium text-ink-900">Most critical</span>
                <p class="text-sm text-ink-700">"{mostCritical.trigram}"</p>
                <p class="text-xs text-ink-600 mt-1">{signed(mostCritical.sentiment)} sentiment score</p>
              </div>
            {/if}
            {#if !mostPositive && !mostCritical}
              <p class="text-sm text-gray-500">No clearly positive or negative phrases in this period.</p>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<PostDrilldown open={drilldown !== null} title={drilldown?.title ?? ''} filters={drilldown?.filters ?? {}} note="Posts containing this text. The counts on this page ignore punctuation and case, so they can differ." onclose={() => (drilldown = null)} />
