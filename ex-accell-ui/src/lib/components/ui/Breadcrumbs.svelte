<script lang="ts">
  export let items: Array<{ label: string; href?: string }> = [];
</script>

{#if items.length > 0}
  <nav class="flex items-center text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
    <ol class="flex items-center space-x-2">
      {#each items as item, i}
        {#if i > 0}
          <li class="flex items-center">
            <svg class="w-4 h-4 text-gray-300 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </li>
        {/if}
        <li>
          {#if item.href && i < items.length - 1}
            <a href={item.href} class="text-gray-500 hover:text-blue-600 transition-colors">{item.label}</a>
          {:else}
            <span class="text-gray-900 font-medium">{item.label}</span>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
{/if}
