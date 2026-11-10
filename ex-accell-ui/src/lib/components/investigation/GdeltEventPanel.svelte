<script lang="ts">
  import { investigationSelection, toggleSelectedId, setHoveredId } from '$lib/stores/investigationStore';
  import type { InvestigationSelection } from '$lib/stores/investigationStore';

  export let events: {
    globaleventid: string | number;
    sqldate: string;
    actor1name?: string;
    actor2name?: string;
    goldsteinscale: number;
    avgtone: number;
    actiongeo_fullname?: string;
    numarticles?: number;
  }[] = [];

  let selection: InvestigationSelection;
  investigationSelection.subscribe((v) => (selection = v));

  function eventId(event: (typeof events)[0]): string {
    return 'gdelt-' + event.globaleventid;
  }

  function isSelected(event: (typeof events)[0]): boolean {
    return selection.selectedIds.has(eventId(event));
  }

  function isHovered(event: (typeof events)[0]): boolean {
    return selection.hoveredId === eventId(event);
  }

  function isDimmed(event: (typeof events)[0]): boolean {
    const hasActiveFilter = (selection.selectedIds.size > 0) || (selection.sentiment && selection.sentiment.length > 0);
    if (!hasActiveFilter) return false;

    if (selection.selectedIds.size > 0 && !selection.selectedIds.has(eventId(event))) {
      return true;
    }

    if (selection.sentiment && selection.sentiment.length > 0) {
      const tone = event.avgtone;
      const sentimentLabel = tone > 0 ? 'positive' : tone < 0 ? 'negative' : 'neutral';
      if (!selection.sentiment.includes(sentimentLabel)) {
        return true;
      }
    }

    return false;
  }

  function formatDate(sqldate: string): string {
    if (!sqldate) return '';
    if (sqldate.length === 8) {
      return `${sqldate.slice(0, 4)}-${sqldate.slice(4, 6)}-${sqldate.slice(6, 8)}`;
    }
    return sqldate;
  }

  function formatActors(a1?: string, a2?: string): string {
    const parts = [a1, a2].filter(Boolean);
    if (parts.length === 0) return 'Unknown';
    if (parts.length === 1) return parts[0] as string;
    return `${parts[0]} → ${parts[1]}`;
  }

  function goldsteinColor(val: number): string {
    if (val > 0) return 'text-green-600';
    if (val < 0) return 'text-red-600';
    return 'text-gray-600';
  }

  function toneColor(val: number): string {
    if (val > 0) return 'text-green-600';
    if (val < 0) return 'text-red-600';
    return 'text-gray-600';
  }

  $: filteredEvents = events;
  $: eventCount = filteredEvents.length;
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
    <div class="flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
      </svg>
      <h3 class="text-sm font-semibold text-gray-800">GDELT Events</h3>
    </div>
    <span class="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
      {eventCount.toLocaleString()} event{eventCount !== 1 ? 's' : ''}
    </span>
  </div>

  {#if events.length === 0}
    <div class="flex flex-col items-center justify-center flex-1 py-12 text-gray-500">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p class="text-sm">No GDELT events available</p>
    </div>
  {:else}
    <!-- Table -->
    <div class="overflow-auto flex-1">
      <table class="w-full text-xs">
        <thead class="sticky top-0 bg-white border-b border-gray-200 z-10">
          <tr>
            <th class="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th class="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wider">Actors</th>
            <th class="text-right px-3 py-2 font-medium text-gray-500 uppercase tracking-wider">Goldstein</th>
            <th class="text-right px-3 py-2 font-medium text-gray-500 uppercase tracking-wider">Tone</th>
            <th class="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wider">Location</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredEvents as event, idx}
            <tr
              class="border-b border-gray-100 cursor-pointer transition-all duration-150
                {isSelected(event) ? 'bg-blue-50' : ''}
                {isHovered(event) ? 'bg-blue-50/50' : ''}
                {isDimmed(event) ? 'opacity-30' : ''}
                hover:bg-gray-50"
              on:click={() => toggleSelectedId(eventId(event))}
              on:mouseenter={() => setHoveredId(eventId(event))}
              on:mouseleave={() => setHoveredId(null)}
              role="row"
              tabindex="0"
              on:keydown={(e) => { if (e.key === 'Enter') toggleSelectedId(eventId(event)); }}
            >
              <td class="px-3 py-2 text-gray-700 whitespace-nowrap">{formatDate(event.sqldate)}</td>
              <td class="px-3 py-2 text-gray-800 max-w-[200px] truncate" title={formatActors(event.actor1name, event.actor2name)}>
                {formatActors(event.actor1name, event.actor2name)}
              </td>
              <td class="px-3 py-2 text-right font-mono font-medium {goldsteinColor(event.goldsteinscale)} whitespace-nowrap">
                {event.goldsteinscale > 0 ? '+' : ''}{event.goldsteinscale.toFixed(1)}
              </td>
              <td class="px-3 py-2 text-right font-mono font-medium {toneColor(event.avgtone)} whitespace-nowrap">
                {event.avgtone > 0 ? '+' : ''}{event.avgtone.toFixed(2)}
              </td>
              <td class="px-3 py-2 text-gray-600 max-w-[180px] truncate" title={event.actiongeo_fullname || ''}>
                {event.actiongeo_fullname || 'N/A'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
