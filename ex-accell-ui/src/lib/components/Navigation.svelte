<script lang="ts">
  import { dataSourceBadgeClass } from '$lib/utils/categoryColours';
  import { signOut, signOutEverywhere } from '$lib/utils/signOut';
  import ChangePasswordForm from '$lib/components/ChangePasswordForm.svelte';
  import { initials } from '$lib/utils/initials';
  import BrandMark from '$lib/components/ui/BrandMark.svelte';
  import UserMenu from '$lib/components/UserMenu.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { workspaceIdFromRoute } from '$lib/utils/workspaceRoute';
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
      // A page that names its own workspace decides it; the remembered one is only for pages that do not
      if (savedWorkspaceId && !routeWorkspaceId) {
        // Load workspace details and dataset summary
        fetch(`/api/workspaces?id=${savedWorkspaceId}`)
          .then(response => response.json())
          .then(result => {
            if (result.success && result.workspace?.id !== undefined && !routeWorkspaceId) {
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

  // The header names the workspace of the page you are on, however you got there (a link, a new workspace, the switcher).
  // One request per workspace at a time; the answer is used only if the page is still about that workspace.
  let loadingWorkspaceId: string | null = null;
  let missingWorkspaceId: string | null = null;
  $: routeWorkspaceId = workspaceIdFromRoute($page.route.id, $page.params, $page.url.searchParams);
  $: if (routeWorkspaceId !== missingWorkspaceId) missingWorkspaceId = null; // asked again if the visitor comes back to it
  $: if (
    browser &&
    routeWorkspaceId &&
    String(currentWorkspace?.id) !== routeWorkspaceId &&
    routeWorkspaceId !== loadingWorkspaceId &&
    routeWorkspaceId !== missingWorkspaceId
  ) followWorkspace(routeWorkspaceId);

  async function followWorkspace(workspaceId: string) {
    loadingWorkspaceId = workspaceId;
    try {
      const result = await (await fetch(`/api/workspaces?id=${workspaceId}`)).json();
      if (routeWorkspaceId !== workspaceId) return; // the visitor has moved on to another page
      if (result.success && result.workspace?.id !== undefined) {
        currentWorkspace = result.workspace;
        rememberWorkspace(workspaceId);
        loadWorkspaceDatasets(workspaceId);
      } else {
        missingWorkspaceId = workspaceId;
      }
    } catch (error) {
      console.error('Error loading workspace:', error);
      if (routeWorkspaceId === workspaceId) missingWorkspaceId = workspaceId;
    } finally {
      if (loadingWorkspaceId === workspaceId) loadingWorkspaceId = null;
    }
  }

  function rememberWorkspace(workspaceId: string) {
    try {
      localStorage.setItem('currentWorkspace', workspaceId);
    } catch {
      // Storage can be blocked; the header still follows the page
    }
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

    const labels: Record<string, string> = {
      'social_media': 'Social',
      'gdelt_events': 'GDELT',
      'android': 'Android',
      'telegram': 'Telegram',
      'youtube': 'YouTube'
    };

    return summary.types
      .map((type: string) => ({ label: labels[type] ?? type, color: dataSourceBadgeClass(type) }))
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
      name: 'Social Analytics',
      href: '/dashboards',
      current: false,
      requiresProject: false,
      hasDropdown: true,
      dropdownItems: [
        { name: 'Interactive Dashboards', href: '/dashboards', requiresProject: false, useWorkspace: true },
        { name: 'Sentiment Analysis', href: '/text-analytics/sentiment-analysis', requiresProject: false, useWorkspace: true },
        { name: 'Topic Modeling', href: '/text-analytics/topic-modeling', requiresProject: false, useWorkspace: true },
        { name: 'Language Detection', href: '/text-analytics/language-detection', requiresProject: false, useWorkspace: true },
        { name: 'Engagement Analysis', href: '/text-analytics/engagement-analysis', requiresProject: false, useWorkspace: true },
        { name: 'Hashtag Analysis', href: '/text-analytics/hashtag-analysis', requiresProject: false, useWorkspace: true },
        { name: 'Trigrams Analysis', href: '/text-analytics/trigrams', requiresProject: false, useWorkspace: true },
        { name: 'Analytics Correlation', href: '/analytics-correlation', requiresProject: false, useWorkspace: true },
        { name: 'Radio Analytics', href: '/radio-analytics', requiresProject: false, useWorkspace: true }
      ]
    },
    {
      name: 'GDELT',
      href: '/gdelt/intelligence',
      current: false,
      requiresProject: false,
      hasDropdown: true,
      dropdownItems: [
        { name: 'GDELT Intelligence', href: '/gdelt/intelligence', requiresProject: false },
        { name: 'GDELT World Events', href: '/gdelt', requiresProject: false },
        { name: 'GDELT Analytics', href: '/gdelt/analytics', requiresProject: false }
      ]
    },
    {
      name: 'Images',
      href: '/image-processing',
      current: false,
      requiresProject: false,
      hasDropdown: true,
      dropdownItems: [
        { name: 'Image Processing Suite', href: '/image-processing', requiresProject: false },
        { name: 'Object Detection', href: '/image-processing/object-detection', requiresProject: false },
        { name: 'Face Detection', href: '/image-processing/face-detection', requiresProject: false },
        { name: 'Content Moderation', href: '/image-processing/content-moderation', requiresProject: false },
        { name: 'OCR & Text Extraction', href: '/image-processing/ocr', requiresProject: false },
        { name: 'Image Classification', href: '/image-processing/classification', requiresProject: false },
        { name: 'Brand Recognition', href: '/image-processing/brand-recognition', requiresProject: false }
      ]
    },
    { name: 'Research Notebooks', href: '/text-analytics/research-investigation', current: false, requiresProject: false },
    { name: 'Investigations', href: '/investigations', current: false, requiresProject: false },
    {
      name: 'Data',
      href: '/data-management',
      current: false,
      requiresProject: false,
      hasDropdown: true,
      dropdownItems: [
        { name: 'Data Management', href: '/data-management', requiresProject: false },
        { name: 'Data Capture', href: '/data-capture', requiresProject: false },
        { name: 'Data Sharing', href: '/data-sharing', requiresProject: false },
        { name: 'Workflow Builder', href: '/data-management/workflow-builder', requiresProject: false }
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
  $: user = $page.data.user as { name: string; email: string; role: string } | null | undefined;
</script>

<nav aria-label="Main navigation" class="bg-white border-b border-ink-200">
  <div class="max-w-7xl min-[1400px]:max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex h-16 items-center justify-between">
      <!-- Left: Logo + Nav Links -->
      <div class="flex items-center">
        <!-- Logo. From 1280 to 1399px the links and switchers need the room, so only the mark shows; from 1400px the bar widens and the name returns -->
        <a href="/" class="flex items-center mr-6 text-primary-700" aria-label="Social Explorer home">
          <BrandMark size={32} />
          <span class="ml-2.5 font-sans text-xl font-semibold tracking-tight text-ink-900 whitespace-nowrap hidden sm:block min-[1280px]:max-[1399.9px]:hidden!">
            Social Explorer
          </span>
        </a>

        <!-- Desktop Nav Links -->
        <div class="hidden xl:flex xl:items-center xl:space-x-1 border-l border-ink-200 pl-4">
          {#each updatedNavItems as item, ni}
            {#if item.hasDropdown}
              <div class="relative nav-dropdown">
                <button
                  on:click={() => toggleDropdown(item.name)}
                  aria-expanded={openDropdowns[item.name] || false}
                  aria-haspopup="true"
                  class="flex items-center px-2.5 py-2 rounded-lg text-sm font-medium transition-colors {item.current
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
                    {#each (item.dropdownItems ?? []) as dropdownItem, di}
                      <a
                        href={dropdownItem.href}
                        on:click={(e) => navigateToApp(dropdownItem, e)}
                        class="block px-4 py-2.5 text-sm transition-colors {
                          (dropdownItem.requiresProject && !$currentProject) ||
                          (dropdownItem?.requiresWorkspace && !currentWorkspace) ||
                          (dropdownItem?.requiresDataType && !hasRequiredData(dropdownItem))
                          ? 'text-gray-500 cursor-not-allowed'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                        }"
                        title={getDataAvailabilityTooltip(dropdownItem)}
                      >
                        <div class="flex items-center justify-between">
                          <span>{dropdownItem.name}</span>
                          {#if dropdownItem?.requiresDataType && currentWorkspace}
                            <span class="text-xs {hasRequiredData(dropdownItem) ? 'text-emerald-500' : 'text-signal-700'}">
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
                class="px-2.5 py-2 rounded-lg text-sm font-medium transition-colors {item.current
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
            <div class="relative z-50 project-switcher">
              <button
                on:click={() => projectSwitcherOpen = !projectSwitcherOpen}
                aria-expanded={projectSwitcherOpen}
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
              {#if projectSwitcherOpen}
                <div class="absolute top-full right-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-[100]">
                  <div class="p-4 border-b border-gray-200">
                    <h3 class="text-sm font-medium text-gray-900">Switch Project</h3>
                  </div>
                  <div class="max-h-64 overflow-y-auto">
                    {#each availableProjects as project, pi}
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
                  <svg class="ml-1.5 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      {#each availableWorkspaces as workspace, wi}
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

        <UserMenu />

        <!-- Mobile menu button -->
        <div class="xl:hidden">
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
    <div class="xl:hidden border-t border-ink-200 bg-white mobile-menu">
      <div class="px-2 pt-2 pb-3 space-y-1">
        {#each updatedNavItems as item, ni}
          {#if item.hasDropdown}
            <!-- Mobile dropdown navigation item -->
            <div class="space-y-1">
              <button
                on:click={() => toggleDropdown(item.name)}
                class="w-full flex items-center justify-between px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {item.requiresProject && !$currentProject 
                  ? 'text-gray-500 opacity-60 hover:text-gray-500 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
              >
                <span>
                  {item.name}
                  {#if item.requiresProject && !$currentProject}
                    <span class="ml-1 text-xs text-gray-500">*</span>
                  {/if}
                </span>
                <svg class="w-4 h-4 transition-transform {openDropdowns[item.name] ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              
              {#if openDropdowns[item.name]}
                <div class="pl-6 space-y-1">
                  {#each (item.dropdownItems ?? []) as dropdownItem, di}
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
                        ? 'text-gray-500 opacity-60 hover:text-gray-500 cursor-not-allowed'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
                      title={getDataAvailabilityTooltip(dropdownItem)}
                    >
                      <span>{dropdownItem.name}</span>
                      <div class="flex items-center space-x-1">
                        {#if dropdownItem?.requiresDataType && currentWorkspace}
                          <span class="text-xs {hasRequiredData(dropdownItem) ? 'text-emerald-600' : 'text-signal-700'}">
                            {getDataAvailabilityIcon(dropdownItem)}
                          </span>
                        {/if}
                        {#if dropdownItem?.requiresWorkspace && !currentWorkspace}
                          <span class="text-xs text-signal-700">↻</span>
                        {:else if dropdownItem.requiresProject && !$currentProject}
                          <span class="text-xs text-gray-500">*</span>
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
                  ? 'text-gray-500 opacity-60 hover:text-gray-500 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
              title={getDataAvailabilityTooltip(item)}
              aria-current={item.current ? 'page' : undefined}
            >
              <span>{item.name}</span>
              <div class="flex items-center space-x-1">
                {#if item?.requiresDataType && currentWorkspace}
                  <span class="text-xs {hasRequiredData(item) ? 'text-emerald-600' : 'text-signal-700'}">
                    {getDataAvailabilityIcon(item)}
                  </span>
                {:else if item.requiresProject && !$currentProject}
                  <span class="text-xs text-gray-500">*</span>
                {/if}
              </div>
            </a>
          {/if}
        {/each}
        
        <!-- Project requirement notice (mobile) -->
        {#if !$currentProject}
          <div class="px-3 py-1 text-xs text-gray-500">
            * Requires project selection
          </div>
        {/if}
        
        {#if user}
          <div class="px-3 py-3 border-t border-ink-200">
            <div class="flex items-center space-x-3">
              <div class="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center shrink-0" aria-hidden="true">
                <span class="text-white font-medium text-sm">{initials(user.name, user.email)}</span>
              </div>
              <div class="min-w-0">
                <div class="text-sm font-medium text-ink-900 truncate">{user.name}</div>
                <div class="text-xs text-ink-500 truncate">{user.email} · <span class="capitalize">{user.role}</span></div>
              </div>
            </div>
            <div class="mt-3 flex gap-2">
              <a href="/projects" class="flex-1 text-center px-3 py-2 text-sm font-medium text-ink-700 border border-ink-300 rounded-md hover:bg-ink-50">Switch project</a>
              <button type="button" on:click={signOut} class="flex-1 px-3 py-2 text-sm font-medium text-ink-700 border border-ink-300 rounded-md hover:bg-ink-50">Sign out</button>
            </div>
            <div class="mt-2 flex gap-2">
              <button type="button" on:click={signOutEverywhere} class="flex-1 px-3 py-2 text-sm font-medium text-ink-700 border border-ink-300 rounded-md hover:bg-ink-50">Sign out on all devices</button>
              {#if user.role === 'admin'}
                <a href="/settings/users" class="flex-1 text-center px-3 py-2 text-sm font-medium text-ink-700 border border-ink-300 rounded-md hover:bg-ink-50">Manage users</a>
              {/if}
            </div>
            <details class="mt-2 rounded-md border border-ink-300 px-3 py-2">
              <summary class="cursor-pointer text-sm font-medium text-ink-700">Change password</summary>
              <div class="mt-2"><ChangePasswordForm /></div>
            </details>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</nav>