<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { availableProjects, setCurrentProject, currentProject } from '$lib/stores/projectStore';
  
  // Get project ID from URL
  $: projectId = $page.params.id;

  let project: any = null;
  let workspaces: any[] = [];
  let loading = true;
  let showCreateWorkspace = false;
  let newWorkspaceName = '';
  let newWorkspaceDescription = '';
  let newWorkspaceType = 'general';

  onMount(async () => {
    await loadProject();
  });

  async function loadProject() {
    loading = true;
    try {
      // Load project details
      const projectResponse = await fetch(`/api/projects?id=${projectId}`);
      const projectResult = await projectResponse.json();

      if (projectResult.success && projectResult.project) {
        project = projectResult.project;
        setCurrentProject(project.id.toString());

        // Load workspaces for this project
        const workspacesResponse = await fetch(`/api/workspaces?project_id=${projectId}`);
        const workspacesResult = await workspacesResponse.json();

        if (workspacesResult.success) {
          workspaces = workspacesResult.workspaces || [];
        }
      } else {
        // Project not found, redirect
        window.location.href = '/projects';
      }
    } catch (error) {
      console.error('Error loading project:', error);
      window.location.href = '/projects';
    } finally {
      loading = false;
    }
  }

  async function createWorkspace() {
    if (!newWorkspaceName.trim()) return;

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: parseInt(projectId),
          name: newWorkspaceName,
          description: newWorkspaceDescription,
          workspace_type: newWorkspaceType,
          created_by: 'current_user@example.com' // TODO: Get from auth
        })
      });

      const result = await response.json();

      if (result.success) {
        // Reload workspaces
        await loadProject();
        // Reset form
        showCreateWorkspace = false;
        newWorkspaceName = '';
        newWorkspaceDescription = '';
        newWorkspaceType = 'general';
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
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
      available: project?.totalPosts > 0
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
            <div class="font-medium">{project?.totalPosts || 0.toLocaleString()} posts</div>
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
      <div class="text-2xl font-bold text-blue-600 mb-1">{project?.totalPosts || 0.toLocaleString()}</div>
      <div class="text-sm text-gray-600">Total Posts</div>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6 text-center">
      <div class="text-2xl font-bold text-blue-600 mb-1">{project?.dataSources || [].length}</div>
      <div class="text-sm text-gray-600">Data Sources</div>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6 text-center">
      <div class="text-2xl font-bold text-blue-600 mb-1">{project?.teamMembers || [].length}</div>
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

  <!-- Workspaces Section -->
  <div class="mb-8">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Workspaces</h2>
        <p class="text-sm text-gray-600 mt-1">Organize your analysis into separate workspaces ({workspaces.length})</p>
      </div>
      <button
        on:click={() => showCreateWorkspace = !showCreateWorkspace}
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
        + New Workspace
      </button>
    </div>

    <!-- Create Workspace Form -->
    {#if showCreateWorkspace}
      <div class="mb-6 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Create New Workspace</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Workspace Name *</label>
            <input
              bind:value={newWorkspaceName}
              type="text"
              placeholder="e.g., Twitter Analysis"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Workspace Type</label>
            <select
              bind:value={newWorkspaceType}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="general">General</option>
              <option value="analysis">Analysis</option>
              <option value="exploration">Exploration</option>
              <option value="reporting">Reporting</option>
            </select>
          </div>
        </div>
        <div class="mt-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            bind:value={newWorkspaceDescription}
            placeholder="Describe the purpose of this workspace..."
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>
        <div class="mt-4 flex items-center justify-end space-x-3">
          <button
            on:click={() => showCreateWorkspace = false}
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            on:click={createWorkspace}
            disabled={!newWorkspaceName.trim()}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Create Workspace
          </button>
        </div>
      </div>
    {/if}

    <!-- Workspaces Grid -->
    {#if workspaces.length === 0}
      <div class="bg-white rounded-xl shadow-sm p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
        </svg>
        <p class="mt-2 text-sm font-medium text-gray-900">No workspaces yet</p>
        <p class="text-xs text-gray-600 mt-1">Create a workspace to organize your analysis</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each workspaces as workspace}
          <div class="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer" on:click={() => window.location.href = `/workspaces/${workspace.id}`}>
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1">
                <h3 class="text-base font-semibold text-gray-900">{workspace.name}</h3>
                <div class="flex items-center mt-2 space-x-2">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {workspace.workspace_type}
                  </span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {workspace.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                    {workspace.status}
                  </span>
                </div>
              </div>
            </div>
            {#if workspace.description}
              <p class="text-sm text-gray-600 mb-4 line-clamp-2">{workspace.description}</p>
            {/if}
            <div class="flex items-center justify-between pt-4 border-t border-gray-100">
              <div class="flex items-center text-xs text-gray-500">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
                </svg>
                {workspace.data_source_count || 0} sources
              </div>
              <div class="flex items-center text-xs text-gray-500">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                {workspace.total_records ? workspace.total_records.toLocaleString() : '0'} records
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
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
        {#each project?.dataSources || [] as source}
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
        {#each project?.teamMembers || [] as member, i}
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