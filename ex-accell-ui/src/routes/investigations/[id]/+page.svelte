<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { investigationSelection, clearSelection, setTimeRange, toggleSelectedId, setHoveredId, setSourceFilter } from '$lib/stores/investigationStore';

  interface Investigation {
    id: string;
    name: string;
    description: string;
    keywords: string[];
    date_start: string;
    date_end: string;
    sources: string[];
    created_at: string;
    query_config?: any;
  }

  interface GdeltEvent {
    id: string;
    date: string;
    actor1: string;
    actor2: string;
    goldstein_scale: number;
    avg_tone: number;
    location: string;
    event_code: string;
  }

  interface RadioSegment {
    id: string;
    station: string;
    timestamp: string;
    sentiment: string;
    sentiment_score: number;
    text: string;
  }

  interface SocialPost {
    id: string;
    text: string;
    sentiment: string;
    sentiment_score: number;
    platform: string;
    engagement: number;
    created_at: string;
  }

  let investigation: Investigation | null = null;
  let loading = true;
  let gdeltEvents: GdeltEvent[] = [];
  let radioSegments: RadioSegment[] = [];
  let socialPosts: SocialPost[] = [];
  let gdeltLoading = true;
  let radioLoading = true;
  let socialLoading = true;
  let expandedRadioId: string | null = null;
  let sourcesEnabled = { gdelt: true, radio: true, social: true };

  $: investigationId = $page.params.id || '';

  onMount(async () => {
    await loadInvestigation();
  });

  async function loadInvestigation() {
    loading = true;
    try {
      const response = await fetch(`/api/investigations?id=${investigationId}`);
      const result = await response.json();
      if (result.success && result.investigation) {
        investigation = result.investigation;
        const config = investigation?.query_config || {};
        const keywords = investigation?.keywords || config.keywords || [];
        const dateStart = investigation?.date_start || config.dateStart || '';
        const dateEnd = investigation?.date_end || config.dateEnd || '';

        if (dateStart && dateEnd) {
          setTimeRange(dateStart, dateEnd);
        }

        // Fetch all panel data in parallel
        await Promise.all([
          loadGdeltEvents(keywords, dateStart, dateEnd),
          loadRadioSegments(keywords, dateStart, dateEnd),
          loadSocialPosts(keywords, dateStart, dateEnd)
        ]);
      }
    } catch (error) {
      console.error('Error loading investigation:', error);
    } finally {
      loading = false;
    }
  }

  async function loadGdeltEvents(keywords: string[], dateStart: string, dateEnd: string) {
    gdeltLoading = true;
    try {
      const params = new URLSearchParams();
      if (keywords.length) params.set('keywords', keywords.join(','));
      if (dateStart) params.set('date_start', dateStart);
      if (dateEnd) params.set('date_end', dateEnd);
      params.set('investigation_id', investigationId);

      const response = await fetch(`/api/investigation-gdelt-events?${params}`);
      const result = await response.json();
      if (result.success) {
        gdeltEvents = result.events || [];
      }
    } catch (error) {
      console.error('Error loading GDELT events:', error);
    } finally {
      gdeltLoading = false;
    }
  }

  async function loadRadioSegments(keywords: string[], dateStart: string, dateEnd: string) {
    radioLoading = true;
    try {
      const params = new URLSearchParams();
      if (keywords.length) params.set('keywords', keywords.join(','));
      if (dateStart) params.set('date_start', dateStart);
      if (dateEnd) params.set('date_end', dateEnd);
      params.set('investigation_id', investigationId);

      const response = await fetch(`/api/investigation-radio-segments?${params}`);
      const result = await response.json();
      if (result.success) {
        radioSegments = result.segments || [];
      }
    } catch (error) {
      console.error('Error loading radio segments:', error);
    } finally {
      radioLoading = false;
    }
  }

  async function loadSocialPosts(keywords: string[], dateStart: string, dateEnd: string) {
    socialLoading = true;
    try {
      const params = new URLSearchParams();
      if (keywords.length) params.set('keywords', keywords.join(','));
      if (dateStart) params.set('date_start', dateStart);
      if (dateEnd) params.set('date_end', dateEnd);
      params.set('investigation_id', investigationId);

      const response = await fetch(`/api/investigation-social-posts?${params}`);
      const result = await response.json();
      if (result.success) {
        socialPosts = result.posts || [];
      }
    } catch (error) {
      console.error('Error loading social posts:', error);
    } finally {
      socialLoading = false;
    }
  }

  function selectGdeltEvent(event: GdeltEvent) {
    toggleSelectedId(event.id);
  }

  function selectSocialPost(post: SocialPost) {
    toggleSelectedId(post.id);
  }

  function toggleSourceEnabled(source: 'gdelt' | 'radio' | 'social') {
    sourcesEnabled = { ...sourcesEnabled, [source]: !sourcesEnabled[source] };
    const active = Object.entries(sourcesEnabled).filter(([, v]) => v).map(([k]) => k);
    setSourceFilter(active);
  }

  function toggleRadioExpand(segmentId: string) {
    expandedRadioId = expandedRadioId === segmentId ? null : segmentId;
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

  function formatDateTime(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  function getSentimentColor(sentiment: string): string {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'bg-emerald-100 text-emerald-800';
      case 'negative': return 'bg-red-100 text-red-800';
      case 'neutral': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  function getGoldsteinColor(value: number): string {
    if (value >= 5) return 'text-emerald-600';
    if (value >= 0) return 'text-blue-600';
    if (value >= -5) return 'text-amber-600';
    return 'text-red-600';
  }

  function truncateText(text: string, maxLen: number): string {
    if (!text || text.length <= maxLen) return text || '';
    return text.substring(0, maxLen) + '...';
  }

  function handleExport() {
    // Placeholder for export functionality
    console.log('Export investigation:', investigationId);
  }

  function handleSave() {
    // Placeholder for save functionality
    console.log('Save investigation:', investigationId);
  }
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
  <!-- Band A: Header -->
  <div class="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-3 mb-2">
            <button
              on:click={() => goto('/investigations')}
              class="text-indigo-300 hover:text-white transition-colors"
              aria-label="Back to investigations"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 class="text-2xl font-bold text-white truncate">{investigation.name}</h1>
          </div>

          <div class="flex items-center flex-wrap gap-2">
            <!-- Keywords -->
            {#each (investigation.keywords || []) as keyword}
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/15 text-indigo-200">
                {keyword}
              </span>
            {/each}

            <!-- Date range -->
            {#if investigation.date_start || investigation.date_end}
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-slate-300 ml-2">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(investigation.date_start)} - {formatDate(investigation.date_end)}
              </span>
            {/if}
          </div>
        </div>

        <!-- Source toggles + actions -->
        <div class="flex items-center space-x-4 ml-6">
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

          <div class="flex items-center space-x-2">
            <button
              on:click={handleSave}
              class="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Save
            </button>
            <button
              on:click={handleExport}
              class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
    <!-- Band B: Timeline placeholder -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h2 class="text-sm font-semibold text-gray-700">Timeline</h2>
      </div>
      <div class="flex items-center justify-center h-[280px] bg-slate-50">
        <div class="text-center">
          <svg class="mx-auto w-10 h-10 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
          <p class="text-sm text-slate-500 font-medium">Timeline visualization loading...</p>
          <p class="text-xs text-slate-400 mt-1">
            {#if investigation.date_start && investigation.date_end}
              {formatDate(investigation.date_start)} &mdash; {formatDate(investigation.date_end)}
            {:else}
              No date range specified
            {/if}
          </p>
        </div>
      </div>
    </div>

    <!-- Band C: Three-column detail panels -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left: GDELT Events -->
      {#if sourcesEnabled.gdelt}
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div class="px-5 py-3 border-b border-gray-100 bg-amber-50 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-amber-900 flex items-center">
              <span class="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
              GDELT Events
            </h2>
            <span class="text-xs text-amber-600">{gdeltEvents.length} results</span>
          </div>
          <div class="flex-1 overflow-y-auto max-h-[500px]">
            {#if gdeltLoading}
              <div class="flex items-center justify-center py-12">
                <svg class="animate-spin h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
            {:else if gdeltEvents.length === 0}
              <div class="text-center py-12 px-4">
                <p class="text-sm text-gray-500">No GDELT events found for these keywords.</p>
              </div>
            {:else}
              <table class="w-full text-xs">
                <thead class="bg-gray-50 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500">Actors</th>
                    <th class="px-3 py-2 text-right font-medium text-gray-500">Gold.</th>
                    <th class="px-3 py-2 text-right font-medium text-gray-500">Tone</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500">Location</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {#each gdeltEvents as event}
                    <tr
                      class="hover:bg-amber-50 cursor-pointer transition-colors {$investigationSelection.selectedIds.has(event.id) ? 'bg-amber-100' : ''}"
                      on:click={() => selectGdeltEvent(event)}
                    >
                      <td class="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDate(event.date)}</td>
                      <td class="px-3 py-2 text-gray-900">
                        <span class="truncate block max-w-[100px]" title="{event.actor1} / {event.actor2}">
                          {event.actor1 || '?'} / {event.actor2 || '?'}
                        </span>
                      </td>
                      <td class="px-3 py-2 text-right font-mono {getGoldsteinColor(event.goldstein_scale)}">
                        {event.goldstein_scale?.toFixed(1) || '-'}
                      </td>
                      <td class="px-3 py-2 text-right font-mono text-gray-600">
                        {event.avg_tone?.toFixed(1) || '-'}
                      </td>
                      <td class="px-3 py-2 text-gray-600">
                        <span class="truncate block max-w-[80px]" title={event.location}>
                          {event.location || '-'}
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Center: Radio Transcripts -->
      {#if sourcesEnabled.radio}
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div class="px-5 py-3 border-b border-gray-100 bg-emerald-50 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-emerald-900 flex items-center">
              <span class="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
              Radio Transcripts
            </h2>
            <span class="text-xs text-emerald-600">{radioSegments.length} results</span>
          </div>
          <div class="flex-1 overflow-y-auto max-h-[500px]">
            {#if radioLoading}
              <div class="flex items-center justify-center py-12">
                <svg class="animate-spin h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
            {:else if radioSegments.length === 0}
              <div class="text-center py-12 px-4">
                <p class="text-sm text-gray-500">No radio transcripts found for these keywords.</p>
              </div>
            {:else}
              <div class="divide-y divide-gray-100">
                {#each radioSegments as segment}
                  <button
                    class="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors"
                    on:click={() => toggleRadioExpand(segment.id)}
                  >
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-xs font-semibold text-gray-900">{segment.station}</span>
                      <div class="flex items-center space-x-2">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium {getSentimentColor(segment.sentiment)}">
                          {segment.sentiment}
                        </span>
                        <span class="text-xs text-gray-400">{formatDateTime(segment.timestamp)}</span>
                      </div>
                    </div>
                    <p class="text-xs text-gray-600 leading-relaxed">
                      {#if expandedRadioId === segment.id}
                        {segment.text}
                      {:else}
                        {truncateText(segment.text, 150)}
                      {/if}
                    </p>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Right: Social Posts -->
      {#if sourcesEnabled.social}
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div class="px-5 py-3 border-b border-gray-100 bg-blue-50 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-blue-900 flex items-center">
              <span class="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
              Social Posts
            </h2>
            <span class="text-xs text-blue-600">{socialPosts.length} results</span>
          </div>
          <div class="flex-1 overflow-y-auto max-h-[500px]">
            {#if socialLoading}
              <div class="flex items-center justify-center py-12">
                <svg class="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
            {:else if socialPosts.length === 0}
              <div class="text-center py-12 px-4">
                <p class="text-sm text-gray-500">No social posts found for these keywords.</p>
              </div>
            {:else}
              <div class="divide-y divide-gray-100">
                {#each socialPosts as post}
                  <button
                    class="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors {$investigationSelection.selectedIds.has(post.id) ? 'bg-blue-100' : ''}"
                    on:click={() => selectSocialPost(post)}
                  >
                    <p class="text-xs text-gray-800 leading-relaxed mb-2">
                      {truncateText(post.text, 200)}
                    </p>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-2">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium {getSentimentColor(post.sentiment)}">
                          {post.sentiment}
                        </span>
                        <span class="text-xs text-gray-400 capitalize">{post.platform}</span>
                      </div>
                      <div class="flex items-center text-xs text-gray-400">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {post.engagement || 0}
                      </div>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Band D: Insights placeholder -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h2 class="text-sm font-semibold text-gray-700">Insights</h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-100">
        {#each [1, 2, 3] as slot}
          <div class="bg-white flex items-center justify-center py-16">
            <button class="flex flex-col items-center text-gray-400 hover:text-indigo-500 transition-colors group">
              <div class="w-12 h-12 rounded-xl border-2 border-dashed border-gray-300 group-hover:border-indigo-400 flex items-center justify-center mb-2 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span class="text-xs font-medium">Add visualization</span>
            </button>
          </div>
        {/each}
      </div>
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
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
