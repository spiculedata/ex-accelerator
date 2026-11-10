<script lang="ts">
  export let title: string = 'No data available';
  export let description: string = '';
  export let actionLabel: string = '';
  export let actionHref: string = '';
</script>

<div class="text-center py-12 px-4">
  <div class="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
    <slot name="icon">
      <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
      </svg>
    </slot>
  </div>
  <h3 class="text-lg font-medium text-gray-900 mb-1">{title}</h3>
  {#if description}
    <p class="text-sm text-gray-500 max-w-md mx-auto mb-4">{description}</p>
  {/if}
  {#if actionLabel && actionHref}
    <a href={actionHref} class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
      {actionLabel}
    </a>
  {/if}
  <slot name="action"></slot>
</div>
