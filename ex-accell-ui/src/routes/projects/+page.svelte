<script lang="ts">
  import { goto } from '$app/navigation';
  import { setCurrentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  import { getStatusColor } from '$lib/utils/colorUtils';
  import { formatDate } from '$lib/utils/formatUtils';

  let projects: any[] = [];
  let loading = true;

  onMount(async () => {
    await loadProjects();
  });

  async function loadProjects() {
    loading = true;
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();

      if (result.success) {
        projects = result.projects || [];
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      loading = false;
    }
  }

  function getTypeLabel(type: string) {
    if (!type) return 'General';

    switch (type) {
      case 'social-media': return 'Social Media';
      case 'market-research': return 'Market Research';
      case 'customer-feedback': return 'Customer Feedback';
      case 'content-analysis': return 'Content Analysis';
      default: return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
  }

  async function openProject(projectId: string) {
    // Set the current project context and redirect to project view
    const success = await setCurrentProject(projectId);
    if (success) {
      goto(`/projects/${projectId}`);
    }
  }
</script>

<svelte:head>
  <title>Projects - Social Explorer</title>
  <meta name="description" content="Manage your data analysis projects" />
</svelte:head>

<!-- Header -->
<div class="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-white">Projects</h1>
        <p class="text-blue-100 mt-2">Manage your data analysis workspaces</p>
      </div>
      <button 
        on:click={() => goto('/projects/new')}
        class="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-white/30">
        + New Project
      </button>
    </div>
  </div>
</div>

<!-- Projects List -->
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {#if projects.length === 0}
    <!-- Empty State -->
    <div class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No projects</h3>
      <p class="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
      <div class="mt-6">
        <button 
          on:click={() => goto('/projects/new')}
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          Create New Project
        </button>
      </div>
    </div>
  {:else}
    <!-- Projects Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {#each projects as project}
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer" on:click={() => openProject(project.id)}>
          <div class="p-6">
            <!-- Project Header -->
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-medium text-gray-900 truncate">{project.name}</h3>
                <p class="text-sm text-gray-500 mt-1">{getTypeLabel(project.project_type)}</p>
              </div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(project.status)} ml-2">
                {project.status}
              </span>
            </div>

            <!-- Project Description -->
            <p class="text-sm text-gray-600 mb-4 line-clamp-2">{project.description}</p>

            <!-- Project Stats -->
            <div class="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div class="text-lg font-semibold text-gray-900">{project.workspace_count || 0}</div>
                <div class="text-xs text-gray-500">Workspaces</div>
              </div>
              <div>
                <div class="text-lg font-semibold text-gray-900">{project.member_count || 0}</div>
                <div class="text-xs text-gray-500">Members</div>
              </div>
              <div>
                <div class="text-lg font-semibold text-gray-900">{project.total_data_sources || 0}</div>
                <div class="text-xs text-gray-500">Data Sources</div>
              </div>
            </div>

            <!-- Project Footer -->
            <div class="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-200">
              <div>
                <span>Created by: {project.created_by}</span>
              </div>
              <div>
                <span>Updated {formatDate(project.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>