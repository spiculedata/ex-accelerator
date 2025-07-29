<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { availableProjects, setCurrentProject } from '$lib/stores/projectStore';
  
  // Use projects from store
  $: projects = availableProjects;

  function getStatusColor(status: string) {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'social-media': return 'Social Media';
      case 'market-research': return 'Market Research';
      case 'customer-feedback': return 'Customer Feedback';
      case 'content-analysis': return 'Content Analysis';
      default: return type;
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  function openProject(projectId: string) {
    // Set the current project context and redirect to project view
    setCurrentProject(projectId);
    window.location.href = `/projects/${projectId}`;
  }
</script>

<svelte:head>
  <title>Projects - Social Explorer</title>
  <meta name="description" content="Manage your data analysis projects" />
</svelte:head>

<Navigation />

<!-- Header -->
<div class="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-white">Projects</h1>
        <p class="text-blue-100 mt-2">Manage your data analysis workspaces</p>
      </div>
      <button 
        on:click={() => window.location.href='/projects/new'}
        class="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-white border-opacity-30">
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
          on:click={() => window.location.href='/projects/new'}
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
                <p class="text-sm text-gray-500 mt-1">{getTypeLabel(project.type)}</p>
              </div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(project.status)} ml-2">
                {project.status}
              </span>
            </div>

            <!-- Project Description -->
            <p class="text-sm text-gray-600 mb-4 line-clamp-2">{project.description}</p>

            <!-- Project Stats -->
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div class="text-lg font-semibold text-gray-900">{project.totalPosts.toLocaleString()}</div>
                <div class="text-xs text-gray-500">Posts Analyzed</div>
              </div>
              <div>
                <div class="text-lg font-semibold text-gray-900">{project.teamMembers}</div>
                <div class="text-xs text-gray-500">Team Members</div>
              </div>
            </div>

            <!-- Data Sources -->
            <div class="mb-4">
              <div class="text-xs text-gray-500 mb-2">Data Sources</div>
              <div class="flex flex-wrap gap-1">
                {#each project.dataSources.slice(0, 3) as source}
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {source}
                  </span>
                {/each}
                {#if project.dataSources.length > 3}
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    +{project.dataSources.length - 3} more
                  </span>
                {/if}
              </div>
            </div>

            <!-- Project Footer -->
            <div class="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-200">
              <div>
                <span>Owner: {project.owner}</span>
              </div>
              <div>
                <span>Updated {formatDate(project.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>