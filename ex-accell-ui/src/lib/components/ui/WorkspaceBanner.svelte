<script lang="ts">
  import { goto } from '$app/navigation';

  export let workspaceName: string = '';
  export let workspaceId: string = '';
  export let projectName: string = '';

  function clearScope() {
    // Navigate to same page without workspace param
    const url = new URL(window.location.href);
    url.searchParams.delete('workspace');
    goto(url.pathname + url.search);
  }
</script>

{#if workspaceId && workspaceName}
  <div class="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
    <div class="flex items-center text-sm">
      <svg class="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
      </svg>
      <span class="text-blue-700">
        Viewing data for:
        {#if projectName}
          <span class="text-blue-500">{projectName}</span>
          <span class="text-blue-300 mx-1">/</span>
        {/if}
        <a href="/workspaces/{workspaceId}" class="font-medium text-blue-800 hover:text-blue-900 underline">{workspaceName}</a>
      </span>
    </div>
    <button
      on:click={clearScope}
      class="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center">
      Show all data
      <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
  </div>
{/if}
