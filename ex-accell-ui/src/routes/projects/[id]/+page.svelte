<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { availableProjects, setCurrentProject, currentProject } from '$lib/stores/projectStore';
  
  // Get project ID from URL
  $: projectId = $page.params.id;
  
  // Find project from store
  $: project = availableProjects.find(p => p.id === projectId);
  
  onMount(() => {
    // Set current project if it exists
    if (project) {
      setCurrentProject(project.id);
    }
  });
  
  // If project not found, redirect to projects list
  $: if (projectId && !project) {
    window.location.href = '/projects';
  }

  // Analytics applications
  let applications = [
    {
      id: 'dashboards',
      name: 'Dashboards',
      description: 'Real-time analytics and custom visualizations',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'from-blue-500 to-blue-600',
      available: true
    },
    {
      id: 'text-analytics',
      name: 'Text Analytics',
      description: 'NLP processing and sentiment analysis',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'from-blue-500 to-blue-600',
      available: true
    },
    {
      id: 'image-processing',
      name: 'Image Processing',
      description: 'Computer vision and image analysis',
      icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: 'from-blue-500 to-blue-600',
      available: project.totalPosts > 0
    }
  ];

  function openApplication(appId: string) {
    // Pass project context to the application
    window.location.href = `/${appId}?project=${projectId}`;
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }
</script>

<svelte:head>
  <title>{project?.name || 'Project'} - Social Explorer</title>
  <meta name="description" content="Project workspace for {project?.name || 'project'}" />
</svelte:head>

<Navigation />

{#if project}
  <!-- Project Header -->
  <div class="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <button 
            on:click={() => window.location.href='/projects'}
            class="mr-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-xl transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div>
            <div class="flex items-center">
              <h1 class="text-3xl font-bold text-white mr-3">{project.name}</h1>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(project.status)}">
                {project.status}
              </span>
            </div>
            <p class="text-blue-100 mt-2">{project.description}</p>
          </div>
        </div>
        <div class="text-right">
          <div class="text-white text-sm">
            <div class="font-medium">{project.totalPosts.toLocaleString()} posts</div>
            <div class="text-blue-200">Last updated {formatDate(project.updatedAt)}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

<!-- Project Content -->
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Quick Stats -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
    <div class="bg-white rounded-xl shadow-sm p-6 text-center">
      <div class="text-2xl font-bold text-blue-600 mb-1">{project.totalPosts.toLocaleString()}</div>
      <div class="text-sm text-gray-600">Total Posts</div>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6 text-center">
      <div class="text-2xl font-bold text-blue-600 mb-1">{project.dataSources.length}</div>
      <div class="text-sm text-gray-600">Data Sources</div>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6 text-center">
      <div class="text-2xl font-bold text-blue-600 mb-1">{project.teamMembers.length}</div>
      <div class="text-sm text-gray-600">Team Members</div>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6 text-center">
      <div class="text-2xl font-bold text-orange-600 mb-1">3</div>
      <div class="text-sm text-gray-600">Applications</div>
    </div>
  </div>

  <!-- Applications Grid -->
  <div class="mb-8">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Analytics Applications</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each applications as app}
        <div 
          class="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer {app.available ? '' : 'opacity-60'}"
          on:click={() => app.available && openApplication(app.id)}>
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-gradient-to-br {app.color} rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={app.icon}></path>
              </svg>
            </div>
            {#if app.available}
              <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Available</span>
            {:else}
              <span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Needs Data</span>
            {/if}
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-1">{app.name}</h3>
          <p class="text-gray-600 text-sm mb-3">{app.description}</p>
          {#if !app.available}
            <p class="text-xs text-orange-600">Import data to enable this application</p>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Data Management -->
  <div class="mb-8">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Data Management</h2>
    <div class="bg-white rounded-xl shadow-sm p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">Data Sources</h3>
        <button 
          on:click={() => window.location.href='/data-capture'}
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          Manage Data
        </button>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each project.dataSources as source}
          <div class="border border-gray-200 rounded-xl p-4">
            <div class="flex items-center justify-between">
              <h4 class="font-medium text-gray-900 capitalize">{source}</h4>
              <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Active</span>
            </div>
            <p class="text-sm text-gray-600 mt-2">
              {source === 'twitter' ? 'Social media posts and interactions' :
               source === 'reddit' ? 'Forum discussions and comments' :
               source === 'telegram' ? 'Messaging platform content' :
               'Data source content'}
            </p>
          </div>
        {/each}
        
        <!-- Add Data Source -->
        <div class="border-2 border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-center hover:border-gray-400 transition-colors cursor-pointer"
             on:click={() => window.location.href='/data-capture'}>
          <div class="text-center">
            <svg class="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            <p class="text-sm text-gray-600">Add Data Source</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Team Members -->
  <div>
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Team Members</h2>
    <div class="bg-white rounded-xl shadow-sm p-6">
      <div class="space-y-4">
        {#each project.teamMembers as member, i}
          <div class="flex items-center justify-between py-2">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                <span class="text-sm font-medium text-gray-700">{member.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900">{member}</div>
                <div class="text-xs text-gray-500">{i === 0 ? 'Owner' : 'Member'}</div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
{:else}
  <!-- Loading or Project Not Found -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
    <h2 class="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h2>
    <p class="text-gray-600 mb-8">The project you're looking for doesn't exist or you don't have access to it.</p>
    <button 
      on:click={() => window.location.href='/projects'}
      class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors">
      Back to Projects
    </button>
  </div>
{/if}