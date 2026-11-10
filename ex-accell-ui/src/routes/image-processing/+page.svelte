<script lang="ts">
  import { goto } from '$app/navigation';
  import DataUnavailable from '$lib/components/ui/DataUnavailable.svelte';
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';
  import { moduleBadge } from '$lib/utils/imageModules';

  let loading = true;
  let errorMessage = '';
  let unavailable = false;
  let stats: any = {};

  const modules = [
    {
      name: 'Object Detection',
      href: '/image-processing/object-detection',
      description: 'Identify and count objects in images using YOLOv8',
      icon: '🎯',
      color: 'blue',
      statKey: 'totalObjects',
      statLabel: 'Objects Detected'
    },
    {
      name: 'Face Detection',
      href: '/image-processing/face-detection',
      description: 'Privacy-first face counting — no biometric data stored',
      icon: '👤',
      color: 'emerald',
      statKey: 'totalFaces',
      statLabel: 'Faces Detected'
    },
    {
      name: 'Content Moderation',
      href: '/image-processing/content-moderation',
      description: 'Automated safety screening with human review workflow',
      icon: '🛡️',
      color: 'red',
      statKey: 'flaggedImages',
      statLabel: 'Flagged Items'
    },
    {
      name: 'OCR & Text Extraction',
      href: '/image-processing/ocr',
      description: 'Extract text from images, memes, screenshots, and infographics',
      icon: '📝',
      color: 'amber',
      statKey: 'ocrExtractions',
      statLabel: 'Text Extractions'
    },
    {
      name: 'Image Classification',
      href: '/image-processing/classification',
      description: 'Zero-shot classification with customizable taxonomy',
      icon: '🏷️',
      color: 'purple',
      statKey: 'classifiedImages',
      statLabel: 'Images Classified'
    },
    {
      name: 'Brand Recognition',
      href: '/image-processing/brand-recognition',
      description: 'Preview: find logos and brand placements in images. Results are limited while this is built out.',
      icon: '🏢',
      color: 'amber',
      statKey: null,
      statLabel: 'Preview'
    }
  ];

  const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200 hover:border-blue-400', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200 hover:border-emerald-400', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    red: { bg: 'bg-red-50', border: 'border-red-200 hover:border-red-400', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200 hover:border-amber-400', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200 hover:border-purple-400', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  };

  async function loadData() {
    loading = true;
    try {
      const res = await fetch('/api/image-processing?action=stats');
      const data = await res.json();
      unavailable = !!data.meta?.unavailable;
      if (data.success) stats = data.data || {};
    } catch (err: any) { errorMessage = err.message; }
    finally { loading = false; }
  }

  onMount(loadData);
</script>

<svelte:head>
  <title>Image Processing Suite - Social Explorer</title>
  <meta name="description" content="Classify images, read text, detect faces and objects, recognise brands and moderate content." />
</svelte:head>

<PageHeader
  title="Image Processing Suite"
  subtitle="Computer Vision, Content Analysis, and Visual Intelligence"
  accentColor="indigo"
/>

<div class="max-w-7xl xl:max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}
  {#if unavailable}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <DataUnavailable
        title="No images have been analysed yet"
        description="This page fills in once images have been processed. You can try the analysis on a single image below." />
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600"></div>
    </div>
  {:else}
    <!-- Overview Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Images Analyzed</p>
        <p class="text-2xl font-bold text-gray-900">{formatNumber(stats.totalImages || 0)}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Objects Detected</p>
        <p class="text-2xl font-bold text-blue-600">{formatNumber(stats.totalObjects || 0)}</p>
        <p class="text-xs text-gray-500 mt-1">{stats.objectClasses || 0} unique classes</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Content Safety</p>
        <p class="text-2xl font-bold text-emerald-600">{formatNumber(stats.safeImages || 0)} safe</p>
        {#if stats.flaggedImages > 0}
          <p class="text-xs text-red-500 mt-1">{stats.flaggedImages} flagged</p>
        {/if}
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Text Extractions</p>
        <p class="text-2xl font-bold text-amber-600">{formatNumber(stats.ocrExtractions || 0)}</p>
      </div>
    </div>

    <!-- Processing Modules Grid -->
    <h2 class="text-xl font-semibold text-gray-900 mb-4">Processing Modules</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
      {#each modules as mod}
        {@const colors = colorMap[mod.color] || colorMap.blue}
        <button
          on:click={() => goto(mod.href)}
          class="bg-white rounded-xl shadow-sm p-6 border {colors.border} transition-all hover:shadow-md text-left"
        >
          <div class="flex items-start justify-between mb-3">
            <span class="text-3xl">{mod.icon}</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {colors.badge}">
              {moduleBadge(mod.statKey, stats, unavailable)}
            </span>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-1">{mod.name}</h3>
          <p class="text-sm text-gray-600">{mod.description}</p>
        </button>
      {/each}
    </div>

    <!-- Processing Pipeline Info -->
    <div class="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200">
      <h2 class="text-lg font-semibold text-indigo-900 mb-4">Processing Pipeline</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <span class="text-xl">📥</span>
          </div>
          <p class="text-sm font-medium text-indigo-900">Image Ingestion</p>
          <p class="text-xs text-indigo-600">Download from posts</p>
        </div>
        <div class="text-center">
          <div class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <span class="text-xl">🤖</span>
          </div>
          <p class="text-sm font-medium text-indigo-900">AI Analysis</p>
          <p class="text-xs text-indigo-600">YOLO + CLIP + OCR</p>
        </div>
        <div class="text-center">
          <div class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <span class="text-xl">📊</span>
          </div>
          <p class="text-sm font-medium text-indigo-900">Data Enrichment</p>
          <p class="text-xs text-indigo-600">Tags, objects, text</p>
        </div>
        <div class="text-center">
          <div class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <span class="text-xl">📈</span>
          </div>
          <p class="text-sm font-medium text-indigo-900">Analytics</p>
          <p class="text-xs text-indigo-600">Insights & dashboards</p>
        </div>
      </div>
      <div class="mt-4 text-center">
        <p class="text-xs text-indigo-600">All models run on CPU (YOLO: 25-50 img/s, BlazeFace: 200+ img/s, CLIP: 7-20 img/s, PaddleOCR: 5-20 img/s). Optional GPU worker available for Gemma multimodal batch processing.</p>
      </div>
    </div>
  {/if}
</div>
