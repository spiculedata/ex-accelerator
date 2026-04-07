<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { currentProject, setCurrentProject, loadCurrentProject, clearCurrentProject } from '$lib/stores/projectStore';

  interface DropdownItem {
    name: string;
    href: string;
    requiresProject: boolean;
    requiresWorkspace?: boolean;
    useWorkspace?: boolean;
    requiresDataType?: string;
  }

  interface NavItem {
    name: string;
    href: string;
    current: boolean;
    requiresProject: boolean;
    requiresDataType?: string;
    hasDropdown?: boolean;
    dropdownItems?: DropdownItem[];
  }

  let mobileMenuOpen = false;
  let projectSwitcherOpen = false;
  let workspaceSwitcherOpen = false;
  let openDropdowns: Record<string, boolean> = {}; // Track which dropdowns are open
  let availableProjects: any[] = [];
  let availableWorkspaces: any[] = [];
  let currentWorkspace: any = null;
  let workspaceDataSummary: any = null;
  let workspaceSummaries: Record<string, any> = {}; // Cache summaries for all workspaces

  onMount(() => {
    loadCurrentProject();
    loadProjects();

    // Load workspaces if project is selected
    if ($currentProject) {
      loadWorkspaces($currentProject.id);
    }

    // Load current workspace from localStorage
    if (typeof window !== 'undefined') {
      const savedWorkspaceId = localStorage.getItem('currentWorkspace');
      if (savedWorkspaceId) {
        // Load workspace details and dataset summary
        fetch(`/api/workspaces?id=${savedWorkspaceId}`)
          .then(response => response.json())
          .then(result => {
            if (result.success && result.workspace) {
              currentWorkspace = result.workspace;
              loadWorkspaceDatasets(savedWorkspaceId);
            }
          })
          .catch(error => console.error('Error loading workspace:', error));
      }
    }

    // Click outside handler for project switcher and dropdowns
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.project-switcher')) {
        projectSwitcherOpen = false;
      }
      if (!target.closest('.workspace-switcher')) {
        workspaceSwitcherOpen = false;
      }
      if (!target.closest('.nav-dropdown') && !target.closest('.mobile-menu')) {
        openDropdowns = {};
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        projectSwitcherOpen = false;
        workspaceSwitcherOpen = false;
        openDropdowns = {};
        mobileMenuOpen = false;
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  async function loadProjects() {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      if (result.success) {
        availableProjects = result.projects || [];
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }

  async function loadWorkspaces(projectId: string) {
    try {
      const response = await fetch(`/api/workspaces?project_id=${projectId}`);
      const result = await response.json();
      if (result.success) {
        availableWorkspaces = result.workspaces || [];

        // Load dataset summaries for all workspaces
        await loadAllWorkspaceSummaries();
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  }

  async function loadAllWorkspaceSummaries() {
    // Load summaries for all available workspaces in parallel
    const summaryPromises = availableWorkspaces.map(async (workspace) => {
      try {
        const response = await fetch(`/api/workspaces/${workspace.id}/dataset-summary`);
        const result = await response.json();
        if (result.success) {
          workspaceSummaries[workspace.id] = result.summary;
        }
      } catch (error) {
        console.error(`Error loading summary for workspace ${workspace.id}:`, error);
      }
    });

    await Promise.all(summaryPromises);
    // Trigger reactivity
    workspaceSummaries = { ...workspaceSummaries };
  }

  async function loadWorkspaceDatasets(workspaceId: string) {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/dataset-summary`);
      const result = await response.json();
      if (result.success) {
        workspaceDataSummary = result.summary;
      }
    } catch (error) {
      console.error('Error loading workspace datasets:', error);
    }
  }

  function selectWorkspace(workspace: any) {
    currentWorkspace = workspace;
    workspaceSwitcherOpen = false;

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentWorkspace', workspace.id.toString());
    }

    // Load dataset summary for this workspace
    loadWorkspaceDatasets(workspace.id.toString());

    // Navigate to the workspace detail page
    goto(`/workspaces/${workspace.id}`);
  }

  // Reload workspaces when project changes
  $: if ($currentProject) {
    loadWorkspaces($currentProject.id);
  }

  // Helper functions to check data availability
  $: hasGdeltData = workspaceDataSummary?.types?.includes('gdelt_events') || false;
  $: hasAndroidData = workspaceDataSummary?.types?.includes('android') || false;
  $: hasSocialMediaData = workspaceDataSummary?.platforms?.some((p: string) =>
    ['twitter', 'facebook', 'instagram', 'telegram', 'youtube', 'linkedin', 'reddit', 'tiktok'].includes(p)
  ) || false;

  function getDatasetTypeBadges(summary: any): { label: string; color: string }[] {
    if (!summary || !summary.types || summary.types.length === 0) {
      return [];
    }

    const badgeMap: Record<string, { label: string; color: string }> = {
      'social_media': { label: 'Social', color: 'blue' },
      'gdelt_events': { label: 'GDELT', color: 'amber' },
      'android': { label: 'Android', color: 'purple' },
      'telegram': { label: 'Telegram', color: 'sky' },
      'youtube': { label: 'YouTube', color: 'red' }
    };

    return summary.types
      .map((type: string) => badgeMap[type] || { label: type, color: 'gray' })
      .slice(0, 3); // Limit to 3 badges
  }

  function formatRecordCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }
  
  const navigationItems: NavItem[] = [
    { name: 'Home', href: '/', current: false, requiresProject: false },
    {
      name: 'Dashboards',
      href: '/dashboards',
      current: false,
      requiresProject: false,
      hasDropdown: true,
      dropdownItems: [
        { name: 'Overview', href: '/workspaces', requiresProject: true, requiresWorkspace: true, useWorkspace: true },
        { name: 'Analytics Dashboard', href: '/dashboards', requiresProject: false, useWorkspace: true },
        { name: 'Brand Sentiment', href: '/text-analytics/sentiment-analysis', requiresProject: false, requiresDataType: 'social', useWorkspace: true },
        { name: 'GDELT Events', href: '/gdelt/intelligence', requiresProject: false },
        { name: 'Android Analytics', href: '/android-analytics', requiresProject: true, requiresDataType: 'android', useWorkspace: true }
      ]
    },
    { name: 'Research Investigation', href: '/text-analytics/research-investigation', current: false, requiresProject: true },
    {
      name: 'Tools',
      href: '#',
      current: false,
      requiresProject: false,
      hasDropdown: true,
      dropdownItems: [
        { name: 'Text Analytics', href: '/text-analytics', requiresProject: false, useWorkspace: true },
        { name: 'Data Management', href: '/data-management', requiresProject: true, useWorkspace: true },
        { name: 'Data Sharing', href: '/data-sharing', requiresProject: false },
        { name: 'Image Processing', href: '/image-processing', requiresProject: false },
        { name: 'Workflow Builder', href: '/data-management/workflow-builder', requiresProject: true }
      ]
    }
  ];

  function toggleDropdown(itemName: string) {
    openDropdowns = {
      ...openDropdowns,
      [itemName]: !openDropdowns[itemName]
    };
  }

  function hasRequiredData(item: any): boolean {
    if (!item.requiresDataType || !currentWorkspace) {
      return true; // No data requirement or no workspace selected
    }

    switch (item.requiresDataType) {
      case 'gdelt':
        return hasGdeltData;
      case 'android':
        return hasAndroidData;
      case 'social':
        return hasSocialMediaData;
      default:
        return true;
    }
  }

  function getDataAvailabilityIcon(item: any): string {
    if (!item.requiresDataType || !currentWorkspace) {
      return ''; // No icon if no data requirement or no workspace
    }

    return hasRequiredData(item) ? '✓' : '⚠';
  }

  function getDataAvailabilityTooltip(item: any): string {
    if (!item.requiresDataType || !currentWorkspace) {
      return '';
    }

    if (hasRequiredData(item)) {
      return `${item.name} data available`;
    } else {
      const dataTypeName = item.requiresDataType === 'gdelt' ? 'GDELT' :
                           item.requiresDataType === 'android' ? 'Android' :
                           item.requiresDataType === 'social' ? 'Social Media' : 'required';
      return `No ${dataTypeName} datasets in this workspace`;
    }
  }

  function navigateToApp(item: any, event: Event) {
    event.preventDefault();

    if (item.requiresProject && !$currentProject) {
      // If app requires project but none selected, go to project selection
      goto('/projects');
    } else if (item.requiresWorkspace && !currentWorkspace) {
      // If app requires workspace but none selected, stay on current page or show message
      return;
    } else if (item.requiresDataType && !hasRequiredData(item)) {
      // Item requires specific data type that's not available
      // Don't navigate, the visual indicator shows it's disabled
      return;
    } else {
      // Build URL with workspace context if needed
      let url = item.href;

      if (item.useWorkspace && currentWorkspace) {
        // For workspace overview, go directly to the workspace page
        if (item.href === '/workspaces') {
          url = `/workspaces/${currentWorkspace.id}`;
        } else {
          // For other pages, add workspace as query parameter
          url = `${item.href}?workspace=${currentWorkspace.id}`;
        }
      }

      goto(url);
    }
  }
  
  $: currentPath = $page.url.pathname;
  $: updatedNavItems = navigationItems.map(item => ({
    ...item,
    current: item.href === currentPath
  }));
</script>

<nav aria-label="Main navigation" class="bg-white shadow-lg border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex h-16 items-center justify-between">
      <!-- Left: Logo + Nav Links -->
      <div class="flex items-center">
        <!-- Logo -->
        <a href="/" class="flex items-center mr-8">
          <div class="h-8 w-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center">
            <span class="text-white font-bold text-lg">SE</span>
          </div>
          <h1 class="ml-3 text-xl font-bold text-gray-900 whitespace-nowrap hidden sm:block">
            Social Explorer
          </h1>
        </a>

        <!-- Desktop Nav Links -->
        <div class="hidden lg:flex lg:items-center lg:space-x-1 border-l border-gray-200 pl-6">
          {#each updatedNavItems as item}
            {#if item.hasDropdown}
              <div class="relative nav-dropdown">
                <button
                  on:click={() => toggleDropdown(item.name)}
                  aria-expanded={openDropdowns[item.name] || false}
                  aria-haspopup="true"
                  class="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors {item.current
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
                >
                  {item.name}
                  <svg class="ml-1 w-3.5 h-3.5 transition-transform {openDropdowns[item.name] ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>

                {#if openDropdowns[item.name]}
                  <div class="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {#each (item.dropdownItems ?? []) as dropdownItem}
                      <a
                        href={dropdownItem.href}
                        on:click={(e) => navigateToApp(dropdownItem, e)}
                        class="block px-4 py-2.5 text-sm transition-colors {
                          (dropdownItem.requiresProject && !$currentProject) ||
                          (dropdownItem?.requiresWorkspace && !currentWorkspace) ||
                          (dropdownItem?.requiresDataType && !hasRequiredData(dropdownItem))
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                        }"
                        title={getDataAvailabilityTooltip(dropdownItem)}
                      >
                        <div class="flex items-center justify-between">
                          <span>{dropdownItem.name}</span>
                          {#if dropdownItem?.requiresDataType && currentWorkspace}
                            <span class="text-xs {hasRequiredData(dropdownItem) ? 'text-emerald-500' : 'text-amber-400'}">
                              {getDataAvailabilityIcon(dropdownItem)}
                            </span>
                          {/if}
                        </div>
                      </a>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else}
              <a
                href={item.href}
                on:click={(e) => navigateToApp(item, e)}
                class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {item.current
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
                aria-current={item.current ? 'page' : undefined}
              >
                {item.name}
              </a>
            {/if}
          {/each}
        </div>
      </div>

      <!-- Right: Context Switcher + Actions -->
      <div class="flex items-center space-x-3">
        <!-- Project/Workspace Context -->
        {#if $currentProject || availableProjects.length > 0}
          <div class="hidden md:flex items-center bg-gray-50 rounded-lg border border-gray-200 divide-x divide-gray-200">
            <!-- Project Switcher -->
            <div class="relative project-switcher">
              <button
                on:click={() => projectSwitcherOpen = !projectSwitcherOpen}
                aria-expanded={projectSwitcherOpen}
                aria-haspopup="true"
                class="flex items-center px-3 py-1.5 text-sm hover:bg-gray-100 rounded-l-lg transition-colors">
                <div class="w-5 h-5 bg-blue-600 rounded flex items-center justify-center mr-2">
                  <span class="text-white font-medium text-xs">{$currentProject?.name?.charAt(0) || 'P'}</span>
                </div>
                <span class="text-xs font-medium text-gray-700 truncate max-w-28">{$currentProject?.name || 'Select Project'}</span>
                <svg class="ml-1.5 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>

              <!-- Project Dropdown -->
              {#if projectSwitcherOpen}
                <div class="absolute top-full right-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-[100]">
                  <div class="p-4 border-b border-gray-200">
                    <h3 class="text-sm font-medium text-gray-900">Switch Project</h3>
                  </div>
                  <div class="max-h-64 overflow-y-auto">
                    {#each availableProjects as project}
                      <button
                        on:click={async () => {
                          projectSwitcherOpen = false;
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
                          projectSwitcherOpen = false;
                          goto('/');
                        }}
                        class="text-sm text-gray-600 hover:text-gray-900">
                        Clear Project
                      </button>
                      <button
                        on:click={() => {
                          goto('/projects');
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

            <!-- Workspace Switcher (in combined context bar) -->
            {#if $currentProject && availableWorkspaces.length > 0}
              <div class="relative workspace-switcher">
                <button
                  on:click={() => workspaceSwitcherOpen = !workspaceSwitcherOpen}
                  aria-expanded={workspaceSwitcherOpen}
                  aria-haspopup="true"
                  class="flex items-center px-3 py-1.5 text-sm hover:bg-gray-100 rounded-r-lg transition-colors">
                  <svg class="w-4 h-4 mr-1.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                  </svg>
                  <span class="text-xs font-medium text-gray-700 truncate max-w-24">
                    {currentWorkspace?.name || 'Workspace'}
                  </span>
                  <svg class="ml-1.5 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>

                <!-- Workspace Dropdown -->
                {#if workspaceSwitcherOpen}
                  <div class="absolute top-full right-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-[100]">
                    <div class="p-4 border-b border-gray-200">
                      <h3 class="text-sm font-medium text-gray-900">Switch Workspace</h3>
                    </div>
                    <div class="max-h-64 overflow-y-auto">
                      {#each availableWorkspaces as workspace}
                        {@const summary = workspaceSummaries[workspace.id]}
                        {@const badges = summary ? getDatasetTypeBadges(summary) : []}
                        <button
                          on:click={() => selectWorkspace(workspace)}
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
                                  <span class="text-xs text-gray-400">•</span>
                                  <span class="text-xs text-gray-600 font-medium">{formatRecordCount(summary.recordCount)} posts</span>
                                {/if}
                              </div>
                              {#if badges.length > 0}
                                <div class="flex items-center space-x-1 mt-1.5">
                                  {#each badges as badge}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-{badge.color}-100 text-{badge.color}-800">
                                      {badge.label}
                                    </span>
                                  {/each}
                                  {#if summary?.lastSync}
                                    <span class="text-xs text-gray-500 ml-1">• {summary.lastSync}</span>
                                  {/if}
                                </div>
                              {:else if summary}
                                <div class="text-xs text-gray-400 italic mt-1">No datasets</div>
                              {/if}
                            </div>
                          </div>
                        </button>
                      {/each}
                    </div>
                    <div class="p-4 border-t border-gray-200">
                      <button
                        on:click={() => {
                          goto(`/projects/${$currentProject.id}`);
                          workspaceSwitcherOpen = false;
                        }}
                        class="text-sm text-indigo-600 hover:text-indigo-800 w-full text-right">
                        Manage Workspaces
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {:else}
          <button
            on:click={() => goto('/projects')}
            class="hidden md:flex items-center px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300 border-dashed">
            <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Select Project
          </button>
        {/if}

        <!-- Mobile menu button -->
        <div class="lg:hidden">
          <button
            type="button"
            class="text-gray-600 hover:text-gray-900 hover:bg-gray-50 p-2 rounded-md"
            on:click={() => mobileMenuOpen = !mobileMenuOpen}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle menu"
          >
            <span class="sr-only">Open main menu</span>
            {#if mobileMenuOpen}
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            {:else}
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Mobile menu -->
  {#if mobileMenuOpen}
    <div class="lg:hidden border-t border-gray-200 bg-white mobile-menu">
      <div class="px-2 pt-2 pb-3 space-y-1">
        {#each updatedNavItems as item}
          {#if item.hasDropdown}
            <!-- Mobile dropdown navigation item -->
            <div class="space-y-1">
              <button
                on:click={() => toggleDropdown(item.name)}
                class="w-full flex items-center justify-between px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {item.requiresProject && !$currentProject 
                  ? 'text-gray-400 hover:text-gray-500 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
              >
                <span>
                  {item.name}
                  {#if item.requiresProject && !$currentProject}
                    <span class="ml-1 text-xs text-gray-400">*</span>
                  {/if}
                </span>
                <svg class="w-4 h-4 transition-transform {openDropdowns[item.name] ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              
              {#if openDropdowns[item.name]}
                <div class="pl-6 space-y-1">
                  {#each (item.dropdownItems ?? []) as dropdownItem}
                    <a
                      href={dropdownItem.href}
                      on:click={(e) => {
                        navigateToApp(dropdownItem, e);
                        mobileMenuOpen = false;
                        openDropdowns = {};
                      }}
                      class="flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 {
                        (dropdownItem.requiresProject && !$currentProject) ||
                        (dropdownItem?.requiresWorkspace && !currentWorkspace) ||
                        (dropdownItem?.requiresDataType && !hasRequiredData(dropdownItem))
                        ? 'text-gray-400 hover:text-gray-500 cursor-not-allowed'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
                      title={getDataAvailabilityTooltip(dropdownItem)}
                    >
                      <span>{dropdownItem.name}</span>
                      <div class="flex items-center space-x-1">
                        {#if dropdownItem?.requiresDataType && currentWorkspace}
                          <span class="text-xs {hasRequiredData(dropdownItem) ? 'text-emerald-600' : 'text-amber-500'}">
                            {getDataAvailabilityIcon(dropdownItem)}
                          </span>
                        {/if}
                        {#if dropdownItem?.requiresWorkspace && !currentWorkspace}
                          <span class="text-xs text-amber-500">↻</span>
                        {:else if dropdownItem.requiresProject && !$currentProject}
                          <span class="text-xs text-gray-400">*</span>
                        {/if}
                      </div>
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <!-- Regular mobile navigation item -->
            <a
              href={item.href}
              on:click={(e) => {
                navigateToApp(item, e);
                mobileMenuOpen = false;
              }}
              class="flex items-center justify-between px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {item.current
                ? 'bg-blue-100 text-blue-700'
                : (item.requiresProject && !$currentProject) || (item?.requiresDataType && !hasRequiredData(item))
                  ? 'text-gray-400 hover:text-gray-500 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
              title={getDataAvailabilityTooltip(item)}
              aria-current={item.current ? 'page' : undefined}
            >
              <span>{item.name}</span>
              <div class="flex items-center space-x-1">
                {#if item?.requiresDataType && currentWorkspace}
                  <span class="text-xs {hasRequiredData(item) ? 'text-emerald-600' : 'text-amber-500'}">
                    {getDataAvailabilityIcon(item)}
                  </span>
                {:else if item.requiresProject && !$currentProject}
                  <span class="text-xs text-gray-400">*</span>
                {/if}
              </div>
            </a>
          {/if}
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