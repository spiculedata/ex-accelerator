<script lang="ts">
  import { getSentimentColor } from '$lib/utils/colorUtils';

  /** A swatch-and-word legend for a portal that colours marks by tone or agreement, so colour is never the only cue. */
  export let items: { label: string; color: string; title?: string }[] = [
    { label: 'Positive', color: getSentimentColor('positive'), title: 'Average tone above +1' },
    { label: 'Neutral', color: getSentimentColor('neutral'), title: 'Average tone between -1 and +1' },
    { label: 'Negative', color: getSentimentColor('negative'), title: 'Average tone below -1' }
  ];
  export let title = 'Tone';
</script>

<div class="flex items-center gap-2 px-3 py-1 border-t border-slate-700/30 text-[10px] text-slate-400 flex-shrink-0" role="group" aria-label="{title} legend">
  <span class="uppercase tracking-wider">{title}</span>
  {#each items as item (item.label)}
    <span class="inline-flex items-center gap-1" title={item.title}>
      <span class="w-2 h-2 rounded-full" style="background-color: {item.color}"></span>
      {item.label}
    </span>
  {/each}
</div>
