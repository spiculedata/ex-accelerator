<script lang="ts">
  import LoadingSpinner from './LoadingSpinner.svelte';

  export let loading: boolean = true;
  export let message: string = 'Loading...';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let overlay: boolean = false;
</script>

{#if loading}
  {#if overlay}
    <div class="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
      <LoadingSpinner {size} {message} />
    </div>
  {:else}
    <div class="flex items-center justify-center py-16">
      <LoadingSpinner {size} {message} />
    </div>
  {/if}
{/if}
