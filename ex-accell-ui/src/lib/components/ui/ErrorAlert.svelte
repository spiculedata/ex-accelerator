<script lang="ts">
  export let message: string;
  export let details: string = '';
  export let variant: 'inline' | 'banner' = 'inline';
  export let dismissable: boolean = true;

  let dismissed = false;

  function dismiss() {
    dismissed = true;
  }
</script>

{#if !dismissed && message}
  <div class="{variant === 'banner' ? 'rounded-none border-x-0' : 'rounded-lg'} bg-red-50 border border-red-200 p-4 mb-4" role="alert">
    <div class="flex items-start">
      <svg class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <div class="ml-3 flex-1">
        <p class="text-sm font-medium text-red-800">{message}</p>
        {#if details}
          <p class="text-sm text-red-600 mt-1">{details}</p>
        {/if}
      </div>
      {#if dismissable}
        <button on:click={dismiss} class="ml-3 text-red-400 hover:text-red-600 flex-shrink-0" aria-label="Dismiss error">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      {/if}
    </div>
  </div>
{/if}
