<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  $: workspaceId = $page.url.searchParams.get('workspace');

  onMount(() => {
    const wsParam = workspaceId ? `?workspace=${workspaceId}&tab=workflows` : '?tab=workflows';
    goto(`/data-management${wsParam}`, { replaceState: true });
  });
</script>

<div class="flex items-center justify-center min-h-screen">
  <p class="text-gray-500">Redirecting to Data Management...</p>
</div>
