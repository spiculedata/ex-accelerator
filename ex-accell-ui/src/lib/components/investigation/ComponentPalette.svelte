<script lang="ts">
  export let onAddComponent: (type: string) => void = () => {};

  interface PaletteItem {
    type: string;
    name: string;
    description: string;
    icon: string;
    available: boolean;
  }

  const components: PaletteItem[] = [
    {
      type: 'swim-lane-timeline',
      name: 'Swim-Lane Timeline',
      description: 'Multi-source timeline with synchronized lanes for events, transcripts, and posts.',
      icon: 'M4 6h16M4 12h16M4 18h16',
      available: true
    },
    {
      type: 'sentiment-distribution',
      name: 'Sentiment Distribution',
      description: 'Donut chart showing sentiment breakdown across sources with click-to-filter.',
      icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z',
      available: true
    },
    {
      type: 'parallel-coordinates',
      name: 'Parallel Coordinates',
      description: 'Multi-axis plot for comparing tone, engagement, and other numeric dimensions.',
      icon: 'M9 17V7m0 10l3-3m-3 3l-3-3M15 7v10m0-10l3 3m-3-3l-3 3',
      available: false
    },
    {
      type: 'lag-analysis',
      name: 'Lag Analysis',
      description: 'Cross-correlation chart showing time-lag relationships between data sources.',
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
      available: false
    },
    {
      type: 'geographic-map',
      name: 'Geographic Map',
      description: 'Interactive map plotting event locations with clustering and heat overlays.',
      icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064',
      available: false
    },
    {
      type: 'keyword-network',
      name: 'Keyword Network',
      description: 'Force-directed graph showing keyword co-occurrence and topic relationships.',
      icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
      available: false
    },
    {
      type: 'word-cloud',
      name: 'Word Cloud',
      description: 'Weighted word visualization highlighting key terms and frequency patterns.',
      icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
      available: false
    }
  ];
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
    <h3 class="text-sm font-semibold text-gray-800">Component Palette</h3>
    <p class="text-xs text-gray-500 mt-0.5">Drag or add chart components to Band D</p>
  </div>

  <!-- Component List -->
  <div class="overflow-auto flex-1 p-3 space-y-2">
    {#each components as comp}
      <div
        class="rounded-lg border p-3 transition-all duration-150
          {comp.available
            ? 'border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white'
            : 'border-gray-100 bg-gray-50 opacity-60'}"
      >
        <div class="flex items-start gap-3">
          <!-- Icon -->
          <div
            class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
              {comp.available ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={comp.icon} />
            </svg>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium {comp.available ? 'text-gray-800' : 'text-gray-500'}">
                {comp.name}
              </span>
              {#if !comp.available}
                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">Coming soon</span>
              {/if}
            </div>
            <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">{comp.description}</p>
          </div>
        </div>

        <!-- Add Button -->
        {#if comp.available}
          <div class="mt-2 flex justify-end">
            <button
              class="text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
              on:click={() => onAddComponent(comp.type)}
            >
              Add
            </button>
          </div>
        {:else}
          <div class="mt-2 flex justify-end">
            <button
              class="text-xs font-medium px-3 py-1.5 rounded-md bg-gray-200 text-gray-400 cursor-not-allowed"
              disabled
            >
              Add
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
