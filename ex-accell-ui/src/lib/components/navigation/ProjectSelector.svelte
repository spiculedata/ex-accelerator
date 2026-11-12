<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentProject, setCurrentProject, clearCurrentProject } from '$lib/stores/projectStore';
  import type { NavProject } from './navItems';

  export let projects: NavProject[];
  export let open = false;
</script>

<div class="relative z-50 project-switcher">
  <button
    on:click={() => open = !open}
    aria-expanded={open}
    aria-haspopup="true"
    class="flex items-center px-3 py-1.5 text-sm hover:bg-gray-100 rounded-l-lg transition-colors">
    <div class="w-5 h-5 bg-blue-600 rounded flex items-center justify-center mr-2">
      <span class="text-white font-medium text-xs">{$currentProject?.name?.charAt(0) || 'P'}</span>
    </div>
    <span class="text-xs font-medium text-gray-700 truncate max-w-28">{$currentProject?.name || 'Select Project'}</span>
    <svg class="ml-1.5 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  </button>

  <!-- Project Dropdown -->
  {#if open}
    <div class="absolute top-full right-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-[100]">
      <div class="p-4 border-b border-gray-200">
        <h3 class="text-sm font-medium text-gray-900">Switch Project</h3>
      </div>
      <div class="max-h-64 overflow-y-auto">
        {#each projects as project, pi}
          <button
            on:click={async () => {
              open = false;
              // Wait for project to load before redirecting
              const success = await setCurrentProject(project.id);
              if (success) {
                // Redirect to project detail page to see workspaces
                goto(`/projects/${project.id}`);
              }
            }}
            class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors {$currentProject?.id === project.id ? 'bg-blue-50' : ''}">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center mr-3">
                <span class="text-white font-medium text-sm">{project.name.charAt(0)}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 truncate">{project.name}</div>
                <div class="text-xs text-gray-500 truncate">{project.description}</div>
              </div>
              {#if $currentProject?.id === project.id}
                <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              {/if}
            </div>
          </button>
        {/each}
      </div>
      <div class="p-4 border-t border-gray-200">
        <div class="flex justify-between">
          <button
            on:click={() => {
              clearCurrentProject();
              open = false;
              goto('/');
            }}
            class="text-sm text-gray-600 hover:text-gray-900">
            Clear Project
          </button>
          <button
            on:click={() => {
              goto('/projects');
              open = false;
            }}
            class="text-sm text-blue-600 hover:text-blue-800">
            Manage Projects
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
