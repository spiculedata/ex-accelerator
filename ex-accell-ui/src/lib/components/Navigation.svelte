<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { currentProject, availableProjects, setCurrentProject, loadCurrentProject, clearCurrentProject } from '$lib/stores/projectStore';
  
  let mobileMenuOpen = false;
  let projectSwitcherOpen = false;

  onMount(() => {
    loadCurrentProject();
    
    // Click outside handler for project switcher
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.project-switcher')) {
        projectSwitcherOpen = false;
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
  
  const navigationItems = [
    { name: 'Home', href: '/', current: false, requiresProject: false },
    { name: 'Dashboards', href: '/dashboards', current: false, requiresProject: true },
    { name: 'Text Analytics', href: '/text-analytics', current: false, requiresProject: true },
    { name: 'Image Processing', href: '/image-processing', current: false, requiresProject: true },
    { name: 'Data Capture', href: '/data-capture', current: false, requiresProject: false }
  ];

  function navigateToApp(item: any, event: Event) {
    event.preventDefault();
    
    if (item.requiresProject && !$currentProject) {
      // If app requires project but none selected, go to project selection
      window.location.href = '/projects';
    } else {
      // Otherwise go directly to the app
      window.location.href = item.href;
    }
  }
  
  $: currentPath = $page.url.pathname;
  $: updatedNavItems = navigationItems.map(item => ({
    ...item,
    current: item.href === currentPath
  }));
</script>

<nav class="bg-white shadow-lg border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16">
      <!-- Logo and brand -->
      <div class="flex items-center">
        <div class="flex-shrink-0 flex items-center">
          <div class="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-lg">SE</span>
          </div>
          <h1 class="ml-3 text-xl font-bold text-gray-900">
            Social Explorer
          </h1>
        </div>

        <!-- Project Switcher -->
        {#if $currentProject}
          <div class="ml-6 relative project-switcher">
            <button
              on:click={() => projectSwitcherOpen = !projectSwitcherOpen}
              class="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
              <div class="flex items-center">
                <div class="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center mr-2">
                  <span class="text-white font-medium text-xs">{$currentProject.name.charAt(0)}</span>
                </div>
                <span class="max-w-32 truncate">{$currentProject.name}</span>
                <svg class="ml-2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </button>

            <!-- Project Dropdown -->
            {#if projectSwitcherOpen}
              <div class="absolute top-full left-0 mt-1 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div class="p-4 border-b border-gray-200">
                  <h3 class="text-sm font-medium text-gray-900">Switch Project</h3>
                </div>
                <div class="max-h-64 overflow-y-auto">
                  {#each availableProjects as project}
                    <button
                      on:click={() => {
                        setCurrentProject(project.id);
                        projectSwitcherOpen = false;
                      }}
                      class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors {$currentProject?.id === project.id ? 'bg-blue-50' : ''}">
                      <div class="flex items-center">
                        <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
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
                        projectSwitcherOpen = false;
                      }}
                      class="text-sm text-gray-600 hover:text-gray-900">
                      Clear Project
                    </button>
                    <button
                      on:click={() => {
                        window.location.href = '/projects';
                        projectSwitcherOpen = false;
                      }}
                      class="text-sm text-blue-600 hover:text-blue-800">
                      Manage Projects
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <div class="ml-6">
            <button
              on:click={() => window.location.href = '/projects'}
              class="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300 border-dashed">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              Select Project
            </button>
          </div>
        {/if}
      </div>

      <!-- Desktop navigation -->
      <div class="hidden md:flex md:items-center md:space-x-6">
        {#each updatedNavItems as item}
          <a
            href={item.href}
            on:click={(e) => navigateToApp(item, e)}
            class="px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 {item.current 
              ? 'bg-blue-100 text-blue-700' 
              : item.requiresProject && !$currentProject 
                ? 'text-gray-400 hover:text-gray-500 cursor-not-allowed' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
          >
            {item.name}
            {#if item.requiresProject && !$currentProject}
              <span class="ml-1 text-xs text-gray-400">*</span>
            {/if}
          </a>
        {/each}
        
        <!-- Project requirement notice -->
        {#if !$currentProject}
          <div class="px-3 py-1 text-xs text-gray-400">
            * Requires project selection
          </div>
        {/if}
        
        <!-- User Profile -->
        <div class="flex items-center space-x-3">
          <button class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-200">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </button>
          <button class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-200 relative">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5-5-5h5v-13"></path>
            </svg>
            <div class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
          </button>
          <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span class="text-white font-medium text-sm">JD</span>
          </div>
        </div>
      </div>

      <!-- Mobile menu button -->
      <div class="md:hidden flex items-center">
        <button
          type="button"
          class="text-gray-600 hover:text-gray-900 hover:bg-gray-50 p-2 rounded-md"
          on:click={() => mobileMenuOpen = !mobileMenuOpen}
        >
          <span class="sr-only">Open main menu</span>
          {#if mobileMenuOpen}
            <!-- X icon -->
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          {:else}
            <!-- Hamburger icon -->
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Mobile menu -->
  {#if mobileMenuOpen}
    <div class="md:hidden border-t border-gray-200 bg-white">
      <div class="px-2 pt-2 pb-3 space-y-1">
        {#each updatedNavItems as item}
          <a
            href={item.href}
            on:click={(e) => {
              navigateToApp(item, e);
              mobileMenuOpen = false;
            }}
            class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {item.current 
              ? 'bg-blue-100 text-blue-700' 
              : item.requiresProject && !$currentProject 
                ? 'text-gray-400 hover:text-gray-500 cursor-not-allowed' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
          >
            {item.name}
            {#if item.requiresProject && !$currentProject}
              <span class="ml-1 text-xs text-gray-400">*</span>
            {/if}
          </a>
        {/each}
        
        <!-- Project requirement notice (mobile) -->
        {#if !$currentProject}
          <div class="px-3 py-1 text-xs text-gray-400">
            * Requires project selection
          </div>
        {/if}
        
        <div class="px-3 py-2 border-t border-gray-200">
          <div class="flex items-center space-x-3 mt-3">
            <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span class="text-white font-medium text-sm">JD</span>
            </div>
            <div>
              <div class="text-sm font-medium text-gray-900">John Doe</div>
              <div class="text-xs text-gray-500">john@example.com</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</nav>