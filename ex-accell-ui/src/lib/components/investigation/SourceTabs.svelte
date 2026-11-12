<script lang="ts">
  import { clearCrossFilter, type CrossFilter } from '$lib/stores/investigationStore';
  import type { SourceTab } from '$lib/utils/investigationTypes';

  export let activeTab: SourceTab;
  export let activeCrossFilter: CrossFilter | null;
  export let tabCounts: Record<SourceTab, number>;
</script>

<!-- ============ TABS ============ -->
<div role="tablist" aria-label="Investigation sources" class="min-h-8 flex-shrink-0 bg-slate-900 border-b border-slate-700/50 flex items-end px-2 gap-0">
  <!-- Global cross-filter pill — visible on all tabs -->
  {#if activeCrossFilter}
    <div class="flex items-center gap-1.5 px-2 py-0.5 mb-0.5 mr-2 bg-indigo-500/15 border border-indigo-500/30 rounded-full self-center">
      <span class="text-[8px] text-indigo-400/70 uppercase tracking-wider">{activeCrossFilter.dimension}</span>
      <span class="text-[9px] text-indigo-300 font-medium max-w-[100px] truncate">{activeCrossFilter.label || activeCrossFilter.value}</span>
      <button
        on:click={() => clearCrossFilter()}
        class="text-indigo-400/50 hover:text-indigo-300 transition-colors"
        title="Clear filter"
        aria-label="Clear filter"
      >
        <svg class="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  {/if}
  <button
    on:click={() => activeTab = 'gdelt'}
    role="tab"
    id="tab-gdelt"
    aria-selected={activeTab === 'gdelt'}
    aria-controls="panel-gdelt"
    class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 {activeTab === 'gdelt' ? 'text-amber-400 border-amber-400 bg-slate-800/50' : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'}"
  >
    <span class="inline-block w-1.5 h-1.5 rounded-full mr-1 {activeTab === 'gdelt' ? 'bg-amber-500' : 'bg-slate-600'}"></span>
    GDELT
    <span class="ml-1 text-[11px] font-mono {activeTab === 'gdelt' ? 'text-amber-400/70' : 'text-slate-600'}">{tabCounts.gdelt >= 200 ? '200 max' : tabCounts.gdelt}</span>
  </button>
  <button
    on:click={() => activeTab = 'radio'}
    role="tab"
    id="tab-radio"
    aria-selected={activeTab === 'radio'}
    aria-controls="panel-radio"
    class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 {activeTab === 'radio' ? 'text-violet-400 border-violet-400 bg-slate-800/50' : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'}"
  >
    <span class="inline-block w-1.5 h-1.5 rounded-full mr-1 {activeTab === 'radio' ? 'bg-violet-500' : 'bg-slate-600'}"></span>
    Radio
    <span class="ml-1 text-[11px] font-mono {activeTab === 'radio' ? 'text-violet-400/70' : 'text-slate-600'}">{tabCounts.radio}</span>
  </button>
  <button
    on:click={() => activeTab = 'social'}
    role="tab"
    id="tab-social"
    aria-selected={activeTab === 'social'}
    aria-controls="panel-social"
    class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 {activeTab === 'social' ? 'text-sky-400 border-sky-400 bg-slate-800/50' : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'}"
  >
    <span class="inline-block w-1.5 h-1.5 rounded-full mr-1 {activeTab === 'social' ? 'bg-sky-500' : 'bg-slate-600'}"></span>
    Social
    <span class="ml-1 text-[11px] font-mono {activeTab === 'social' ? 'text-sky-400/70' : 'text-slate-600'}">{tabCounts.social >= 200 ? '200 max' : tabCounts.social}</span>
  </button>
  <button
    on:click={() => activeTab = 'visualizations'}
    role="tab"
    id="tab-visualizations"
    aria-selected={activeTab === 'visualizations'}
    aria-controls="panel-visualizations"
    class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 {activeTab === 'visualizations' ? 'text-indigo-400 border-indigo-400 bg-slate-800/50' : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'}"
  >
    <svg class="inline-block w-3 h-3 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
    Visualizations
  </button>
</div>
