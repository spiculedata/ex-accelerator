<script lang="ts">
  import { apiErrors, dismissApiErrors } from '$lib/stores/apiErrors';
</script>

{#if $apiErrors.length > 0}
  <div role="alert" class="bg-red-50 border-b border-red-200 px-4 py-3 text-sm text-red-800">
    <div class="max-w-7xl mx-auto flex items-start justify-between gap-4">
      <div>
        <p class="font-medium">Some data could not be loaded, so parts of this page may be incomplete.</p>
        <ul class="mt-1 list-disc list-inside text-red-700">
          {#each $apiErrors as error (error.source)}
            <li>{error.source}: {error.message}</li>
          {/each}
        </ul>
        <p class="mt-1 text-red-700">Try reloading the page. If it keeps happening, check the server logs.</p>
      </div>
      <button
        type="button"
        on:click={dismissApiErrors}
        class="shrink-0 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
      >
        Dismiss
      </button>
    </div>
  </div>
{/if}
