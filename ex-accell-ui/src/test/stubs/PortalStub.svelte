<script lang="ts">
  // Stands in for the d3 portals in page tests: shows what it was given and can raise a cross-filter
  import { createEventDispatcher } from 'svelte';

  export let height = 0;
  export let crossFilter: unknown = null;
  export let gdeltEvents: unknown[] = [];
  export let radioSegments: unknown[] = [];
  export let socialPosts: unknown[] = [];
  export let timelineData: unknown[] = [];
  export let keywordData: unknown[] = [];
  export let gdeltTotal = 0;
  export let gdeltLoading = false;
  export let keywords: string[] = [];
  export let dateStart = '';
  export let dateEnd = '';

  const dispatch = createEventDispatcher();
  $: unused = [crossFilter, radioSegments, socialPosts, timelineData, keywordData, gdeltTotal, gdeltLoading, keywords, dateStart, dateEnd];
</script>

<div data-testid="portal-stub" data-height={height} data-gdelt={gdeltEvents.length} data-cross={crossFilter ? 'yes' : 'no'} data-u={unused.length}>
  <button type="button" on:click={() => dispatch('crossfilter', { dimension: 'keyword', value: 'talks', label: 'talks' })}>raise filter</button>
</div>
