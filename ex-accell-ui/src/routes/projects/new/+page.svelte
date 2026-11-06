<script lang="ts">
  import { goto } from '$app/navigation';
  import { setCurrentProject } from '$lib/stores/projectStore';
  
  let projectName = '';
  let projectDescription = '';
  let projectType = 'social-media';
  let dataSources: any[] = [];
  let teamMembers: any[] = [];
  let newMemberEmail = '';
  let isCreating = false;

  const projectTypes = [
    { value: 'social-media', label: 'Social Media Analysis', description: 'Analyze sentiment, trends, and engagement from social platforms' },
    { value: 'market-research', label: 'Market Research', description: 'Track brand mentions, competitor analysis, and market sentiment' },
    { value: 'customer-feedback', label: 'Customer Feedback', description: 'Process customer reviews, surveys, and support interactions' },
    { value: 'content-analysis', label: 'Content Analysis', description: 'Analyze documents, articles, and multimedia content' }
  ];

  const availableDataSources = [
    { id: 'twitter', name: 'Twitter/X', type: 'social' },
    { id: 'reddit', name: 'Reddit', type: 'social' },
    { id: 'telegram', name: 'Telegram', type: 'social' },
    { id: 'youtube', name: 'YouTube', type: 'social' },
    { id: 'instagram', name: 'Instagram', type: 'social' },
    { id: 'linkedin', name: 'LinkedIn', type: 'social' },
    { id: 'csv-upload', name: 'CSV Upload', type: 'upload' },
    { id: 'json-upload', name: 'JSON Upload', type: 'upload' },
    { id: 'text-files', name: 'Text Files', type: 'upload' }
  ];

  function toggleDataSource(sourceId: string) {
    if (dataSources.includes(sourceId)) {
      dataSources = dataSources.filter(id => id !== sourceId);
    } else {
      dataSources = [...dataSources, sourceId];
    }
  }

  function addTeamMember() {
    if (newMemberEmail.trim() && !teamMembers.includes(newMemberEmail.trim())) {
      teamMembers = [...teamMembers, newMemberEmail.trim()];
      newMemberEmail = '';
    }
  }

  function removeTeamMember(email: string) {
    teamMembers = teamMembers.filter(member => member !== email);
  }

  async function createProject() {
    if (!projectName.trim()) return;

    isCreating = true;

    try {
      // Create project via API with database persistence
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
          project_type: projectType,
          data_sources: dataSources,
          team_members: teamMembers
        })
      });

      const result = await response.json();

      if (result.success && result.project) {
        // Redirect to the new project (it will load from database)
        goto(`/projects/${result.project.id}`);
      } else {
        alert('Failed to create project: ' + (result.error || 'Unknown error'));
        isCreating = false;
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project');
      isCreating = false;
    }
  }

  function validateForm() {
    return projectName.trim().length > 0 && dataSources.length > 0;
  }
</script>

<svelte:head>
  <title>Create New Project - Social Explorer</title>
  <meta name="description" content="Create a new data analysis project" />
</svelte:head>

<!-- Header -->
<div class="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex items-center">
      <button 
        on:click={() => window.history.back()}
        class="mr-4 p-2 text-white hover:bg-white/20 rounded-xl transition-colors">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
      </button>
      <div>
        <h1 class="text-3xl font-bold text-white">Create New Project</h1>
        <p class="text-blue-100 mt-2">Set up a new data analysis workspace</p>
      </div>
    </div>
  </div>
</div>

<!-- Form Content -->
<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="bg-white rounded-xl shadow-sm border border-gray-200">
    <div class="p-8">
      <form on:submit|preventDefault={createProject} class="space-y-8">
        
        <!-- Basic Information -->
        <div>
          <h2 class="text-xl font-semibold text-gray-900 mb-6">Basic Information</h2>
          <div class="grid grid-cols-1 gap-6">
            <div>
              <label for="project-name" class="block text-sm font-medium text-gray-700 mb-2">
                Project Name *
              </label>
              <input 
                id="project-name"
                bind:value={projectName}
                type="text" 
                required
                placeholder="e.g., Brand Sentiment Analysis Q1 2025"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            </div>
            
            <div>
              <label for="project-description" class="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea 
                id="project-description"
                bind:value={projectDescription}
                rows="3"
                placeholder="Describe the goals and scope of this project..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
          </div>
        </div>

        <!-- Project Type -->
        <div>
          <h2 class="text-xl font-semibold text-gray-900 mb-6">Project Type</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each projectTypes as type}
              <label class="relative cursor-pointer">
                <input 
                  bind:group={projectType}
                  type="radio" 
                  value={type.value}
                  class="sr-only">
                <div class="border-2 rounded-xl p-4 transition-all {projectType === type.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}">
                  <div class="flex items-center">
                    <div class="w-4 h-4 border-2 rounded-full mr-3 {projectType === type.value ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}">
                      {#if projectType === type.value}
                        <div class="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                      {/if}
                    </div>
                    <div>
                      <h3 class="font-medium text-gray-900">{type.label}</h3>
                      <p class="text-sm text-gray-600 mt-1">{type.description}</p>
                    </div>
                  </div>
                </div>
              </label>
            {/each}
          </div>
        </div>

        <!-- Data Sources -->
        <div>
          <h2 class="text-xl font-semibold text-gray-900 mb-6">Data Sources *</h2>
          <p class="text-sm text-gray-600 mb-4">Select the data sources you plan to use in this project</p>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each availableDataSources as source}
              <label class="relative cursor-pointer">
                <input 
                  type="checkbox"
                  on:change={() => toggleDataSource(source.id)}
                  class="sr-only">
                <div class="border-2 rounded-xl p-4 transition-all {dataSources.includes(source.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}">
                  <div class="flex items-center">
                    <div class="w-5 h-5 border-2 rounded mr-3 flex items-center justify-center {dataSources.includes(source.id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}">
                      {#if dataSources.includes(source.id)}
                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                        </svg>
                      {/if}
                    </div>
                    <div>
                      <h3 class="font-medium text-gray-900">{source.name}</h3>
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {source.type === 'social' ? 'bg-blue-100 text-blue-800' : 'bg-blue-100 text-blue-800'} mt-1">
                        {source.type === 'social' ? 'Social Media' : 'File Upload'}
                      </span>
                    </div>
                  </div>
                </div>
              </label>
            {/each}
          </div>
        </div>

        <!-- Team Members -->
        <div>
          <h2 class="text-xl font-semibold text-gray-900 mb-6">Team Members</h2>
          <p class="text-sm text-gray-600 mb-4">Add team members who will have access to this project</p>
          
          <div class="flex space-x-2 mb-4">
            <input 
              bind:value={newMemberEmail}
              type="email" 
              placeholder="colleague@company.com"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <button 
              type="button"
              on:click={addTeamMember}
              disabled={!newMemberEmail.trim()}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors">
              Add
            </button>
          </div>

          {#if teamMembers.length > 0}
            <div class="space-y-2">
              {#each teamMembers as member}
                <div class="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                  <span class="text-sm text-gray-900">{member}</span>
                  <button 
                    type="button"
                    on:click={() => removeTeamMember(member)}
                    class="text-red-600 hover:text-red-800 text-sm">
                    Remove
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Actions -->
        <div class="flex justify-between items-center pt-6 border-t border-gray-200">
          <button 
            type="button"
            on:click={() => window.history.back()}
            class="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          
          <button 
            type="submit"
            disabled={!validateForm() || isCreating}
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors flex items-center">
            {#if isCreating}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Project...
            {:else}
              Create Project
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>