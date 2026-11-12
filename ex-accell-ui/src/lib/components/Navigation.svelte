<script lang="ts">
  import UserMenu from '$lib/components/UserMenu.svelte';
  import BrandMark from '$lib/components/ui/BrandMark.svelte';
  import NavDesktopMenu from '$lib/components/navigation/NavDesktopMenu.svelte';
  import NavMobileMenu from '$lib/components/navigation/NavMobileMenu.svelte';
  import ProjectSelector from '$lib/components/navigation/ProjectSelector.svelte';
  import WorkspaceSelector from '$lib/components/navigation/WorkspaceSelector.svelte';
  import { dataFlagsFromSummary, navigationItems, navigationUrl, type NavItem, type NavProject, type NavTarget, type NavUser, type NavWorkspace, type WorkspaceSummary } from '$lib/components/navigation/navItems';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { workspaceIdFromRoute } from '$lib/utils/workspaceRoute';
  import { currentProject, loadCurrentProject } from '$lib/stores/projectStore';


  let mobileMenuOpen = false;
  let projectSwitcherOpen = false;
  let workspaceSwitcherOpen = false;
  let openDropdowns: Record<string, boolean> = {}; // Track which dropdowns are open
  let availableProjects: NavProject[] = [];
  let availableWorkspaces: NavWorkspace[] = [];
  let currentWorkspace: NavWorkspace | null = null;
  let workspaceDataSummary: WorkspaceSummary | null = null;
  let workspaceSummaries: Record<string, WorkspaceSummary> = {}; // Cache summaries for all workspaces

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

  function selectWorkspace(workspace: NavWorkspace) {
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
  $: dataFlags = dataFlagsFromSummary(workspaceDataSummary);

  function toggleDropdown(itemName: string) {
    openDropdowns = {
      ...openDropdowns,
      [itemName]: !openDropdowns[itemName]
    };
  }

  function navigateToApp(item: NavTarget, event: Event) {
    event.preventDefault();

    if (item.requiresProject && !$currentProject) {
      // If app requires project but none selected, go to project selection
      goto('/projects');
      return;
    }
    // Stays put when the item needs a workspace or data type that is not available
    const url = navigationUrl(item, currentWorkspace, dataFlags);
    if (url) goto(url);
  }

  function handleMobileNavigate(event: CustomEvent<{ item: NavTarget; event: Event; collapse: boolean }>) {
    navigateToApp(event.detail.item, event.detail.event);
    mobileMenuOpen = false;
    if (event.detail.collapse) openDropdowns = {};
  }
  
  $: currentPath = $page.url.pathname;
  $: updatedNavItems = navigationItems.map(item => ({
    ...item,
    current: item.href === currentPath
  }));
  $: user = $page.data.user as NavUser | null | undefined;
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

        <NavDesktopMenu
          items={updatedNavItems}
          {openDropdowns}
          {currentWorkspace}
          {dataFlags}
          on:toggle={(e) => toggleDropdown(e.detail)}
          on:navigate={(e) => navigateToApp(e.detail.item, e.detail.event)}
        />
      </div>

      <!-- Right: Context Switcher + Actions -->
      <div class="flex items-center space-x-3">
        <!-- Project/Workspace Context -->
        {#if $currentProject || availableProjects.length > 0}
          <div class="hidden md:flex items-center bg-gray-50 rounded-lg border border-gray-200 divide-x divide-gray-200">
            <!-- Project Switcher -->
            <ProjectSelector projects={availableProjects} bind:open={projectSwitcherOpen} />

            <!-- Workspace Switcher (in combined context bar) -->
            {#if $currentProject && availableWorkspaces.length > 0}
              <WorkspaceSelector
                workspaces={availableWorkspaces}
                summaries={workspaceSummaries}
                {currentWorkspace}
                bind:open={workspaceSwitcherOpen}
                on:select={(e) => selectWorkspace(e.detail)}
              />
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
    <NavMobileMenu
      items={updatedNavItems}
      {openDropdowns}
      {currentWorkspace}
      {dataFlags}
      {user}
      on:toggle={(e) => toggleDropdown(e.detail)}
      on:navigate={handleMobileNavigate}
    />
  {/if}
</nav>
