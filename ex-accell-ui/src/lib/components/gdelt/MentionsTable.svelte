<script lang="ts">
  import { gdeltMentionTypeBadgeClass } from '$lib/utils/categoryColours';
  import { gdeltDateToInputDate } from '$lib/utils/gdeltDates';
  import { getMentionTypeLabel, type GdeltMention, type SortDirection } from '$lib/utils/gdeltMentions';

  /** The mentions on the current page */
  export let mentions: GdeltMention[];
  export let sortField: string;
  export let sortDirection: SortDirection;
  export let onSort: (field: string) => void;

  const sortableColumns = [
    { field: 'mentionSourceName', label: 'Source' },
    { field: 'mentionType', label: 'Type' },
    { field: 'mentionTimeDate', label: 'Mention Date' },
    { field: 'confidence', label: 'Confidence' },
    { field: 'mentionDocTone', label: 'Doc Tone' },
    { field: 'mentionDocLen', label: 'Doc Length' }
  ];
</script>

<div class="overflow-x-auto">
  <table class="min-w-full divide-y divide-gray-200 table-auto">
    <thead class="bg-gray-50">
      <tr>
        {#each sortableColumns as column}
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => onSort(column.field)}>
            <div class="flex items-center">
              {column.label}
              {#if sortField === column.field}
                <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={sortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}></path>
                </svg>
              {/if}
            </div>
          </th>
        {/each}
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identifier</th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-gray-200">
      {#each mentions as mention}
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 text-sm text-gray-900 font-medium max-w-xs truncate" title="{mention.mentionSourceName || 'Unknown'}">
            {mention.mentionSourceName || 'Unknown'}
          </td>
          <td class="px-4 py-3 text-sm text-gray-600">
            {#if mention.mentionType}
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {gdeltMentionTypeBadgeClass(mention.mentionType)}">
                {getMentionTypeLabel(mention.mentionType)}
              </span>
            {:else}
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                N/A
              </span>
            {/if}
          </td>
          <td class="px-4 py-3 text-sm text-gray-600">
            {#if mention.mentionTimeDate}
              {@const formattedDate = gdeltDateToInputDate(mention.mentionTimeDate)}
              {#if formattedDate}
                <span title="Raw: {mention.mentionTimeDate}">{formattedDate}</span>
              {:else}
                <span class="text-gray-500" title="Raw: {mention.mentionTimeDate}">Invalid date</span>
              {/if}
            {:else}
              <span class="text-gray-500">N/A</span>
            {/if}
          </td>
          <td class="px-4 py-3 text-sm text-gray-600">
            {#if mention.confidence}
              <div class="flex items-center">
                <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                  <div class="bg-blue-600 h-2 rounded-full" style="width: {mention.confidence}%"></div>
                </div>
                <span class="text-xs">{mention.confidence}%</span>
              </div>
            {:else}
              N/A
            {/if}
          </td>
          <td class="px-4 py-3 text-sm text-gray-600">
            {#if mention.mentionDocTone}
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {mention.mentionDocTone > 0 ? 'bg-blue-100 text-blue-800' : mention.mentionDocTone < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}">
                {mention.mentionDocTone.toFixed(2)}
              </span>
            {:else}
              N/A
            {/if}
          </td>
          <td class="px-4 py-3 text-sm text-gray-600">
            {mention.mentionDocLen?.toLocaleString() || 'N/A'}
          </td>
          <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title="{mention.mentionIdentifier || 'N/A'}">
            {#if mention.mentionIdentifier && mention.mentionIdentifier.startsWith('http')}
              <a href="{mention.mentionIdentifier}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">
                Link
              </a>
            {:else}
              {mention.mentionIdentifier || 'N/A'}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
