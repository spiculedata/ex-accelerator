<script lang="ts">
  import { onMount } from 'svelte';
  import { getPortalView, setPortalView } from '$lib/stores/investigationStore';

  export let portalId: string;
  export let title: string;
  export let views: { id: string; label: string }[] = [];
  export let defaultView: string = '';
  export let activeView: string = defaultView;

  onMount(() => {
    activeView = getPortalView(portalId, defaultView);
  });

  export function selectView(viewId: string) {
    activeView = viewId;
    setPortalView(portalId, viewId);
  }
</script>

<div class="bg-slate-900 border border-slate-700/30 rounded-lg flex flex-col h-full overflow-hidden">
  <div class="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/30 flex-shrink-0">
    <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{title}</span>
    {#if views.length > 1}
      <div class="flex items-center gap-0.5">
        {#each views as view}
          <button
            on:click={() => selectView(view.id)}
            class="px-1.5 py-0.5 text-[9px] rounded transition-colors {activeView === view.id
              ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}"
          >
            {view.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <div class="flex-1 min-h-0 p-2">
    <slot />
  </div>
</div>
