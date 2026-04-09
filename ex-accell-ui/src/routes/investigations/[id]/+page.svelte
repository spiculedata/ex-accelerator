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

  export const ssr = false;

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
  let gdeltLoading = true;
  let radioLoading = true;
  let socialLoading = true;
  let sourcesEnabled = { gdelt: true, radio: true, social: true };

  // Right-side insights drawer
  let insightsOpen = false;

  // Transcript viewer
  let expandedTranscriptId: string | number | null = null;

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

    for (const e of gdelt) {
      if (e.avgtone > 1) positive++;
      else if (e.avgtone < -1) negative++;
      else neutral++;
    }

    for (const s of radio) {
      const label = (s.sentiment || 'neutral').toLowerCase();
      if (label === 'positive') positive++;
      else if (label === 'negative') negative++;
      else neutral++;
    }

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

  function resetBrush() {
    if (dateStart && dateEnd) {
      setTimeRange(dateStart, dateEnd);
      loadDetailPanels(keywords, dateStart, dateEnd);
    }
  }

  function formatDateCompact(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function formatGdeltDate(sqldate: string | number): string {
    const s = String(sqldate);
    if (s.length !== 8) return s;
    const d = new Date(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8)));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatPostDate(timestamp: string | number | undefined): string {
    if (!timestamp) return '';
    const ts = typeof timestamp === 'number' ? timestamp : parseInt(String(timestamp));
    if (!isNaN(ts) && ts > 1e12) {
      return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (!isNaN(ts) && ts > 1e9) {
      return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    const d = new Date(String(timestamp));
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function goldsteinColor(val: number): string {
    if (val >= 5) return 'bg-emerald-600/80 text-emerald-100';
    if (val >= 2) return 'bg-emerald-700/60 text-emerald-200';
    if (val >= 0.5) return 'bg-emerald-800/40 text-emerald-300';
    if (val > -0.5) return 'bg-slate-700/50 text-slate-300';
    if (val > -2) return 'bg-rose-800/40 text-rose-300';
    if (val > -5) return 'bg-rose-700/60 text-rose-200';
    return 'bg-rose-600/80 text-rose-100';
  }

  function toneBarWidth(tone: number): number {
    return Math.min(100, Math.max(0, (tone + 10) * 5));
  }

  function sentimentDotColor(sentiment?: string): string {
    const s = (sentiment || 'neutral').toLowerCase();
    if (s === 'positive') return 'bg-emerald-500';
    if (s === 'negative') return 'bg-rose-500';
    return 'bg-slate-500';
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
          annotations: JSON.stringify(annotations)
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

  $: totalItems = gdeltEvents.length + radioSegments.length + socialPosts.length;

  // Highlight keywords in text
  function highlightKeywords(text: string): string {
    if (!keywords.length) return text;
    const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    return text.replace(regex, '<mark class="bg-amber-500/30 text-amber-200 rounded px-0.5">$1</mark>');
  }
</script>

<svelte:head>
  <title>{investigation?.name || 'Investigation'} - Workbench</title>
</svelte:head>

{#if loading}
  <div class="flex items-center justify-center h-screen bg-slate-950">
    <div class="flex items-center gap-3">
      <svg class="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <span class="text-sm text-slate-400 font-mono">Loading investigation...</span>
    </div>
  </div>
{:else if investigation}
  <div class="h-[calc(100dvh-65px)] flex flex-col bg-slate-950 overflow-hidden">

    <!-- ============ HEADER BAR (h-10) ============ -->
    <div class="h-10 flex-shrink-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700/50 flex items-center px-3 gap-2">
      <button
        on:click={() => goto('/investigations')}
        class="text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
        aria-label="Back"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <h1 class="text-xs font-semibold text-slate-200 truncate max-w-[180px]">{investigation.name}</h1>
      <div class="w-px h-4 bg-slate-700 flex-shrink-0"></div>

      <!-- Keywords -->
      <div class="flex items-center gap-1 flex-shrink-0 overflow-hidden">
        {#each keywords.slice(0, 4) as keyword}
          <span class="px-1 py-0 text-[9px] bg-slate-700 text-slate-300 rounded font-medium truncate max-w-[70px]">{keyword}</span>
        {/each}
        {#if keywords.length > 4}
          <span class="text-[9px] text-slate-500">+{keywords.length - 4}</span>
        {/if}
      </div>

      <!-- Date Range -->
      {#if dateStart || dateEnd}
        <span class="text-[9px] font-mono text-slate-500 flex-shrink-0">
          {formatDateCompact(dateStart)}-{formatDateCompact(dateEnd)}
        </span>
      {/if}

      <!-- Brush reset -->
      {#if $investigationSelection.timeRange && ($investigationSelection.timeRange.start !== dateStart || $investigationSelection.timeRange.end !== dateEnd)}
        <button on:click={resetBrush} class="text-[9px] text-amber-400 hover:text-amber-300 flex-shrink-0" title="Reset">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      {/if}

      <div class="flex-1"></div>

      <!-- Source Toggles -->
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button
          on:click={() => toggleSourceEnabled('gdelt')}
          class="flex items-center gap-0.5 text-[9px] uppercase tracking-wider transition-colors {sourcesEnabled.gdelt ? 'text-amber-400' : 'text-slate-600'}"
        >
          <span class="w-1.5 h-1.5 rounded-full {sourcesEnabled.gdelt ? 'bg-amber-500' : 'bg-slate-700'}"></span>
          GDELT
        </button>
        <button
          on:click={() => toggleSourceEnabled('radio')}
          class="flex items-center gap-0.5 text-[9px] uppercase tracking-wider transition-colors {sourcesEnabled.radio ? 'text-violet-400' : 'text-slate-600'}"
        >
          <span class="w-1.5 h-1.5 rounded-full {sourcesEnabled.radio ? 'bg-violet-500' : 'bg-slate-700'}"></span>
          Radio
        </button>
        <button
          on:click={() => toggleSourceEnabled('social')}
          class="flex items-center gap-0.5 text-[9px] uppercase tracking-wider transition-colors {sourcesEnabled.social ? 'text-sky-400' : 'text-slate-600'}"
        >
          <span class="w-1.5 h-1.5 rounded-full {sourcesEnabled.social ? 'bg-sky-500' : 'bg-slate-700'}"></span>
          Social
        </button>
      </div>

      <div class="w-px h-4 bg-slate-700 flex-shrink-0"></div>

      <!-- Insights toggle -->
      <button
        on:click={() => insightsOpen = !insightsOpen}
        class="p-1 rounded transition-colors {insightsOpen ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-slate-300'}"
        title="Insights ({totalItems} items)"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>

      <!-- Notes -->
      <button
        on:click={() => showAnnotations = !showAnnotations}
        class="relative p-1 rounded transition-colors {showAnnotations ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'}"
        title="Notes"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        {#if annotations.length > 0}
          <span class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full text-[7px] text-white flex items-center justify-center">{annotations.length}</span>
        {/if}
      </button>

      <!-- Export & Save -->
      <button on:click={handleExport} class="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors" title="Export">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>
      <button
        on:click={handleSave}
        class="p-1 rounded transition-colors {saveStatus === 'saved' ? 'text-emerald-400' : saveStatus === 'saving' ? 'text-indigo-400 animate-pulse' : 'text-slate-500 hover:text-slate-300'}"
        title={saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {#if saveStatus === 'saved'}
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          {:else}
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          {/if}
        </svg>
      </button>
    </div>

    <!-- ============ ANNOTATIONS (conditional) ============ -->
    {#if showAnnotations}
      <div class="flex-shrink-0 bg-slate-900 border-b border-slate-700/50 px-3 py-1.5">
        <div class="flex items-center gap-2">
          <div class="flex-1 flex flex-wrap gap-1">
            {#each annotations as annotation}
              <div class="flex items-center gap-1 bg-slate-800 border border-slate-700/50 rounded px-1.5 py-0.5 max-w-[200px]">
                <p class="text-[9px] text-slate-300 truncate">{annotation.text}</p>
                <button on:click={() => removeAnnotation(annotation.id)} class="text-slate-600 hover:text-rose-400 text-[9px] flex-shrink-0">x</button>
              </div>
            {/each}
            {#if annotations.length === 0}
              <span class="text-[9px] text-slate-600">No notes yet</span>
            {/if}
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <input
              bind:value={newAnnotation}
              placeholder="Add note..."
              class="w-40 px-1.5 py-0.5 text-[9px] bg-slate-800 border border-slate-700 rounded text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              on:keydown={(e) => { if (e.key === 'Enter') addAnnotation(); }}
            />
            <button on:click={addAnnotation} class="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-medium rounded transition-colors">
              Add
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- ============ TIMELINE (compact sparkline) ============ -->
    <div class="flex-shrink-0 bg-slate-900 border-b border-slate-700/50" style="height: 88px;">
      <div class="h-full flex flex-col">
        <div class="px-3 py-0.5 flex items-center justify-between flex-shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Timeline</span>
            {#if $investigationSelection.timeRange}
              <span class="text-[9px] font-mono text-slate-500">
                {formatDateCompact($investigationSelection.timeRange.start)} - {formatDateCompact($investigationSelection.timeRange.end)}
              </span>
            {/if}
          </div>
          <span class="text-[9px] font-mono text-slate-600">{timelineData.length} days</span>
        </div>
        <div class="flex-1 min-h-0 px-1">
          {#if timelineLoading}
            <div class="flex items-center justify-center h-full">
              <svg class="animate-spin h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            </div>
          {:else}
            <SwimLaneTimeline
              data={timelineData}
              height={72}
              on:brushChange={handleBrushChange}
              on:dayClick={handleDayClick}
            />
          {/if}
        </div>
      </div>
    </div>

    <!-- ============ MAIN CONTENT AREA ============ -->
    <div class="flex-1 min-h-0 flex relative">

      <!-- Data Panels -->
      <div class="flex-1 min-h-0 flex gap-px p-1">

        <!-- GDELT Panel -->
        {#if sourcesEnabled.gdelt}
          {#if gdeltLoading}
            <div class="flex-1 bg-slate-900 border border-slate-700/50 rounded flex flex-col min-w-0">
              <div class="px-2 py-1 bg-slate-800 border-b border-slate-700/50 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span class="text-[10px] font-semibold text-slate-200">GDELT Events</span>
              </div>
              <div class="flex-1 flex items-center justify-center">
                <svg class="animate-spin h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
            </div>
          {:else if gdeltEvents.length === 0}
            <div class="w-32 bg-slate-900/50 border border-slate-700/30 rounded flex items-center px-2 py-1 gap-1 flex-shrink-0">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500/30"></span>
              <span class="text-[9px] text-slate-500">GDELT 0</span>
            </div>
          {:else}
            <div class="flex-1 bg-slate-900 border border-slate-700/50 rounded flex flex-col min-w-0">
              <div class="px-2 py-1 bg-slate-800 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span class="text-[10px] font-semibold text-slate-200">GDELT</span>
                </div>
                <span class="px-1 py-0 text-[9px] font-medium bg-amber-500/20 text-amber-400 rounded">{gdeltEvents.length >= 100 ? '100+' : gdeltEvents.length}</span>
              </div>
              <div class="flex-1 overflow-y-auto min-h-0">
                <table class="w-full text-[10px]">
                  <thead class="sticky top-0 z-10">
                    <tr class="bg-slate-800/90 backdrop-blur-sm">
                      <th class="text-left uppercase tracking-wider text-slate-500 font-medium px-1.5 py-0.5">Date</th>
                      <th class="text-left uppercase tracking-wider text-slate-500 font-medium px-1.5 py-0.5">Actor</th>
                      <th class="text-center uppercase tracking-wider text-slate-500 font-medium px-1.5 py-0.5">Gold.</th>
                      <th class="text-left uppercase tracking-wider text-slate-500 font-medium px-1.5 py-0.5">Tone</th>
                      <th class="text-right uppercase tracking-wider text-slate-500 font-medium px-1.5 py-0.5">Arts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each gdeltEvents as event}
                      <tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td class="px-1.5 py-0.5 text-slate-400 font-mono whitespace-nowrap">{formatGdeltDate(event.sqldate)}</td>
                        <td class="px-1.5 py-0.5 text-slate-300 truncate max-w-[100px]" title="{event.actor1name || ''}{event.actor2name ? ' > ' + event.actor2name : ''}">
                          {event.actor1name || '-'}
                          {#if event.actor2name}
                            <span class="text-slate-600">&gt;</span><span class="text-slate-400">{event.actor2name}</span>
                          {/if}
                        </td>
                        <td class="px-1.5 py-0.5 text-center">
                          <span class="inline-block px-1 py-0 rounded text-[9px] font-mono font-medium {goldsteinColor(event.goldsteinscale)}">
                            {event.goldsteinscale > 0 ? '+' : ''}{event.goldsteinscale.toFixed(1)}
                          </span>
                        </td>
                        <td class="px-1.5 py-0.5">
                          <div class="flex items-center gap-0.5">
                            <div class="w-10 h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                class="h-full rounded-full {event.avgtone >= 0 ? 'bg-emerald-500/70' : 'bg-rose-500/70'}"
                                style="width: {toneBarWidth(event.avgtone)}%"
                              ></div>
                            </div>
                            <span class="text-[9px] font-mono text-slate-500">{event.avgtone.toFixed(1)}</span>
                          </div>
                        </td>
                        <td class="px-1.5 py-0.5 text-right font-mono text-slate-500">{event.numarticles || '-'}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/if}
        {/if}

        <!-- Radio Panel -->
        {#if sourcesEnabled.radio}
          {#if radioLoading}
            <div class="flex-1 bg-slate-900 border border-slate-700/50 rounded flex flex-col min-w-0">
              <div class="px-2 py-1 bg-slate-800 border-b border-slate-700/50 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                <span class="text-[10px] font-semibold text-slate-200">Radio</span>
              </div>
              <div class="flex-1 flex items-center justify-center">
                <svg class="animate-spin h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
            </div>
          {:else if radioSegments.length === 0}
            <div class="w-32 bg-slate-900/50 border border-slate-700/30 rounded flex items-center px-2 py-1 gap-1 flex-shrink-0">
              <span class="w-1.5 h-1.5 rounded-full bg-violet-500/30"></span>
              <span class="text-[9px] text-slate-500">Radio 0</span>
            </div>
          {:else}
            <div class="flex-1 bg-slate-900 border border-slate-700/50 rounded flex flex-col min-w-0">
              <div class="px-2 py-1 bg-slate-800 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                  <span class="text-[10px] font-semibold text-slate-200">Radio</span>
                </div>
                <span class="px-1 py-0 text-[9px] font-medium bg-violet-500/20 text-violet-400 rounded">{radioSegments.length}</span>
              </div>
              <div class="flex-1 overflow-y-auto min-h-0">
                {#each radioSegments as segment}
                  <div
                    class="px-2 py-1 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                    on:click={() => expandedTranscriptId = expandedTranscriptId === segment.id ? null : segment.id}
                    on:keydown={(e) => { if (e.key === 'Enter') expandedTranscriptId = expandedTranscriptId === segment.id ? null : segment.id; }}
                    role="button"
                    tabindex="0"
                  >
                    <div class="flex items-center justify-between mb-0.5">
                      <div class="flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full {sentimentDotColor(segment.sentiment)}"></span>
                        <span class="text-[9px] font-semibold text-slate-300">{segment.radio_name}</span>
                        {#if segment.state}
                          <span class="text-[9px] text-slate-600">{segment.state}</span>
                        {/if}
                      </div>
                      <div class="flex items-center gap-1">
                        {#if segment.is_political}
                          <span class="px-0.5 py-0 text-[7px] uppercase tracking-wider bg-rose-500/20 text-rose-400 rounded font-medium">POL</span>
                        {/if}
                        <span class="text-[9px] font-mono text-slate-600">{Math.floor(segment.duration_seconds / 60)}m{(segment.duration_seconds % 60).toString().padStart(2, '0')}s</span>
                        <svg class="w-2.5 h-2.5 text-slate-600 transition-transform {expandedTranscriptId === segment.id ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {#if expandedTranscriptId === segment.id}
                      <!-- Full transcript view -->
                      <div class="mt-1 p-2 bg-slate-800/50 rounded border border-slate-700/30">
                        <div class="flex items-center gap-2 mb-1.5 pb-1 border-b border-slate-700/30">
                          <span class="text-[9px] font-medium text-slate-400">Full Transcript</span>
                          {#if segment.emotion}
                            <span class="text-[8px] px-1 py-0 bg-slate-700 text-slate-400 rounded">{segment.emotion}</span>
                          {/if}
                          {#if segment.confidence}
                            <span class="text-[8px] font-mono text-slate-500">{(segment.confidence * 100).toFixed(0)}% conf</span>
                          {/if}
                        </div>
                        <p class="text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap">{@html highlightKeywords(segment.transcript)}</p>
                      </div>
                    {:else}
                      <p class="text-[10px] text-slate-400 leading-tight line-clamp-2">{segment.transcript}</p>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}

        <!-- Social Panel -->
        {#if sourcesEnabled.social}
          {#if socialLoading}
            <div class="flex-1 bg-slate-900 border border-slate-700/50 rounded flex flex-col min-w-0">
              <div class="px-2 py-1 bg-slate-800 border-b border-slate-700/50 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                <span class="text-[10px] font-semibold text-slate-200">Social</span>
              </div>
              <div class="flex-1 flex items-center justify-center">
                <svg class="animate-spin h-4 w-4 text-sky-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
            </div>
          {:else if socialPosts.length === 0}
            <div class="w-32 bg-slate-900/50 border border-slate-700/30 rounded flex items-center px-2 py-1 gap-1 flex-shrink-0">
              <span class="w-1.5 h-1.5 rounded-full bg-sky-500/30"></span>
              <span class="text-[9px] text-slate-500">Social 0</span>
            </div>
          {:else}
            <div class="flex-1 bg-slate-900 border border-slate-700/50 rounded flex flex-col min-w-0">
              <div class="px-2 py-1 bg-slate-800 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                  <span class="text-[10px] font-semibold text-slate-200">Social</span>
                </div>
                <span class="px-1 py-0 text-[9px] font-medium bg-sky-500/20 text-sky-400 rounded">{socialPosts.length >= 100 ? '100+' : socialPosts.length}</span>
              </div>
              <div class="flex-1 overflow-y-auto min-h-0">
                {#each socialPosts as post}
                  <div class="px-2 py-1 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <div class="flex items-center justify-between mb-0.5">
                      <div class="flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full {sentimentDotColor(post.sentiment_category)}"></span>
                        {#if post.platform}
                          <span class="text-[9px] font-medium text-slate-400">{post.platform}</span>
                        {/if}
                      </div>
                      <div class="flex items-center gap-1">
                        {#if post.confidence_score}
                          <span class="text-[9px] font-mono text-slate-600">{(post.confidence_score * 100).toFixed(0)}%</span>
                        {/if}
                        {#if post.timestamp}
                          <span class="text-[9px] font-mono text-slate-600">{formatPostDate(post.timestamp)}</span>
                        {/if}
                      </div>
                    </div>
                    <p class="text-[10px] text-slate-400 leading-tight line-clamp-2">{post.text}</p>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}

      </div>

      <!-- ============ INSIGHTS DRAWER (right overlay) ============ -->
      {#if insightsOpen}
        <div class="absolute top-0 right-0 h-full w-80 bg-slate-900 border-l border-slate-700/50 shadow-2xl z-20 flex flex-col overflow-hidden">
          <!-- Drawer header -->
          <div class="px-3 py-1.5 bg-slate-800 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Insights</span>
              <span class="text-[9px] text-slate-600 font-mono">{totalItems} items</span>
            </div>
            <button on:click={() => insightsOpen = false} class="text-slate-500 hover:text-slate-300 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Scrollable insights content -->
          <div class="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">

            <!-- Sentiment -->
            <div class="bg-slate-800/50 border border-slate-700/30 rounded">
              <div class="px-2 py-1 border-b border-slate-700/30">
                <span class="text-[9px] uppercase tracking-wider text-slate-500 font-medium">Sentiment Distribution</span>
              </div>
              <div class="p-2" style="height: 180px;">
                {#if gdeltLoading && radioLoading && socialLoading}
                  <div class="flex items-center justify-center h-full">
                    <svg class="animate-spin h-3 w-3 text-slate-600" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  </div>
                {:else}
                  <SentimentDistribution data={sentimentChartData} on:segmentClick={handleSentimentFilter} />
                {/if}
              </div>
            </div>

            <!-- Parallel Coordinates -->
            <div class="bg-slate-800/50 border border-slate-700/30 rounded">
              <div class="px-2 py-1 border-b border-slate-700/30">
                <span class="text-[9px] uppercase tracking-wider text-slate-500 font-medium">Parallel Coordinates</span>
              </div>
              <div class="p-1">
                {#if timelineData.length > 0}
                  <ParallelCoordinates data={timelineData} height={200} />
                {:else}
                  <div class="flex items-center justify-center h-24">
                    <span class="text-[9px] text-slate-600">No data</span>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Lag Analysis -->
            <div class="bg-slate-800/50 border border-slate-700/30 rounded">
              <div class="px-2 py-1 border-b border-slate-700/30">
                <span class="text-[9px] uppercase tracking-wider text-slate-500 font-medium">Lag Analysis</span>
              </div>
              <div class="p-1">
                {#if timelineData.length > 2}
                  <LagAnalysisChart data={timelineData} sourceA="gdelt" sourceB="social" chartHeight={180} />
                {:else}
                  <div class="flex items-center justify-center h-24">
                    <span class="text-[9px] text-slate-600">Need 3+ days</span>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Keywords -->
            <div class="bg-slate-800/50 border border-slate-700/30 rounded">
              <div class="px-2 py-1 border-b border-slate-700/30">
                <span class="text-[9px] uppercase tracking-wider text-slate-500 font-medium">Keywords</span>
                {#if keywordData.length > 0}
                  <span class="text-[8px] text-slate-600 ml-1">({keywordData.length} terms)</span>
                {/if}
              </div>
              <div class="p-1">
                {#if keywordData.length > 0}
                  <!-- Keyword table showing cross-source counts -->
                  <div class="space-y-0.5 mb-2">
                    {#each keywordData.slice(0, 10) as kw}
                      <div class="flex items-center justify-between px-1.5 py-0.5 rounded hover:bg-slate-700/30">
                        <span class="text-[10px] text-slate-300 font-medium truncate max-w-[100px]">{kw.keyword}</span>
                        <div class="flex items-center gap-2 text-[9px] font-mono">
                          <span class="text-amber-400" title="GDELT">{kw.gdelt_count || 0}</span>
                          <span class="text-violet-400" title="Radio">{kw.radio_count || 0}</span>
                          <span class="text-sky-400" title="Social">{kw.social_count || 0}</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                  <KeywordNetwork data={keywordData} height={180} />
                {:else if wordCloudData.length > 0}
                  <WordCloudChart words={wordCloudData} />
                {:else}
                  <div class="flex items-center justify-center h-20">
                    <span class="text-[9px] text-slate-600">No keyword data</span>
                  </div>
                {/if}
              </div>
            </div>

          </div>
        </div>
      {/if}

    </div>

  </div>
{:else}
  <div class="flex items-center justify-center h-screen bg-slate-950">
    <div class="text-center">
      <svg class="mx-auto w-10 h-10 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <h2 class="text-sm font-semibold text-slate-300 mb-1">Investigation not found</h2>
      <p class="text-xs text-slate-500 mb-4">This investigation doesn't exist or has been deleted.</p>
      <button
        on:click={() => goto('/investigations')}
        class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition-colors"
      >
        Back to Investigations
      </button>
    </div>
  </div>
{/if}
