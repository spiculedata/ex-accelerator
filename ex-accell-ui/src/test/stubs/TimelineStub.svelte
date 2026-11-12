<script lang="ts">
  // Stands in for the d3 timeline in page tests so brush and day-click events can be raised
  import { createEventDispatcher } from 'svelte';

  export let data: unknown[] = [];
  export let height = 0;

  const dispatch = createEventDispatcher();
</script>

<div data-testid="timeline-stub" data-days={data.length} data-height={height}>
  <button type="button" on:click={() => dispatch('brushChange', { start: new Date('2026-01-10T00:00:00Z'), end: new Date('2026-01-12T00:00:00Z') })}>brush</button>
  <button type="button" on:click={() => dispatch('dayClick', { date: '2026-01-05' })}>click day</button>
</div>
