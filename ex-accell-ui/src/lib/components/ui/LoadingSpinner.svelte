<script lang="ts">
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let message: string = 'Loading...';

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };
</script>

<div class="flex flex-col items-center justify-center space-y-2">
  <div class="{sizeClasses[size]} animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
  {#if message}
    <p class="text-sm text-gray-600">{message}</p>
  {/if}
</div>
