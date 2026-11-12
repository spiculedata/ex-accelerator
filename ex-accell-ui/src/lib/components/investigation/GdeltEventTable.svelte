<script lang="ts">
  import { setCrossFilter, type CrossFilter } from '$lib/stores/investigationStore';
  import { formatGdeltDate, goldsteinColor, toneBarWidth } from '$lib/utils/investigationFormat';
  import type { GdeltEvent } from '$lib/utils/investigationTypes';

  export let loading: boolean;
  /** Events after the cross-filter */
  export let events: GdeltEvent[];
  export let activeCrossFilter: CrossFilter | null;
  /** How many events match; 200 means the load limit was reached */
  export let tabCount: number;
  export let expandedId: string | number | null;
</script>

<div role="tabpanel" id="panel-gdelt" aria-labelledby="tab-gdelt" class="h-full">
{#if loading}
  <div class="flex items-center justify-center h-full"><svg class="animate-spin h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg></div>
{:else if events.length === 0}
  <div class="flex flex-col items-center justify-center h-full gap-1 text-sm text-slate-400">
    <p>No GDELT events match these keywords{activeCrossFilter ? ' and the active filter' : ''}.</p>
    <p class="text-xs text-slate-500">Matching looks for the keyword anywhere in a word. Try different keywords or a wider date range.</p>
  </div>
{:else}
  <div class="h-full overflow-y-auto">
    <p class="px-3 py-1.5 text-xs text-slate-400 bg-slate-900/60 border-b border-slate-800">
      Keywords match anywhere in a word, so “bus” also finds “business”.
      {#if tabCount >= 200}<span class="text-amber-300">Showing the first 200 matches; narrow the keywords or dates to see others.</span>{/if}
    </p>
    <table class="w-full text-xs">
      <thead class="sticky top-0 z-10">
        <tr class="bg-slate-900">
          <th class="text-left text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5 w-20">Date</th>
          <th class="text-left text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5">Actors</th>
          <th class="text-center text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5 w-20">Goldstein</th>
          <th class="text-left text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5 w-32">Avg Tone</th>
          <th class="text-left text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5">Location</th>
          <th class="text-right text-[10px] uppercase tracking-wider text-slate-500 font-medium px-3 py-1.5 w-16">Articles</th>
        </tr>
      </thead>
      <tbody>
        {#each events as event}
          {@const expanded = expandedId === event.globaleventid}
          <tr
            class="border-b border-slate-800/40 hover:bg-slate-800/40 transition-colors cursor-pointer"
            on:click={() => expandedId = expanded ? null : event.globaleventid}
          >
            <td class="px-3 py-1.5 text-slate-400 font-mono whitespace-nowrap">{formatGdeltDate(event.sqldate)}</td>
            <td class="px-3 py-1.5 text-slate-300">
              {#if event.actor1name}<!-- svelte-ignore a11y-click-events-have-key-events --><span class="font-medium cursor-pointer hover:text-indigo-300 transition-colors" on:click|stopPropagation={() => setCrossFilter({ dimension: 'actor', value: event.actor1name, label: event.actor1name })} role="button" tabindex="0">{event.actor1name}</span>{:else}<span>-</span>{/if}
              {#if event.actor2name}
                <span class="text-slate-600 mx-1">&rarr;</span>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <span class="text-slate-400 cursor-pointer hover:text-indigo-300 transition-colors" on:click|stopPropagation={() => setCrossFilter({ dimension: 'actor', value: event.actor2name, label: event.actor2name })} role="button" tabindex="0">{event.actor2name}</span>
              {/if}
            </td>
            <td class="px-3 py-1.5 text-center">
              <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold {goldsteinColor(event.goldsteinscale)}">
                {event.goldsteinscale > 0 ? '+' : ''}{event.goldsteinscale.toFixed(1)}
              </span>
            </td>
            <td class="px-3 py-1.5">
              <div class="flex items-center gap-1.5">
                <div class="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full rounded-full {event.avgtone >= 0 ? 'bg-emerald-500/70' : 'bg-rose-500/70'}" style="width: {toneBarWidth(event.avgtone)}%"></div>
                </div>
                <span class="text-[10px] font-mono text-slate-500">{event.avgtone.toFixed(1)}</span>
              </div>
            </td>
            <td class="px-3 py-1.5 truncate max-w-[200px]" title={event.actiongeo_fullname}>
              {#if event.actiongeo_fullname}<!-- svelte-ignore a11y-click-events-have-key-events --><span class="text-slate-500 cursor-pointer hover:text-indigo-300 transition-colors" on:click|stopPropagation={() => setCrossFilter({ dimension: 'location', value: event.actiongeo_fullname, label: event.actiongeo_fullname })} role="button" tabindex="0">{event.actiongeo_fullname}</span>{:else}<span class="text-slate-600">-</span>{/if}
            </td>
            <td class="px-3 py-1.5 text-right font-mono text-slate-500">{event.numarticles || '-'}</td>
          </tr>
          {#if expanded}
            <tr class="bg-slate-800/20">
              <td colspan="6" class="px-4 py-3">
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Event Type</span>
                    <span class="text-slate-300 font-mono">{event.eventcode || '-'}</span>
                    {#if event.quadclass}
                      <span class="ml-1.5 text-[9px] px-1 py-0 rounded {event.quadclass == 1 ? 'bg-emerald-500/15 text-emerald-400' : event.quadclass == 2 ? 'bg-sky-500/15 text-sky-400' : event.quadclass == 3 ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-500/15 text-rose-400'}">
                        {event.quadclass == 1 ? 'Verbal Coop' : event.quadclass == 2 ? 'Material Coop' : event.quadclass == 3 ? 'Verbal Conflict' : 'Material Conflict'}
                      </span>
                    {/if}
                  </div>
                  <div>
                    <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Coverage</span>
                    <span class="text-slate-300">{event.nummentions ?? 0} mentions &middot; {event.numsources ?? 0} sources &middot; {event.numarticles ?? 0} articles</span>
                  </div>
                  <div>
                    <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Location</span>
                    {#if event.actiongeo_fullname}
                      <!-- svelte-ignore a11y-click-events-have-key-events -->
                      <span class="text-slate-300 cursor-pointer hover:text-indigo-300 transition-colors {activeCrossFilter?.dimension === 'location' && activeCrossFilter?.value === event.actiongeo_fullname ? 'text-indigo-300 underline' : ''}" on:click|stopPropagation={() => setCrossFilter({ dimension: 'location', value: event.actiongeo_fullname, label: event.actiongeo_fullname })} role="button" tabindex="0">{event.actiongeo_fullname}</span>
                    {:else}
                      <span class="text-slate-500">Unknown</span>
                    {/if}
                    {#if event.actiongeo_lat && event.actiongeo_long}
                      <span class="text-[11px] font-mono text-slate-600 ml-1">({Number(event.actiongeo_lat).toFixed(2)}, {Number(event.actiongeo_long).toFixed(2)})</span>
                    {/if}
                  </div>
                  <div>
                    <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Actors</span>
                    <div class="text-slate-300">
                      {#if event.actor1name}<!-- svelte-ignore a11y-click-events-have-key-events --><span class="font-medium cursor-pointer hover:text-indigo-300 transition-colors {activeCrossFilter?.dimension === 'actor' && activeCrossFilter?.value === event.actor1name ? 'text-indigo-300 underline' : ''}" on:click|stopPropagation={() => setCrossFilter({ dimension: 'actor', value: event.actor1name, label: event.actor1name })} role="button" tabindex="0">{event.actor1name}</span>{#if event.actor1countrycode}<span class="text-[9px] text-slate-500 ml-1">({event.actor1countrycode})</span>{/if}{/if}
                      {#if event.actor2name}<span class="text-slate-600 mx-1">&rarr;</span><!-- svelte-ignore a11y-click-events-have-key-events --><span class="cursor-pointer hover:text-indigo-300 transition-colors {activeCrossFilter?.dimension === 'actor' && activeCrossFilter?.value === event.actor2name ? 'text-indigo-300 underline' : ''}" on:click|stopPropagation={() => setCrossFilter({ dimension: 'actor', value: event.actor2name, label: event.actor2name })} role="button" tabindex="0">{event.actor2name}</span>{#if event.actor2countrycode}<span class="text-[9px] text-slate-500 ml-1">({event.actor2countrycode})</span>{/if}{/if}
                    </div>
                  </div>
                </div>
                {#if event.sourceurl}
                  <div class="mt-2 pt-2 border-t border-slate-700/30">
                    <a href={event.sourceurl} target="_blank" rel="noopener noreferrer" class="text-[10px] text-indigo-400 hover:text-indigo-300 truncate block max-w-full">
                      {event.sourceurl}
                    </a>
                  </div>
                {/if}
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{/if}
</div>
