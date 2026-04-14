<script lang="ts">
  import type { CrossFilter } from '$lib/stores/investigationStore';

  export let crossFilter: CrossFilter | null = null;
  export let nativeDimensions: string[] = [];

  $: isExternal = crossFilter != null && !nativeDimensions.includes(crossFilter.dimension);
</script>

{#if isExternal && crossFilter}
  <span class="inline-flex items-center gap-1 px-1.5 py-0 bg-indigo-500/10 border border-indigo-500/20 rounded text-[8px] text-indigo-400/80 whitespace-nowrap">
    <span class="uppercase tracking-wider opacity-70">{crossFilter.dimension}</span>
    <span class="font-medium max-w-[60px] truncate">{crossFilter.label || crossFilter.value}</span>
  </span>
{/if}
