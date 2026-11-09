<script lang="ts">
  import { goto } from '$app/navigation';
  import FilterBar from '$lib/components/ui/FilterBar.svelte';
  import { page } from '$app/stores';
  import { currentProject } from '$lib/stores/projectStore';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import WorkspaceBanner from '$lib/components/ui/WorkspaceBanner.svelte';
  import { languageDetectionDb } from '$lib/services/languageDetectionDb';
  import { onMount } from 'svelte';
  import { getConfidenceColor } from '$lib/utils/colorUtils';
  import { ErrorAlert } from '$lib/components/ui';
  import { platformOptions } from '$lib/utils/platformOptions';
  import { currentRangeQuery } from '$lib/utils/filterRange';

  $: workspaceId = $page.url.searchParams.get('workspace');

  let currentFilterParams: Record<string, string> = {};

  function handleFilterChange(event: CustomEvent) {
    const detail = event.detail || {};
    currentFilterParams = {};
    if (detail.workspaceId) currentFilterParams.workspace_id = detail.workspaceId;
    currentFilterParams.platforms = (detail.platforms || []).join(',');
    if (detail.dateStart) currentFilterParams.date_start = detail.dateStart;
    if (detail.dateEnd) currentFilterParams.date_end = detail.dateEnd;
    // A new date range changes every figure on the page, so load them again
    const range = JSON.stringify(currentRangeQuery());
    if (!loading && range !== loadedRange) {
      loadedRange = range;
      loadLanguageDetectionData();
    }
  }
  let loadedRange = JSON.stringify(currentRangeQuery());
  
  // Loading state
  let loading = true;
  let errorMessage = '';

  onMount(async () => {
    // Load language detection data from database
    await loadLanguageDetectionData();
  });

  // Language detection data - loaded from database
  let languageStats: any[] = [];
  let languageAnalysis: any[] = [];
  let detectionStats: any = {};
  let samplePosts: any[] = [];
  let mixingData: any[] = [];
  let geographicData: any[] = [];
  
  // Load language detection data from database service
  async function loadLanguageDetectionData() {
    try {
      // Load all language data from database service
      const stats = await languageDetectionDb.getLanguageStats(workspaceId || undefined);
      languageStats = stats.map((stat) => ({
        code: stat.language_code,
        name: stat.language,
        count: stat.post_count,
        percentage: stat.percentage,
        confidence: stat.confidence
      }));
      languageAnalysis = await languageDetectionDb.getLanguageAnalysis(workspaceId || undefined);
      detectionStats = await languageDetectionDb.getLanguageDetectionStats(workspaceId || undefined);
      
      // Load posts with current filters
      await loadFilteredPosts();
      
      // Load additional data
      mixingData = await languageDetectionDb.getLanguageMixing(workspaceId || undefined);
      geographicData = await languageDetectionDb.getGeographicDistribution(workspaceId || undefined);
      
      console.log('Language detection data loaded successfully from database');
      loading = false;
    } catch (error) {
      console.error('Error loading language detection data:', error);
      errorMessage = 'Failed to load language detection data. Please try again.';
      loading = false;
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
      samplePosts = await languageDetectionDb.getSamplePosts(filters, workspaceId || undefined);
    } catch (error) {
      console.error('Error loading filtered posts:', error);
      errorMessage = 'Failed to load filtered posts. Please try again.';
    }
  }
  
  let selectedLanguage = 'all';
  let selectedPlatform = 'all';
  // Only the platforms the project's datasets actually come from are offered
  let platformChoices: { value: string; label: string }[] = [];
  async function loadPlatformChoices() {
    try {
      const result = await (await fetch('/api/datasets?status=available')).json();
      platformChoices = platformOptions((result.datasets ?? []).map((d: any) => d.source_platform));
    } catch {
      platformChoices = [];
    }
  }
  onMount(loadPlatformChoices);
  let confidenceThreshold = 0.5;
  let timeRange = '7d';

  // Reactive statements for filter changes
  $: if ((selectedLanguage !== 'all' || selectedPlatform !== 'all' || confidenceThreshold !== 0.5) && !loading) {
    loadFilteredPosts();
  }

  // Filtered posts and stats (for display purposes, actual filtering happens in database)
  $: filteredPosts = samplePosts;

  // Detection quality figures, computed from the loaded data
  const CONFIDENCE_BANDS = [
    { key: 'veryHigh', label: 'Very high (95-100%)', barClass: 'bg-blue-600' },
    { key: 'high', label: 'High (85-95%)', barClass: 'bg-blue-400' },
    { key: 'medium', label: 'Medium (70-85%)', barClass: 'bg-yellow-600' },
    { key: 'low', label: 'Low (below 70%)', barClass: 'bg-red-600' }
  ] as const;
  const percentOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

  $: distribution = detectionStats.confidenceDistribution ?? { veryHigh: 0, high: 0, medium: 0, low: 0 };
  $: distributionTotal = distribution.veryHigh + distribution.high + distribution.medium + distribution.low;
  $: confidenceRows = CONFIDENCE_BANDS.map((band) => ({
    ...band,
    percent: percentOf(distribution[band.key], distributionTotal)
  }));
  $: mixedPercent = percentOf(mixingData.reduce((sum, pair) => sum + pair.occurrence_count, 0), totalPosts);
  $: highQualityPercent = percentOf(distribution.veryHigh + distribution.high, distributionTotal);
  $: totalPosts = detectionStats.totalPosts || languageStats.reduce((sum, lang) => sum + lang.count, 0);

  function getLanguageName(code: string) {
    const lang = languageStats.find(l => l.code === code);
    return lang ? lang.name : code.toUpperCase();
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
      
      const exportData = await languageDetectionDb.exportLanguageData(filters, workspaceId || undefined);
      
      // Create CSV from the exported data
      const csvData = (exportData as any).languages.map((lang: any) =>
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
      errorMessage = 'Failed to export language data. Using cached data instead.';
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

<div class="min-h-screen bg-gray-50">
  <PageHeader
    title="Language Detection"
    subtitle="Analyze language distribution and detection confidence in your social media data"
    accentColor="amber"
    backHref="/text-analytics">
    <svelte:fragment slot="icon">
      <div class="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path>
        </svg>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="actions">
      <button
        on:click={exportLanguageData}
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
        Export Report
      </button>
    </svelte:fragment>
  </PageHeader>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <WorkspaceBanner workspaceId={workspaceId || ''} workspaceName="" />


    <!-- Data Source Filter -->
    <div class="mb-6">
      <FilterBar workspaceId={workspaceId} datasetTypes={["social_media"]} on:change={handleFilterChange} />
    </div>
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading language detection data from database...</span>
      </div>
    {:else}
    {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

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
        <div class="text-2xl font-bold text-amber-600 mb-1">{Math.round((detectionStats.avgConfidence || 0) * 100)}%</div>
        <div class="text-sm text-gray-600">Avg Confidence</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-amber-600 mb-1">{detectionStats.topLanguage?.name || languageStats[0]?.name || 'n/a'}</div>
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
            {#each platformChoices as choice}
              <option value={choice.value}>{choice.label}</option>
            {/each}
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
              {#each confidenceRows as row}
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600">{row.label}</span>
                  <div class="flex items-center">
                    <div class="w-32 bg-gray-200 rounded-full h-2 mr-2">
                      <div class="{row.barClass} h-2 rounded-full" style="width: {row.percent}%"></div>
                    </div>
                    <span class="text-sm font-medium w-12 text-right">{row.percent}%</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Language Complexity -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 mb-3">Detection Challenges</h3>
            <div class="space-y-3">
              <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <span class="text-sm text-yellow-800">Mixed language posts: {mixedPercent}%</span>
              </div>
              <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <span class="text-sm text-amber-800">High quality detections (85% confidence or more): {highQualityPercent}%</span>
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