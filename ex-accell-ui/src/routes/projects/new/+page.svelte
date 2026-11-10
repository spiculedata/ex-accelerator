<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { goto } from '$app/navigation';
  import { setCurrentProject } from '$lib/stores/projectStore';
  import { createFailureMessage, isEmail, nameProblem } from '$lib/utils/projectForm';
  
  let projectName = '';
  let projectDescription = '';
  let projectType = 'social-media';
  let teamMembers: any[] = [];
  let newMemberEmail = '';
  let isCreating = false;
  // Problems are shown next to the field they belong to, not in a browser alert
  let nameError: string | null = null;
  let memberError: string | null = null;
  let formError: string | null = null;

  const projectTypes = [
    { value: 'social-media', label: 'Social Media Analysis', description: 'Analyze sentiment, trends, and engagement from social platforms' },
    { value: 'market-research', label: 'Market Research', description: 'Track brand mentions, competitor analysis, and market sentiment' },
    { value: 'customer-feedback', label: 'Customer Feedback', description: 'Process customer reviews, surveys, and support interactions' },
    { value: 'content-analysis', label: 'Content Analysis', description: 'Analyze documents, articles, and multimedia content' }
  ];

  function addTeamMember() {
    const email = newMemberEmail.trim();
    if (!email) return;
    if (!isEmail(email)) {
      memberError = 'Enter a full email address, such as name@company.com';
      return;
    }
    memberError = null;
    if (!teamMembers.includes(email)) teamMembers = [...teamMembers, email];
    newMemberEmail = '';
  }

  function removeTeamMember(email: string) {
    teamMembers = teamMembers.filter(member => member !== email);
  }

  async function createProject() {
    nameError = nameProblem(projectName);
    formError = null;
    if (nameError) {
      document.getElementById('project-name')?.focus();
      return;
    }

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
          team_members: teamMembers
        })
      });

      const result = await response.json();

      if (result.success && result.project) {
        // Make it the open project, so the header and the next pages are about the project just created
        try {
          await setCurrentProject(String(result.project.id));
        } catch (error) {
          console.error('Could not open the new project:', error); // it was created; go to it regardless
        }
        goto(`/projects/${result.project.id}`);
      } else {
        const failure = createFailureMessage(result.error);
        if (failure.field === 'name') {
          nameError = failure.message;
          document.getElementById('project-name')?.focus();
        }
        else formError = failure.message;
        isCreating = false;
      }
    } catch (error) {
      console.error('Error creating project:', error);
      formError = createFailureMessage(undefined).message;
      isCreating = false;
    }
  }

</script>

<svelte:head>
  <title>Create New Project - Social Explorer</title>
  <meta name="description" content="Create a new data analysis project" />
</svelte:head>

<PageHeader
  title="Create New Project"
  subtitle="Set up a new data analysis workspace"
  backHref="/projects"
  showProject={false}
  iconPath="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />

<!-- Form Content -->
<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="bg-white rounded-xl shadow-sm border border-gray-200">
    <div class="p-8">
      <form on:submit|preventDefault={createProject} class="space-y-8" novalidate>
        
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
                on:input={() => (nameError = null)}
                type="text" 
                aria-required="true"
                aria-invalid={nameError ? 'true' : undefined}
                aria-describedby={nameError ? 'project-name-error' : undefined}
                placeholder="e.g., Brand Sentiment Analysis Q1 2025"
                class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {nameError ? 'border-danger-500' : 'border-gray-300'}">
              {#if nameError}
                <p id="project-name-error" role="alert" class="mt-1 text-sm text-danger-700">{nameError}</p>
              {/if}
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

        <!-- Where data comes from: datasets are linked per workspace, not chosen here -->
        <div class="rounded-xl border border-ink-200 bg-ink-50 px-5 py-4">
          <h2 class="text-base font-semibold text-ink-900">Where the data comes from</h2>
          <p class="mt-1 text-sm text-ink-600">
            You link datasets to a workspace after the project is created, so there is nothing to choose here.
          </p>
        </div>

        <!-- Team Members -->
        <div>
          <h2 class="text-xl font-semibold text-gray-900 mb-6">Team Members</h2>
          <p class="text-sm text-gray-600 mb-4">Add team members who will have access to this project</p>
          
          <div class="flex space-x-2 mb-4">
            <input 
              bind:value={newMemberEmail}
              on:input={() => (memberError = null)}
              on:keydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTeamMember(); } }}
              type="email" 
              aria-label="Team member email"
              aria-invalid={memberError ? 'true' : undefined}
              aria-describedby={memberError ? 'member-error' : undefined}
              placeholder="colleague@company.com"
              class="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {memberError ? 'border-danger-500' : 'border-gray-300'}">
            <button 
              type="button"
              on:click={addTeamMember}
              disabled={!newMemberEmail.trim()}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors">
              Add
            </button>
          </div>
          {#if memberError}
            <p id="member-error" role="alert" class="-mt-2 mb-4 text-sm text-danger-700">{memberError}</p>
          {/if}

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

        {#if formError}
          <p role="alert" class="rounded-md border border-danger-300 bg-danger-50 px-4 py-3 text-sm text-danger-900">{formError}</p>
        {/if}

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
            disabled={isCreating}
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