<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    investigationSelection,
    clearSelection,
    setTimeRange,
    setSentimentFilter,
    setSourceFilter
  } from '$lib/stores/investigationStore';
  import SwimLaneTimeline from '$lib/components/investigation/SwimLaneTimeline.svelte';
  import type { TimelineEntry } from '$lib/components/investigation/SwimLaneTimeline.svelte';
  import SentimentDistribution from '$lib/components/investigation/SentimentDistribution.svelte';
  import ParallelCoordinates from '$lib/components/investigation/ParallelCoordinates.svelte';
  import LagAnalysisChart from '$lib/components/investigation/LagAnalysisChart.svelte';
  import KeywordNetwork from '$lib/components/investigation/KeywordNetwork.svelte';
  import WordCloudChart from '$lib/components/investigation/WordCloudChart.svelte';
  import GdeltEventPanel from '$lib/components/investigation/GdeltEventPanel.svelte';
  import RadioTranscriptPanel from '$lib/components/investigation/RadioTranscriptPanel.svelte';
  import SocialPostPanel from '$lib/components/investigation/SocialPostPanel.svelte';
  import ComponentPalette from '$lib/components/investigation/ComponentPalette.svelte';

  interface Investigation {
    id: string;
    name: string;
    description: string;
    keywords: string[];
    date_start: string;
    date_end: string;
    sources: string[];
    created_at: string;
    query_config?: {
      keywords?: string[];
      dateStart?: string;
      dateEnd?: string;
      [key: string]: unknown;
    };
  }

  interface GdeltEvent {
    globaleventid: string | number;
    sqldate: string;
    actor1name?: string;
    actor2name?: string;
    goldsteinscale: number;
    avgtone: number;
    actiongeo_fullname?: string;
    numarticles?: number;
  }

  interface RadioSegment {
    id: string | number;
    radio_name: string;
    state?: string;
    segment_start: string;
    duration_seconds: number;
    transcript: string;
    sentiment?: string;
    emotion?: string;
    confidence?: number;
    is_political?: boolean;
  }

  interface SocialPost {
    id: string | number;
    text: string;
    sentiment_category?: string;
    confidence_score?: number;
    platform?: string;
    timestamp?: string;
  }

  let investigation: Investigation | null = null;
  let loading = true;
  let timelineData: TimelineEntry[] = [];
  let timelineLoading = true;
  let gdeltEvents: GdeltEvent[] = [];
  let radioSegments: RadioSegment[] = [];
  let socialPosts: SocialPost[] = [];
  let keywordData: any[] = [];
  let activeInsightSlots: string[] = ['sentiment', 'parallel', 'lag'];
  let gdeltLoading = true;
  let radioLoading = true;
  let socialLoading = true;
  let sourcesEnabled = { gdelt: true, radio: true, social: true };
  let paletteOpen = false;

  // Extracted investigation parameters
  let keywords: string[] = [];
  let dateStart = '';
  let dateEnd = '';

  $: investigationId = $page.params.id || '';

  // Compute sentiment distribution from all loaded sources
  $: sentimentChartData = computeSentimentFromAllSources(gdeltEvents, radioSegments, socialPosts);

  function computeSentimentFromAllSources(
    gdelt: GdeltEvent[],
    radio: RadioSegment[],
    social: SocialPost[]
  ): { label: string; value: number; color: string }[] {
    let positive = 0;
    let negative = 0;
    let neutral = 0;

    // GDELT: classify by average tone
    for (const e of gdelt) {
      if (e.avgtone > 1) positive++;
      else if (e.avgtone < -1) negative++;
      else neutral++;
    }

    // Radio: classify by sentiment field
    for (const s of radio) {
      const label = (s.sentiment || 'neutral').toLowerCase();
      if (label === 'positive') positive++;
      else if (label === 'negative') negative++;
      else neutral++;
    }

    // Social: classify by sentiment_category
    for (const p of social) {
      const label = (p.sentiment_category || 'neutral').toLowerCase();
      if (label === 'positive') positive++;
      else if (label === 'negative') negative++;
      else neutral++;
    }

    return [
      { label: 'Positive', value: positive, color: '#06d6a0' },
      { label: 'Negative', value: negative, color: '#f72585' },
      { label: 'Neutral', value: neutral, color: '#8b5cf6' }
    ];
  }

  onMount(() => {
    loadInvestigation();
    return () => clearSelection();
  });

  async function loadInvestigation() {
    loading = true;
    try {
      const response = await fetch(`/api/investigations?id=${investigationId}`);
      const result = await response.json();
      if (result.success && result.investigation) {
        investigation = result.investigation;
        const config = investigation?.query_config || {};
        keywords = investigation?.keywords || config.keywords || [];
        dateStart = investigation?.date_start || config.dateStart || '';
        dateEnd = investigation?.date_end || config.dateEnd || '';

        if (dateStart && dateEnd) {
          setTimeRange(dateStart, dateEnd);
        }

        // Fetch timeline, detail panels, and keyword data in parallel
        await Promise.all([
          loadTimeline(keywords, dateStart, dateEnd),
          loadDetailPanels(keywords, dateStart, dateEnd),
          loadKeywordData(keywords, dateStart, dateEnd)
        ]);
      }
    } catch (error) {
      console.error('Error loading investigation:', error);
    } finally {
      loading = false;
    }
  }

  async function loadTimeline(kw: string[], ds: string, de: string) {
    timelineLoading = true;
    try {
      const params = new URLSearchParams({ type: 'investigation-timeline' });
      if (kw.length) params.set('keywords', kw.join(','));
      if (ds) params.set('date_start', ds);
      if (de) params.set('date_end', de);

      const response = await fetch(`/api/unified-analytics?${params}`);
      const result = await response.json();
      if (result.success) {
        timelineData = result.data || result.timeline || [];
      }
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      timelineLoading = false;
    }
  }

  async function loadDetailPanels(kw: string[], ds: string, de: string) {
    await Promise.all([
      loadGdeltEvents(kw, ds, de),
      loadRadioSegments(kw, ds, de),
      loadSocialPosts(kw, ds, de)
    ]);
  }

  async function loadGdeltEvents(kw: string[], ds: string, de: string) {
    gdeltLoading = true;
    try {
      const params = new URLSearchParams({ type: 'investigation-gdelt-events', limit: '100' });
      if (kw.length) params.set('keywords', kw.join(','));
      if (ds) params.set('date_start', ds);
      if (de) params.set('date_end', de);

      const response = await fetch(`/api/unified-analytics?${params}`);
      const result = await response.json();
      if (result.success) {
        gdeltEvents = result.data || result.events || [];
      }
    } catch (error) {
      console.error('Error loading GDELT events:', error);
    } finally {
      gdeltLoading = false;
    }
  }

  async function loadRadioSegments(kw: string[], ds: string, de: string) {
    radioLoading = true;
    try {
      const params = new URLSearchParams({ type: 'investigation-radio-segments', limit: '50' });
      if (kw.length) params.set('keywords', kw.join(','));
      if (ds) params.set('date_start', ds);
      if (de) params.set('date_end', de);

      const response = await fetch(`/api/unified-analytics?${params}`);
      const result = await response.json();
      if (result.success) {
        radioSegments = result.data || result.segments || [];
      }
    } catch (error) {
      console.error('Error loading radio segments:', error);
    } finally {
      radioLoading = false;
    }
  }

  async function loadSocialPosts(kw: string[], ds: string, de: string) {
    socialLoading = true;
    try {
      const params = new URLSearchParams({ type: 'investigation-social-posts', limit: '100' });
      if (kw.length) params.set('keywords', kw.join(','));
      if (ds) params.set('date_start', ds);
      if (de) params.set('date_end', de);

      const response = await fetch(`/api/unified-analytics?${params}`);
      const result = await response.json();
      if (result.success) {
        socialPosts = result.data || result.posts || [];
      }
    } catch (error) {
      console.error('Error loading social posts:', error);
    } finally {
      socialLoading = false;
    }
  }

  async function loadKeywordData(kw: string[], ds: string, de: string) {
    try {
      const params = new URLSearchParams({ type: 'investigation-keyword-overlap' });
      if (kw.length) params.set('keywords', kw.join(','));
      if (ds) params.set('date_start', ds);
      if (de) params.set('date_end', de);

      const response = await fetch(`/api/unified-analytics?${params}`);
      const result = await response.json();
      if (result.success) {
        keywordData = result.data || [];
      }
    } catch (error) {
      console.error('Error loading keyword data:', error);
    }
  }

  // Compute word cloud data from keyword overlap
  $: wordCloudData = keywordData.map((k: any) => ({
    text: k.keyword || k.word,
    size: (k.gdelt_count || 0) + (k.radio_count || 0) + (k.social_count || 0)
  })).filter((w: any) => w.size > 0);

  function handleBrushChange(event: CustomEvent<{ start: Date; end: Date }>) {
    const { start, end } = event.detail;
    const brushStart = start.toISOString().split('T')[0];
    const brushEnd = end.toISOString().split('T')[0];
    setTimeRange(brushStart, brushEnd);
    // Re-fetch detail panels with the narrowed date range
    loadDetailPanels(keywords, brushStart, brushEnd);
  }

  function handleDayClick(event: CustomEvent<{ date: string }>) {
    const { date } = event.detail;
    setTimeRange(date, date);
    loadDetailPanels(keywords, date, date);
  }

  function handleSentimentFilter(event: CustomEvent<{ label: string }>) {
    const { label } = event.detail;
    const current = $investigationSelection.sentiment || [];
    if (current.includes(label.toLowerCase())) {
      setSentimentFilter(current.filter((s: string) => s !== label.toLowerCase()));
    } else {
      setSentimentFilter([...current, label.toLowerCase()]);
    }
  }

  function toggleSourceEnabled(source: 'gdelt' | 'radio' | 'social') {
    sourcesEnabled = { ...sourcesEnabled, [source]: !sourcesEnabled[source] };
    const active = Object.entries(sourcesEnabled).filter(([, v]) => v).map(([k]) => k);
    setSourceFilter(active);
  }

  function handleAddComponent(type: string) {
    console.log('Add component:', type);
    // Placeholder: future implementation for adding visualization components to Band D
  }

  function resetBrush() {
    if (dateStart && dateEnd) {
      setTimeRange(dateStart, dateEnd);
      loadDetailPanels(keywords, dateStart, dateEnd);
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  // Annotations
  let annotations: { id: string; text: string; timestamp: string }[] = [];
  let newAnnotation = '';
  let showAnnotations = false;
  let saveStatus = '';

  function addAnnotation() {
    if (!newAnnotation.trim()) return;
    annotations = [...annotations, {
      id: crypto.randomUUID(),
      text: newAnnotation.trim(),
      timestamp: new Date().toISOString()
    }];
    newAnnotation = '';
  }

  function removeAnnotation(id: string) {
    annotations = annotations.filter(a => a.id !== id);
  }

  async function handleSave() {
    saveStatus = 'saving';
    try {
      await fetch('/api/investigations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: investigationId,
          query_config: {
            ...investigation?.query_config,
            keywords,
            dateStart,
            dateEnd
          },
          annotations: JSON.stringify(annotations),
          layout_config: JSON.stringify({ activeInsightSlots, sourcesEnabled })
        })
      });
      saveStatus = 'saved';
      setTimeout(() => { saveStatus = ''; }, 2000);
    } catch (error) {
      console.error('Error saving investigation:', error);
      saveStatus = 'error';
    }
  }

  async function handleExport() {
    // Collect all visible data into a report object
    const report = {
      investigation: { name: investigation?.name, keywords, dateStart, dateEnd },
      annotations,
      summary: {
        gdelt_events: gdeltEvents.length,
        radio_segments: radioSegments.length,
        social_posts: socialPosts.length,
        timeline_days: timelineData.length
      },
      gdelt_sample: gdeltEvents.slice(0, 20),
      radio_sample: radioSegments.slice(0, 10),
      social_sample: socialPosts.slice(0, 20),
      exported_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investigation-${investigation?.name?.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Count of active panels for responsive grid
  $: activePanelCount = [sourcesEnabled.gdelt, sourcesEnabled.radio, sourcesEnabled.social].filter(Boolean).length;
  $: gridCols = activePanelCount === 3 ? 'lg:grid-cols-3' : activePanelCount === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1';
</script>

<svelte:head>
  <title>{investigation?.name || 'Investigation'} - Social Explorer</title>
</svelte:head>

{#if loading}
  <div class="flex items-center justify-center min-h-screen">
    <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
    <span class="ml-3 text-gray-600">Loading investigation...</span>
  </div>
{:else if investigation}
  <!-- Band A: Compact Header -->
  <div class="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900">
    <div class="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-3 mb-2">
            <button
              on:click={() => goto('/investigations')}
              class="text-indigo-300 hover:text-white transition-colors flex items-center gap-1 text-sm"
              aria-label="Back to investigations"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span class="hidden sm:inline">Investigations</span>
            </button>
            <div class="w-px h-5 bg-white/20"></div>
            <h1 class="text-xl font-bold text-white truncate">{investigation.name}</h1>
          </div>

          <div class="flex items-center flex-wrap gap-2">
            {#each keywords as keyword, i}
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/15 text-indigo-200">
                {keyword}
              </span>
            {/each}

            {#if dateStart || dateEnd}
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-slate-300 ml-2">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(dateStart)} - {formatDate(dateEnd)}
              </span>
            {/if}

            <!-- Brush reset button (visible when time range differs from original) -->
            {#if $investigationSelection.timeRange && ($investigationSelection.timeRange.start !== dateStart || $investigationSelection.timeRange.end !== dateEnd)}
              <button
                on:click={resetBrush}
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors ml-1"
              >
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset range
              </button>
            {/if}
          </div>
        </div>

        <!-- Source toggles + actions -->
        <div class="flex items-center space-x-4 ml-6 flex-shrink-0">
          <div class="flex items-center space-x-2">
            <button
              on:click={() => toggleSourceEnabled('gdelt')}
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {sourcesEnabled.gdelt ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40' : 'bg-white/5 text-slate-400 hover:bg-white/10'}"
            >
              GDELT
            </button>
            <button
              on:click={() => toggleSourceEnabled('radio')}
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {sourcesEnabled.radio ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' : 'bg-white/5 text-slate-400 hover:bg-white/10'}"
            >
              Radio
            </button>
            <button
              on:click={() => toggleSourceEnabled('social')}
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {sourcesEnabled.social ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40' : 'bg-white/5 text-slate-400 hover:bg-white/10'}"
            >
              Social
            </button>
          </div>

          <button
            on:click={() => showAnnotations = !showAnnotations}
            class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors {showAnnotations ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
          >
            Notes {annotations.length > 0 ? `(${annotations.length})` : ''}
          </button>
          <button
            on:click={handleExport}
            class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
          >
            Export
          </button>
          <button
            on:click={handleSave}
            class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
    <!-- Annotations Panel (collapsible) -->
    {#if showAnnotations}
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-amber-800 mb-3">Research Notes</h3>
        <div class="space-y-2 mb-3">
          {#each annotations as annotation, ai}
            <div class="flex items-start gap-2 bg-white rounded-lg p-3 border border-amber-100">
              <div class="flex-1">
                <p class="text-sm text-gray-700">{annotation.text}</p>
                <p class="text-xs text-gray-400 mt-1">{new Date(annotation.timestamp).toLocaleString()}</p>
              </div>
              <button on:click={() => removeAnnotation(annotation.id)} class="text-gray-400 hover:text-red-500 text-xs">✕</button>
            </div>
          {/each}
          {#if annotations.length === 0}
            <p class="text-xs text-amber-600">No notes yet. Add your research findings below.</p>
          {/if}
        </div>
        <div class="flex gap-2">
          <input
            bind:value={newAnnotation}
            placeholder="Add a research note..."
            class="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            on:keydown={(e) => { if (e.key === 'Enter') addAnnotation(); }}
          />
          <button on:click={addAnnotation} class="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-500 transition-colors">
            Add Note
          </button>
        </div>
      </div>
    {/if}

    <!-- Band B: Swim-Lane Timeline -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-700">Timeline</h2>
        {#if $investigationSelection.timeRange}
          <span class="text-xs text-gray-500">
            Viewing: {formatDate($investigationSelection.timeRange.start)} - {formatDate($investigationSelection.timeRange.end)}
          </span>
        {/if}
      </div>
      <div class="p-2">
        {#if timelineLoading}
          <div class="flex items-center justify-center h-[280px]">
            <svg class="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span class="ml-2 text-sm text-gray-500">Loading timeline...</span>
          </div>
        {:else}
          <SwimLaneTimeline
            data={timelineData}
            height={280}
            on:brushChange={handleBrushChange}
            on:dayClick={handleDayClick}
          />
        {/if}
      </div>
    </div>

    <!-- Band C: Three-column Detail Panels -->
    <div class="grid grid-cols-1 {gridCols} gap-6" style="min-height: 500px;">
      <!-- Left: GDELT Events -->
      {#if sourcesEnabled.gdelt}
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style="max-height: 600px;">
          {#if gdeltLoading}
            <div class="flex items-center justify-center flex-1 py-12">
              <svg class="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <span class="ml-2 text-sm text-gray-500">Loading GDELT events...</span>
            </div>
          {:else}
            <GdeltEventPanel events={gdeltEvents} />
          {/if}
        </div>
      {/if}

      <!-- Center: Radio Transcripts -->
      {#if sourcesEnabled.radio}
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style="max-height: 600px;">
          {#if radioLoading}
            <div class="flex items-center justify-center flex-1 py-12">
              <svg class="animate-spin h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <span class="ml-2 text-sm text-gray-500">Loading radio segments...</span>
            </div>
          {:else}
            <RadioTranscriptPanel segments={radioSegments} />
          {/if}
        </div>
      {/if}

      <!-- Right: Social Posts -->
      {#if sourcesEnabled.social}
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style="max-height: 600px;">
          {#if socialLoading}
            <div class="flex items-center justify-center flex-1 py-12">
              <svg class="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <span class="ml-2 text-sm text-gray-500">Loading social posts...</span>
            </div>
          {:else}
            <SocialPostPanel posts={socialPosts} />
          {/if}
        </div>
      {/if}
    </div>

    <!-- Band D: Insights -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-700">Insights</h2>
        <button
          on:click={() => paletteOpen = !paletteOpen}
          class="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors {paletteOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
        >
          {paletteOpen ? 'Close Palette' : 'Add Visualization'}
        </button>
      </div>

      <div class="flex">
        <!-- Main insights area -->
        <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-100">
          <!-- Sentiment Distribution (D3 donut chart) -->
          <div class="bg-white p-4">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sentiment Distribution</h3>
            {#if gdeltLoading && radioLoading && socialLoading}
              <div class="flex items-center justify-center h-48">
                <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
            {:else}
              <SentimentDistribution data={sentimentChartData} on:segmentClick={handleSentimentFilter} />
            {/if}
          </div>

          <!-- Parallel Coordinates -->
          <div class="bg-white p-4">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Parallel Coordinates</h3>
            {#if timelineData.length > 0}
              <ParallelCoordinates data={timelineData} />
            {:else}
              <div class="flex items-center justify-center h-48 text-gray-400 text-sm">No timeline data for parallel coords</div>
            {/if}
          </div>

          <!-- Lag Analysis -->
          <div class="bg-white p-4">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Lag / Lead Analysis</h3>
            {#if timelineData.length > 2}
              <LagAnalysisChart data={timelineData} sourceA="gdelt" sourceB="social" />
            {:else}
              <div class="flex items-center justify-center h-48 text-gray-400 text-sm">Need 3+ days of data for lag analysis</div>
            {/if}
          </div>
        </div>

        <!-- Second insights row: Keyword Network + Word Cloud -->
        <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100 border-t border-gray-100">
          <div class="bg-white p-4">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Keyword Network</h3>
            {#if keywordData.length > 0}
              <KeywordNetwork data={keywordData} />
            {:else}
              <div class="flex items-center justify-center h-48 text-gray-400 text-sm">No keyword overlap data</div>
            {/if}
          </div>
          <div class="bg-white p-4">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Word Cloud</h3>
            {#if wordCloudData.length > 0}
              <WordCloudChart words={wordCloudData} />
            {:else}
              <div class="flex items-center justify-center h-48 text-gray-400 text-sm">No word data available</div>
            {/if}
          </div>
        </div>

        <!-- Component Palette sidebar -->
        {#if paletteOpen}
          <div class="w-72 border-l border-gray-200 bg-white flex-shrink-0">
            <ComponentPalette onAddComponent={handleAddComponent} />
          </div>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <svg class="mx-auto w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Investigation not found</h2>
      <p class="text-gray-500 mb-4">The investigation you're looking for doesn't exist or has been deleted.</p>
      <button
        on:click={() => goto('/investigations')}
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Back to Investigations
      </button>
    </div>
  </div>
{/if}
