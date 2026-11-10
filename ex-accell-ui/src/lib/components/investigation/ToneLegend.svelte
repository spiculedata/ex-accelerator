<script lang="ts">
  import { getSentimentColor } from '$lib/utils/colorUtils';

  /** A swatch-and-word legend for a portal that colours marks by tone or agreement, so colour is never the only cue. */
  export let items: { label: string; color: string }[] = [
    { label: 'Positive', color: getSentimentColor('positive') },
    { label: 'Neutral', color: getSentimentColor('neutral') },
    { label: 'Negative', color: getSentimentColor('negative') }
  ];
  export let title = 'Tone';
</script>

<div class="flex items-center gap-2 px-3 py-1 border-t border-slate-700/30 text-[9px] text-slate-500 flex-shrink-0" aria-label="{title} legend">
  <span class="uppercase tracking-wider">{title}</span>
  {#each items as item}
    <span class="inline-flex items-center gap-1">
      <span class="w-2 h-2 rounded-full" style="background-color: {item.color}"></span>
      {item.label}
    </span>
  {/each}
</div>
