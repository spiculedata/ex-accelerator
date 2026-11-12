<script lang="ts">
  /** How many mentions pass the filters */
  export let total: number;
  export let currentPage: number;
  export let itemsPerPage: number;
  export let itemsPerPageOptions: number[];
  /** The bar above the table has a bottom border, the one below it a top border */
  export let position: 'top' | 'bottom';
  export let onGoToPage: (page: number) => void;
  export let onChangeItemsPerPage: (itemsPerPage: number) => void;

  const PAGE_WINDOW = 2;

  $: totalPages = Math.ceil(total / itemsPerPage);
  $: startPage = Math.max(1, currentPage - PAGE_WINDOW);
  $: endPage = Math.min(totalPages, currentPage + PAGE_WINDOW);
</script>

{#if total > itemsPerPageOptions[0]}
  <div class="{position === 'top' ? 'mb-6 border-b pb-4' : 'mt-6 border-t pt-4'} flex flex-col lg:flex-row items-center justify-between gap-4">
    <!-- Results per page selector -->
    <div class="flex items-center gap-3">
      <label class="text-sm text-gray-700 font-medium">Show:</label>
      <select
        bind:value={itemsPerPage}
        on:change={() => onChangeItemsPerPage(itemsPerPage)}
        class="px-3 py-1 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {#each itemsPerPageOptions as option}
          <option value={option}>{option} per page</option>
        {/each}
      </select>
    </div>

    <!-- Page Navigation -->
    {#if totalPages > 1}
      <div class="flex items-center space-x-2">
        <button
          on:click={() => onGoToPage(currentPage - 1)}
          disabled={currentPage === 1}
          class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded transition-colors"
        >
          Previous
        </button>

        {#if startPage > 1}
          <button on:click={() => onGoToPage(1)} class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors">1</button>
          {#if startPage > 2}<span class="text-gray-500">...</span>{/if}
        {/if}

        {#each Array.from({length: endPage - startPage + 1}, (_, i) => startPage + i) as page}
          <button
            on:click={() => onGoToPage(page)}
            class="px-3 py-1 text-sm rounded transition-colors {page === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
          >
            {page}
          </button>
        {/each}

        {#if endPage < totalPages}
          {#if endPage < totalPages - 1}<span class="text-gray-500">...</span>{/if}
          <button on:click={() => onGoToPage(totalPages)} class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors">{totalPages}</button>
        {/if}

        <button
          on:click={() => onGoToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded transition-colors"
        >
          Next
        </button>
      </div>
    {/if}
  </div>
{/if}
