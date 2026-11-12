<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentProject } from '$lib/stores/projectStore';
  import { formatRecordCount, getDatasetTypeBadges, type NavWorkspace, type WorkspaceSummary } from './navItems';

  export let workspaces: NavWorkspace[];
  export let summaries: Record<string, WorkspaceSummary>;
  export let currentWorkspace: NavWorkspace | null;
  export let open = false;

  const dispatch = createEventDispatcher();
</script>

<div class="relative workspace-switcher">
  <button
    on:click={() => open = !open}
    aria-expanded={open}
    aria-haspopup="true"
    class="flex items-center px-3 py-1.5 text-sm hover:bg-gray-100 rounded-r-lg transition-colors">
    <svg class="w-4 h-4 mr-1.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
    </svg>
    <span class="text-xs font-medium text-gray-700 truncate max-w-24">
      {currentWorkspace?.name || 'Workspace'}
    </span>
    <svg class="ml-1.5 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  </button>

  <!-- Workspace Dropdown -->
  {#if open}
    <div class="absolute top-full right-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-[100]">
      <div class="p-4 border-b border-gray-200">
        <h3 class="text-sm font-medium text-gray-900">Switch Workspace</h3>
      </div>
      <div class="max-h-64 overflow-y-auto">
        {#each workspaces as workspace, wi}
          {@const summary = summaries[workspace.id]}
          {@const badges = summary ? getDatasetTypeBadges(summary) : []}
          <button
            on:click={() => dispatch('select', workspace)}
            class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors {currentWorkspace?.id === workspace.id ? 'bg-indigo-50' : ''}">
            <div class="flex items-start">
              <div class="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
                <span class="text-white font-medium text-sm">{workspace.name.charAt(0)}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <div class="text-sm font-medium text-gray-900 truncate">{workspace.name}</div>
                  {#if currentWorkspace?.id === workspace.id}
                    <svg class="w-4 h-4 text-indigo-600 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  {/if}
                </div>
                <div class="flex items-center space-x-2 mb-1">
                  <span class="text-xs text-gray-500">{workspace.workspace_type}</span>
                  {#if summary && summary.datasetCount > 0}
                    <span class="text-xs text-gray-500">•</span>
                    <span class="text-xs text-gray-600 font-medium">{formatRecordCount(summary.recordCount)} posts</span>
                  {/if}
                </div>
                {#if badges.length > 0}
                  <div class="flex items-center space-x-1 mt-1.5">
                    {#each badges as badge, bi}
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {badge.color}">
                        {badge.label}
                      </span>
                    {/each}
                    {#if summary?.lastSync}
                      <span class="text-xs text-gray-500 ml-1">• {summary.lastSync}</span>
                    {/if}
                  </div>
                {:else if summary}
                  <div class="text-xs text-gray-500 italic mt-1">No datasets</div>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      </div>
      <div class="p-4 border-t border-gray-200">
        <button
          on:click={() => {
            goto(`/projects/${$currentProject?.id}`);
            open = false;
          }}
          class="text-sm text-indigo-600 hover:text-indigo-800 w-full text-right">
          Manage Workspaces
        </button>
      </div>
    </div>
  {/if}
</div>
