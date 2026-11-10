<script lang="ts">
  import { CHART } from '$lib/utils/chartColors';
  import { page } from '$app/stores';
  import DataUnavailable from '$lib/components/ui/DataUnavailable.svelte';
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';
  import ModelTierSelector from '$lib/components/ui/ModelTierSelector.svelte';
  import ResponsibleUse from '$lib/components/ui/ResponsibleUse.svelte';

  let selectedTier = 'fast';

  // State
  let loading = true;
  let errorMessage = '';
  let unavailable = false;
  let faceStats: { distribution: { range: string; count: number }[]; summary: { totalFaces: number; imagesWithFaces: number; avgFacesPerImage: number; totalImages: number } } = {
    distribution: [],
    summary: { totalFaces: 0, imagesWithFaces: 0, avgFacesPerImage: 0, totalImages: 0 }
  };
  let results: { image_url: string; face_count: number; confidence: number; analyzed_at: string }[] = [];
  let imageUrl = '';
  let analyzing = false;
  let singleResult: { face_count: number; confidence: number } | null = null;

  // Chart references
  let distributionChartEl: HTMLDivElement;
  let distributionChart: any = null;

  async function loadData() {
    try {
      loading = true;
      errorMessage = '';

      const [statsRes, resultsRes] = await Promise.all([
        fetch('/api/image-processing?action=face-stats'),
        fetch('/api/image-processing?action=face-results&limit=20')
      ]);

      if (!statsRes.ok) throw new Error(`Failed to load face stats: ${statsRes.statusText}`);
      if (!resultsRes.ok) throw new Error(`Failed to load face results: ${resultsRes.statusText}`);

      const statsData = await statsRes.json();

      unavailable = !!statsData.meta?.unavailable;
      const resultsData = await resultsRes.json();

      // Map API response to expected format
      const rawSummary = statsData.data?.summary || {};
      faceStats = {
        distribution: statsData.data?.distribution || [],
        summary: {
          totalFaces: parseInt(rawSummary.total_faces || '0'),
          imagesWithFaces: parseInt(rawSummary.total || '0'),
          avgFacesPerImage: parseFloat(rawSummary.avg_faces || '0'),
          totalImages: parseInt(rawSummary.total || '0')
        }
      };
      results = Array.isArray(resultsData.data) ? resultsData.data : [];

      loading = false;

      try {
        await waitForEcharts();
        initDistributionChart();
      } catch (e) {
        console.error('Charts unavailable:', e);
      }
    } catch (error: any) {
      console.error('Error loading face detection data:', error);
      errorMessage = error.message || 'Failed to load face detection data';
      loading = false;
    }
  }

  async function analyzeImage() {
    if (!imageUrl.trim()) return;

    try {
      analyzing = true;
      singleResult = null;
      errorMessage = '';

      const res = await fetch('/api/image-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', image_url: imageUrl, tier: selectedTier })
      });

      const data = await res.json().catch(() => ({}));
      // The server explains what was wrong (a bad address, an empty file); the status text alone says nothing
      if (!res.ok) throw new Error(data.error || 'The image could not be analysed. Try again in a moment.');

      const analysis = data.data?.analysis || {};
      singleResult = {
        face_count: analysis.face_count || 0,
        confidence: 0,
        status: analysis.status || 'analyzed',
        description: analysis.description || '',
        _note: analysis._note || ''
      };

      // Reload data to include new result
      await loadData();
    } catch (error: any) {
      console.error('Error analyzing image:', error);
      errorMessage = error.message || 'Failed to analyze image';
    } finally {
      analyzing = false;
    }
  }

  function initDistributionChart() {
    distributionChart = initChart(distributionChartEl);
    if (!distributionChart) return;

    const dist = faceStats.distribution;
    const categories = dist.map(d => d.range);
    const counts = dist.map(d => d.count);

    distributionChart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = params[0];
          return `<strong>${p.name}</strong><br/>Images: ${p.value.toLocaleString()}`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories.length > 0 ? categories : ['0 faces', '1 face', '2-5 faces', '6+ faces'],
        axisLabel: {
          color: CHART.ink500,
          fontSize: 12
        },
        axisLine: { lineStyle: { color: CHART.ink200 } }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: CHART.ink500,
          fontSize: 12
        },
        splitLine: { lineStyle: { color: CHART.ink100 } }
      },
      series: [
        {
          name: 'Images',
          type: 'bar',
          data: counts.length > 0 ? counts : [0, 0, 0, 0],
          barWidth: '50%',
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: CHART.catGreen },
                { offset: 1, color: CHART.success600 }
              ]
            },
            borderRadius: [4, 4, 0, 0]
          }
        }
      ]
    });
  }

  function truncateUrl(url: string, maxLen: number = 50): string {
    if (url.length <= maxLen) return url;
    return url.substring(0, maxLen - 3) + '...';
  }

  onMount(loadData);
</script>

<svelte:head>
  <title>Face Detection - Social Explorer</title>
  <meta name="description" content="Privacy-first face counting for image analysis" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <PageHeader
    title="Face Detection"
    subtitle="Privacy-first face counting — no biometric data stored"
    backHref="/image-processing"
  >
    <div slot="icon">
      <div class="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
        </svg>
      </div>
    </div>
  </PageHeader>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <ResponsibleUse tool="face detection" />

    <!-- Privacy Banner -->
    <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-8">
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5 text-emerald-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-semibold text-emerald-800">Privacy First</h3>
          <p class="text-sm text-emerald-700 mt-1">Only face counts are stored — no facial recognition, no biometric data, no face images saved.</p>
        </div>
      </div>
    </div>

    {#if errorMessage}
      <div class="mb-6">
        <ErrorAlert message={errorMessage} />
      </div>
    {/if}
  {#if unavailable}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <DataUnavailable
        title="No images have been analysed yet"
        description="This page fills in once images have been processed. You can try the analysis on a single image below." />
    </div>
  {/if}

    <!-- Analyze Panel -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-3">Analyze an Image</h2>
      <div class="mb-3">
        <ModelTierSelector tool="faces" bind:selectedTier disabled={analyzing} />
      </div>
      <div class="flex flex-col sm:flex-row gap-3">
        <input
          type="url"
          bind:value={imageUrl}
          placeholder="Enter image URL to detect faces..."
          class="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
        />
        <button
          on:click={analyzeImage}
          disabled={analyzing || !imageUrl.trim()}
          class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          {#if analyzing}
            <span class="flex items-center">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing...
            </span>
          {:else}
            Detect Faces
          {/if}
        </button>
      </div>

      {#if singleResult}
        <div class="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-emerald-800">Detection Result</span>
                {#if singleResult.status === 'queued'}
                  <span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Queued — results in ~5s</span>
                {/if}
              </div>
              <p class="text-lg font-bold text-emerald-900 mt-1">{singleResult.description || 'Image registered'}</p>
            </div>
          </div>
          {#if singleResult._note}
            <p class="text-xs text-emerald-600 bg-emerald-100/50 rounded p-2">{singleResult._note}</p>
          {/if}
        </div>
      {/if}
    </div>

    {#if loading}
      <div class="flex items-center justify-center py-24">
        <div class="text-center">
          <svg class="animate-spin h-10 w-10 text-emerald-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-gray-500 text-sm">Loading face detection data...</p>
        </div>
      </div>
    {:else}
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-500">Total Faces Detected</span>
            <div class="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
          </div>
          <p class="text-3xl font-bold text-gray-900">{formatNumber(faceStats.summary.totalFaces)}</p>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-500">Images with Faces</span>
            <div class="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
            </div>
          </div>
          <p class="text-3xl font-bold text-gray-900">{formatNumber(faceStats.summary.imagesWithFaces)}</p>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-500">Average Faces/Image</span>
            <div class="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
          </div>
          <p class="text-3xl font-bold text-gray-900">{faceStats.summary.avgFacesPerImage.toFixed(1)}</p>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-500">Images Analyzed</span>
            <div class="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
              </svg>
            </div>
          </div>
          <p class="text-3xl font-bold text-gray-900">{formatNumber(faceStats.summary.totalImages)}</p>
        </div>
      </div>

      <!-- Distribution Chart -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Face Count Distribution</h2>
        <p class="text-sm text-gray-500 mb-4">Number of images by detected face count range</p>
        <div bind:this={distributionChartEl} class="w-full h-80"></div>
      </div>

      <!-- Results Table -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">Recent Results</h2>
          <p class="text-sm text-gray-500 mt-1">Images sorted by face count (descending)</p>
        </div>

        {#if results.length === 0}
          <div class="px-6 py-12 text-center">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <p class="text-gray-500 text-sm">No face detection results yet. Analyze an image to get started.</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="bg-gray-50">
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image URL</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Face Count</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                {#each results as result}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4 text-sm text-gray-700 font-mono" title={result.image_url}>
                      {truncateUrl(result.image_url)}
                    </td>
                    <td class="px-6 py-4">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold {result.face_count === 0 ? 'bg-gray-100 text-gray-700' : result.face_count <= 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-200 text-emerald-900'}">
                        {result.face_count}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-700">
                      {(result.avg_confidence || result.confidence || 0 * 100).toFixed(1)}%
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {new Date(result.analyzed_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
