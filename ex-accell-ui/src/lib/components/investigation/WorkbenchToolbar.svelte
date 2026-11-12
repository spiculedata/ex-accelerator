<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { formatDay } from '$lib/utils/dayFormat';

  export let name: string;
  export let keywords: string[];
  export let dateStart: string;
  export let dateEnd: string;
  /** The range currently brushed on the timeline, if any */
  export let timeRange: { start: string; end: string } | null;
  export let showAnnotations: boolean;
  export let annotationCount: number;
  export let saveStatus: '' | 'saving' | 'saved' | 'error';
  export let saveErrorMessage: string;
  export let unsaved: boolean;

  const dispatch = createEventDispatcher<{ resetBrush: void; exportCsv: void; exportJson: void; save: void }>();
</script>

<!-- ============ HEADER BAR ============ -->
<div class="h-9 flex-shrink-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700/50 flex items-center px-3 gap-2">
  <button on:click={() => goto('/investigations')} class="text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0" aria-label="Back">
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  </button>
  <h1 class="text-xs font-semibold text-slate-200 truncate max-w-[200px]">{name}</h1>
  <div class="w-px h-4 bg-slate-700 flex-shrink-0"></div>

  <div class="flex items-center gap-1 flex-shrink-0 overflow-hidden">
    {#each keywords.slice(0, 4) as keyword}
      <span class="px-1 py-0 text-[9px] bg-indigo-500/20 text-indigo-300 rounded font-medium truncate max-w-[70px]">{keyword}</span>
    {/each}
  </div>

  {#if dateStart || dateEnd}
    <span class="text-[11px] font-mono text-slate-500 flex-shrink-0">{formatDay(dateStart)}-{formatDay(dateEnd)}</span>
  {/if}

  {#if timeRange && (timeRange.start !== dateStart || timeRange.end !== dateEnd)}
    <button on:click={() => dispatch('resetBrush')} class="text-[9px] text-amber-400 hover:text-amber-300 flex-shrink-0" title="Reset time range" aria-label="Reset time range">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  {/if}

  <div class="flex-1"></div>

  <!-- Notes toggle -->
  <button
    on:click={() => showAnnotations = !showAnnotations}
    class="relative p-1 rounded transition-colors {showAnnotations ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'}"
    title="Notes"
    aria-label="Notes"
    aria-pressed={showAnnotations}
  >
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
    {#if annotationCount > 0}
      <span class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full text-[7px] text-white flex items-center justify-center">{annotationCount}</span>
    {/if}
  </button>
  <button on:click={() => dispatch('exportCsv')} class="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors text-xs font-semibold" title="Export posts as CSV (text starting with = + - @ is prefixed with an apostrophe; JSON is verbatim)" aria-label="Export posts as CSV">CSV</button>
  <button on:click={() => dispatch('exportJson')} class="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors" title="Export everything as JSON" aria-label="Export everything as JSON">
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  </button>
  <button
    on:click={() => dispatch('save')}
    class="relative p-1 rounded transition-colors {saveStatus === 'saved' ? 'text-emerald-400' : saveStatus === 'error' ? 'text-danger-400' : saveStatus === 'saving' ? 'text-indigo-400 animate-pulse' : 'text-slate-500 hover:text-slate-300'}"
    title={saveStatus === 'error' ? (saveErrorMessage || 'Could not save. Click to try again') : unsaved ? 'Save (you have unsaved changes)' : 'Save'}
    aria-label={saveStatus === 'error' ? 'Could not save. Try again' : unsaved ? 'Save, you have unsaved changes' : 'Save'}
  >
    {#if unsaved && saveStatus !== 'saving'}
      <span class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-signal-500 rounded-full" aria-hidden="true"></span>
    {/if}
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {#if saveStatus === 'saved'}
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      {:else}
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      {/if}
    </svg>
  </button>
</div>
