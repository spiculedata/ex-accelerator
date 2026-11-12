<script lang="ts">
  import { setCrossFilter } from '$lib/stores/investigationStore';
  import { highlightKeywords } from '$lib/utils/highlight';
  import { sentimentDotColor } from '$lib/utils/investigationFormat';
  import type { RadioSegment } from '$lib/utils/investigationTypes';

  export let loading: boolean;
  /** Segments after the cross-filter */
  export let segments: RadioSegment[];
  export let keywords: string[];
  export let expandedId: string | number | null;
</script>

<div role="tabpanel" id="panel-radio" aria-labelledby="tab-radio" class="h-full">
{#if loading}
  <div class="flex items-center justify-center h-full"><svg class="animate-spin h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg></div>
{:else if segments.length === 0}
  <div class="flex items-center justify-center h-full text-slate-500 text-sm">No radio transcripts found</div>
{:else}
  <div class="h-full overflow-y-auto">
    <div class="divide-y divide-slate-800/50">
      {#each segments as segment}
        <div
          class="px-4 py-2.5 hover:bg-slate-800/30 transition-colors cursor-pointer"
          on:click={() => expandedId = expandedId === segment.id ? null : segment.id}
          on:keydown={(e) => { if (e.key === 'Enter') expandedId = expandedId === segment.id ? null : segment.id; }}
          role="button"
          tabindex="0"
        >
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <span class="w-2 h-2 rounded-full cursor-pointer hover:ring-2 hover:ring-indigo-400/40 {sentimentDotColor(segment.sentiment)}" on:click|stopPropagation={() => { if (segment.sentiment) setCrossFilter({ dimension: 'sentiment', value: segment.sentiment.toLowerCase(), label: segment.sentiment }); }} role="button" tabindex="0"></span>
              <span class="text-xs font-semibold text-slate-200">{segment.radio_name}</span>
              {#if segment.state}
                <span class="text-[10px] text-slate-500">{segment.state}</span>
              {/if}
              {#if segment.is_political}
                <span class="px-1 py-0 text-[8px] uppercase tracking-wider bg-rose-500/20 text-rose-400 rounded font-medium">Political</span>
              {/if}
            </div>
            <div class="flex items-center gap-2">
              {#if segment.emotion}
                <span class="text-[10px] px-1.5 py-0 bg-slate-800 text-slate-400 rounded">{segment.emotion}</span>
              {/if}
              {#if segment.confidence}
                <span class="text-[10px] font-mono text-slate-500">{(segment.confidence * 100).toFixed(0)}%</span>
              {/if}
              <span class="text-[10px] font-mono text-slate-600">{Math.floor(segment.duration_seconds / 60)}m{(segment.duration_seconds % 60).toString().padStart(2, '0')}s</span>
              <svg class="w-3 h-3 text-slate-600 transition-transform {expandedId === segment.id ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {#if expandedId === segment.id}
            <div class="mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
              <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700/30">
                <span class="text-[10px] font-semibold text-slate-300">Full Transcript</span>
                <span class="text-[9px] text-slate-500">{segment.transcript.length} characters</span>
              </div>
              <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{@html highlightKeywords(segment.transcript, keywords)}</p>
            </div>
          {:else}
            <p class="text-xs text-slate-400 leading-snug line-clamp-2">{segment.transcript}</p>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
</div>
