<script lang="ts">
  import { page } from '$app/stores';
  import DataUnavailable from '$lib/components/ui/DataUnavailable.svelte';
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';
  import ModelTierSelector from '$lib/components/ui/ModelTierSelector.svelte';

  let selectedTier = 'fast';

  let loading = true;
  let errorMessage = '';
  let unavailable = false;
  let ocrStats: any = { summary: {}, languages: [] };
  let results: any[] = [];
  let searchQuery = '';
  let imageUrl = '';
  let analyzing = false;
  let singleResult: any = null;

  async function loadData() {
    loading = true;
    try {
      const [statsRes, resultsRes] = await Promise.all([
        fetch('/api/image-processing?action=ocr-stats'),
        fetch('/api/image-processing?action=ocr-results&limit=20'),
      ]);
      const [statsData, resultsData] = await Promise.all([statsRes.json(), resultsRes.json()]);
      unavailable = !!statsData.meta?.unavailable;
      if (statsData.success) ocrStats = statsData.data;
      if (resultsData.success) results = resultsData.data || [];
    } catch (err: any) { errorMessage = err.message; }
    finally { loading = false; }
  }

  async function analyzeImage() {
    if (!imageUrl.trim()) return;
    analyzing = true;
    singleResult = null;
    try {
      const res = await fetch('/api/image-processing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', image_url: imageUrl.trim(), tier: selectedTier })
      });
      const data = await res.json();
      if (data.success) singleResult = data.data;
      else errorMessage = data.error;
    } catch (err: any) { errorMessage = err.message; }
    finally { analyzing = false; }
  }

  async function searchOcr() {
    if (!searchQuery.trim()) { await loadData(); return; }
    loading = true;
    try {
      const res = await fetch(`/api/image-processing?action=ocr-results&limit=50&search=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) results = data.data || [];
    } catch (err: any) { errorMessage = err.message; }
    finally { loading = false; }
  }

  onMount(loadData);
</script>

<svelte:head><title>OCR & Text Extraction - Social Explorer</title></svelte:head>

<PageHeader title="OCR & Text Extraction" subtitle="Extract and search text from images using PaddleOCR" accentColor="amber" />

<div class="max-w-7xl xl:max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}
  {#if unavailable}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <DataUnavailable
        title="No images have been analysed yet"
        description="This page fills in once images have been processed. You can try the analysis on a single image below." />
    </div>
  {/if}

  <!-- Extract Panel -->
  <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-3">Extract Text from Image</h2>
    <div class="mb-3">
      <ModelTierSelector bind:selectedTier disabled={analyzing} />
    </div>
    <div class="flex gap-3 mb-4">
      <input type="text" bind:value={imageUrl} placeholder="Paste image URL..." disabled={analyzing}
        class="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50" />
      <button on:click={analyzeImage} disabled={analyzing || !imageUrl.trim()}
        class="px-5 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 flex items-center gap-2">
        {#if analyzing}<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>Extracting...
        {:else}Extract Text{/if}
      </button>
    </div>
    {#if singleResult}
      {@const analysis = singleResult.analysis || singleResult}
      <div class="bg-amber-50 rounded-lg p-4 border border-amber-200">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-amber-900">Result</h3>
          {#if analysis.status === 'queued'}
            <span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Queued for PaddleOCR processing</span>
          {/if}
        </div>
        {#if analysis.ocr_text && analysis.ocr_text.trim()}
          <pre class="text-sm text-gray-800 whitespace-pre-wrap bg-white rounded p-3 border">{analysis.ocr_text}</pre>
        {:else if analysis.status === 'queued'}
          <p class="text-sm text-amber-700">Image registered and queued for OCR text extraction. Run the ETL pipeline (<code class="bg-amber-100 px-1 rounded text-xs">python image_pipeline.py</code>) to process queued images with PaddleOCR.</p>
        {:else}
          <p class="text-sm text-gray-600">No text found in this image.</p>
        {/if}
        {#if analysis._note}
          <p class="text-xs text-amber-600 mt-2 bg-amber-100/50 rounded p-2">{analysis._note}</p>
        {/if}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="animate-spin rounded-full h-10 w-10 border-4 border-amber-200 border-t-amber-600"></div>
    </div>
  {:else}
    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase mb-1">Images Scanned</p>
        <p class="text-2xl font-bold text-gray-900">{formatNumber(parseInt(ocrStats.summary?.total) || 0)}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase mb-1">With Text Found</p>
        <p class="text-2xl font-bold text-amber-600">{formatNumber(parseInt(ocrStats.summary?.with_text) || 0)}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase mb-1">Avg Confidence</p>
        <p class="text-2xl font-bold text-gray-900">{((parseFloat(ocrStats.summary?.avg_confidence) || 0) * 100).toFixed(1)}%</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase mb-1">Languages Detected</p>
        <p class="text-2xl font-bold text-gray-900">{ocrStats.languages?.length || 0}</p>
      </div>
    </div>

    <!-- Language breakdown -->
    {#if ocrStats.languages?.length > 0}
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">OCR Language Distribution</h2>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          {#each ocrStats.languages as lang}
            <div class="bg-amber-50 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-amber-700">{formatNumber(parseInt(lang.count))}</div>
              <div class="text-xs text-gray-600">{lang.language || 'Unknown'}</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Search + Results -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">OCR Results</h2>
          <p class="text-xs text-gray-500">{results.length} results</p>
        </div>
        <div class="flex gap-2">
          <input type="text" bind:value={searchQuery} placeholder="Search extracted text..."
            class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg w-56 focus:ring-2 focus:ring-amber-500" />
          <button on:click={searchOcr} class="px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">Search</button>
        </div>
      </div>
      {#if results.length === 0}
        <div class="p-12 text-center text-gray-400">
          <span class="text-4xl block mb-2">📝</span>
          <p class="text-sm">No OCR results yet. Process images to extract text.</p>
        </div>
      {:else}
        <div class="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {#each results as r}
            <div class="p-4 hover:bg-amber-50/30">
              <div class="flex items-start gap-4">
                <img src={r.image_url} alt="Source" class="w-16 h-16 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                  on:error={(e) => { e.currentTarget.style.display = 'none'; }} />
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-900 line-clamp-3">{r.extracted_text}</p>
                  <div class="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    {#if r.language}<span class="bg-gray-100 px-2 py-0.5 rounded">{r.language}</span>{/if}
                    <span>Confidence: {((parseFloat(r.confidence) || 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
