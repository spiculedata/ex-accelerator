<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject, loadCurrentProject } from '$lib/stores/projectStore';
  import { overviewDb } from '$lib/services/overviewDb';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // Overview dashboard data
  let loading = true;
  let overviewStats = {
    activeProjects: 0,
    postsAnalyzed: 0,
    reportsReady: 0,
    todaysActivities: 0
  };
  let appModules = [];
  let recentActivities = [];
  let systemStatus = [];
  let currentWorkspace = null;

  // Workspace selection state
  let workspaceSelectorOpen = false;
  let availableWorkspaces = [
    { id: 1, name: 'Twitter Research Workspace', description: 'Primary workspace for twitter content analysis and insights', activityCount: 24 },
    { id: 2, name: 'Marketing Analytics', description: 'Campaign performance and brand monitoring', activityCount: 18 },
    { id: 3, name: 'Product Research', description: 'Customer feedback and product insights', activityCount: 12 }
  ];
  
  onMount(async () => {
    loadCurrentProject();
    await loadOverviewData();

    // Click outside handler for workspace selector
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.workspace-selector')) {
        workspaceSelectorOpen = false;
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  async function loadOverviewData() {
    try {
      loading = true;

      // Load all overview data from database
      const [stats, modules, activities, status, workspace] = await Promise.all([
        overviewDb.getOverviewStats(),
        overviewDb.getAppModulesStatus(),
        overviewDb.getRecentActivities(5),
        overviewDb.getSystemStatus(),
        overviewDb.getCurrentWorkspace()
      ]);

      overviewStats = stats;
      appModules = modules.length > 0 ? modules : getFallbackModules();
      recentActivities = activities;
      systemStatus = status;
      currentWorkspace = workspace || availableWorkspaces[0];

      console.log('Overview dashboard data loaded successfully from database');
    } catch (error) {
      console.error('Error loading overview data:', error);
      // Use fallback data on error
      appModules = getFallbackModules();
      recentActivities = getFallbackActivities();
      systemStatus = getFallbackSystemStatus();
      currentWorkspace = availableWorkspaces[0];
    } finally {
      loading = false;
    }
  }

  function switchWorkspace(workspace: any) {
    currentWorkspace = workspace;
    workspaceSelectorOpen = false;
    // Reload data for the new workspace
    loadOverviewData();
  }

  function navigateToProjects() {
    goto('/projects');
  }

  function navigateToReports() {
    goto('/text-analytics/research-investigation');
  }

  function getFallbackModules() {
    return [
      {
        name: 'dashboards',
        displayName: 'Dashboards',
        iconColor: 'blue',
        statusDisplay: 'Active',
        activityDisplay: 'Updated 2h ago'
      },
      {
        name: 'text_analytics',
        displayName: 'Text Analytics',
        iconColor: 'emerald',
        statusDisplay: 'Ready',
        activityDisplay: 'Last run 1h ago'
      },
      {
        name: 'data_capture',
        displayName: 'Data Capture',
        iconColor: 'indigo',
        statusDisplay: 'Ready',
        activityDisplay: 'Available'
      },
      {
        name: 'android_analytics',
        displayName: 'Android Analytics',
        iconColor: 'amber',
        statusDisplay: 'Beta',
        activityDisplay: 'New features'
      },
      {
        name: 'android_research',
        displayName: 'Android Research',
        iconColor: 'purple',
        statusDisplay: 'Beta',
        activityDisplay: 'Experimental'
      },
      {
        name: 'image_processing',
        displayName: 'Image Processing',
        iconColor: 'pink',
        statusDisplay: 'Coming Soon',
        activityDisplay: 'In development'
      }
    ];
  }

  function getFallbackActivities() {
    return [
      {
        title: 'Dashboard updated with new analytics',
        timeAgo: '2 hours ago',
        activityType: 'dashboard_updated',
        iconColor: 'blue'
      },
      {
        title: 'Text analysis completed for 1.2K posts',
        timeAgo: '4 hours ago',
        activityType: 'analysis_completed',
        iconColor: 'emerald'
      },
      {
        title: 'New data imported from Twitter API',
        timeAgo: '6 hours ago',
        activityType: 'data_imported',
        iconColor: 'indigo'
      }
    ];
  }

  function getFallbackSystemStatus() {
    return [
      {
        displayName: 'Database',
        status: 'healthy',
        statusDisplay: 'Healthy',
        statusColor: 'bg-emerald-400'
      },
      {
        displayName: 'API Services',
        status: 'healthy',
        statusDisplay: 'Online',
        statusColor: 'bg-blue-400'
      },
      {
        displayName: 'Data Pipeline',
        status: 'healthy',
        statusDisplay: 'Running',
        statusColor: 'bg-emerald-400'
      }
    ];
  }

  function navigateToApp(appPath: string) {
    if ($currentProject) {
      // If project is selected, go directly to the app with project context
      goto(`${appPath}?project=${$currentProject.id}`);
    } else {
      // Navigate directly to the app - project selection is optional
      goto(appPath);
    }
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  function getActivityIcon(activityType: string) {
    const icons = {
      'analysis_completed': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      'data_imported': 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10',
      'dashboard_updated': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 712 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 712-2h2a2 2 0 712 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      'job_started': 'M12 6v6m0 0v6m0-6h6m-6 0H6'
    };
    return icons[activityType] || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  function getModuleIcon(moduleName: string) {
    const icons = {
      'dashboards': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 712-2h2a2 2 0 712 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 712-2h2a2 2 0 712 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      'text_analytics': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 712-2h5.586a1 1 0 71.707.293l5.414 5.414a1 1 0 71.293.707V19a2 2 0 01-2 2z',
      'image_processing': 'M4 16l4.586-4.586a2 2 0 712.828 0L16 16m-2-2l1.586-1.586a2 2 0 712.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      'data_capture': 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 711 9.9M9 19l3 3m0 0l3-3m-3 3V10',
      'android_analytics': 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
      'android_research': 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
    };
    return icons[moduleName] || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  function getModuleRoute(moduleName: string) {
    const routes = {
      'dashboards': '/dashboards',
      'text_analytics': '/text-analytics',
      'image_processing': '/image-processing',
      'data_capture': '/data-capture',
      'android_analytics': '/android-analytics',
      'android_research': '/android-research'
    };
    return routes[moduleName] || '/';
  }

  function getModuleDescription(moduleName: string) {
    const descriptions = {
      'dashboards': 'Real-time analytics and custom visualizations',
      'text_analytics': 'NLP processing and sentiment analysis',
      'image_processing': 'Computer vision and image analysis',
      'data_capture': 'Social media data collection',
      'android_analytics': 'Mobile device interaction analysis',
      'android_research': 'Deep behavioral analysis & phenotyping'
    };
    return descriptions[moduleName] || 'Analytics module';
  }

  function getStatusBadgeClass(iconColor: string) {
    const colorMap = {
      'blue': 'bg-blue-100 text-blue-800',
      'emerald': 'bg-emerald-100 text-emerald-800',
      'indigo': 'bg-indigo-100 text-indigo-800',
      'amber': 'bg-amber-100 text-amber-800',
      'purple': 'bg-purple-100 text-purple-800',
      'pink': 'bg-pink-100 text-pink-800'
    };
    return colorMap[iconColor] || 'bg-gray-100 text-gray-800';
  }

  function getActivityIconBgClass(iconColor: string) {
    const colorMap = {
      'blue': 'bg-blue-100',
      'emerald': 'bg-emerald-100',
      'indigo': 'bg-indigo-100',
      'amber': 'bg-amber-100',
      'purple': 'bg-purple-100',
      'pink': 'bg-pink-100'
    };
    return colorMap[iconColor] || 'bg-gray-100';
  }

  function getActivityIconTextClass(iconColor: string) {
    const colorMap = {
      'blue': 'text-blue-600',
      'emerald': 'text-emerald-600',
      'indigo': 'text-indigo-600',
      'amber': 'text-amber-600',
      'purple': 'text-purple-600',
      'pink': 'text-pink-600'
    };
    return colorMap[iconColor] || 'text-gray-600';
  }

  function getStatusTextClass(status: string) {
    const colorMap = {
      'healthy': 'text-blue-600',
      'warning': 'text-yellow-600',
      'error': 'text-red-600'
    };
    return colorMap[status] || 'text-gray-600';
  }

  function getGradientClass(iconColor: string) {
    const colorMap = {
      'blue': 'from-blue-500 to-blue-600',
      'emerald': 'from-emerald-500 to-emerald-600',
      'indigo': 'from-indigo-500 to-indigo-600',
      'amber': 'from-amber-500 to-amber-600',
      'purple': 'from-purple-500 to-purple-600',
      'pink': 'from-pink-500 to-purple-600'
    };
    return colorMap[iconColor] || 'from-gray-500 to-gray-600';
  }
</script>

<Navigation />

<!-- Workspace Selector -->
<section class="bg-gray-50 border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
    <div class="relative workspace-selector inline-block">
      <button
        on:click={() => workspaceSelectorOpen = !workspaceSelectorOpen}
        class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-xl transition-colors border border-gray-300 shadow-sm">
        <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
        </svg>
        <span class="font-semibold">{currentWorkspace?.name || 'Select Workspace'}</span>
        <svg class="ml-2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      <!-- Workspace Dropdown -->
      {#if workspaceSelectorOpen}
        <div class="absolute top-full left-0 mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
          <div class="p-4 border-b border-gray-200">
            <h3 class="text-sm font-semibold text-gray-900">Switch Workspace</h3>
            <p class="text-xs text-gray-500 mt-1">Select a workspace to view its analytics and projects</p>
          </div>
          <div class="max-h-64 overflow-y-auto">
            {#each availableWorkspaces as workspace}
              <button
                on:click={() => switchWorkspace(workspace)}
                class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors {currentWorkspace?.id === workspace.id ? 'bg-blue-50' : ''}">
                <div class="flex items-start">
                  <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-900 truncate">{workspace.name}</div>
                    <div class="text-xs text-gray-500 truncate mt-1">{workspace.description}</div>
                  </div>
                  {#if currentWorkspace?.id === workspace.id}
                    <svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>

<!-- Dashboard Header (Simplified - No Metrics) -->
<section class="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
  <div class="absolute inset-0 bg-black opacity-10"></div>
  <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex items-center">
      <div class="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-4">
        <span class="text-white font-bold text-lg">JD</span>
      </div>
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white">
          Welcome back, John
        </h1>
        <p class="text-blue-100">Ready to explore your social data?</p>
      </div>
    </div>
  </div>

  <!-- Floating elements -->
  <div class="absolute top-20 left-10 w-20 h-20 bg-white opacity-10 rounded-full blur-xl animate-pulse"></div>
  <div class="absolute bottom-20 right-10 w-32 h-32 bg-yellow-400 opacity-10 rounded-full blur-xl animate-pulse"></div>
</section>

<!-- Dashboard Summary Section (New) -->
<section class="py-8 bg-white border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <h2 class="text-xl font-bold text-gray-900 mb-6">Dashboard Summary</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Active Projects - Clickable -->
      <button
        on:click={navigateToProjects}
        class="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 text-left hover:shadow-lg transition-all duration-200 hover:scale-105">
        <div class="flex items-center justify-between mb-3">
          <div class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
            </svg>
          </div>
          <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </div>
        <div class="text-3xl font-bold text-blue-900 mb-2">{overviewStats.activeProjects}</div>
        <div class="text-sm font-medium text-blue-800">Active Projects</div>
        <div class="text-xs text-blue-600 mt-2">Click to view all projects</div>
      </button>

      <!-- Posts Analyzed - Metric Only -->
      <div class="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6">
        <div class="flex items-center justify-between mb-3">
          <div class="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
        </div>
        <div class="text-3xl font-bold text-emerald-900 mb-2">{formatNumber(overviewStats.postsAnalyzed)}</div>
        <div class="text-sm font-medium text-emerald-800">Posts Analyzed</div>
        <div class="text-xs text-emerald-600 mt-2">Total processed content</div>
      </div>

      <!-- Reports Ready - Clickable -->
      <button
        on:click={navigateToReports}
        class="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6 text-left hover:shadow-lg transition-all duration-200 hover:scale-105">
        <div class="flex items-center justify-between mb-3">
          <div class="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </div>
        <div class="text-3xl font-bold text-purple-900 mb-2">{overviewStats.reportsReady}</div>
        <div class="text-sm font-medium text-purple-800">Reports Ready</div>
        <div class="text-xs text-purple-600 mt-2">Click to view reporting activity</div>
      </button>
    </div>
  </div>
</section>

<!-- Active Analytics Tools -->
<section class="py-12 bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Active Analytics Tools</h2>
        <p class="text-sm text-gray-600 mt-1">Tools currently active based on your projects in this workspace</p>
      </div>
      <button
        on:click={() => goto('/projects/new')}
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-blue-600 hover:border-blue-700">
        + New Project
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#if loading}
        <!-- Loading placeholders -->
        {#each Array(6) as _, i}
          <div class="bg-white rounded-xl shadow-lg p-6">
            <div class="animate-pulse">
              <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 bg-gray-300 rounded-xl"></div>
                <div class="h-6 bg-gray-300 rounded-full w-16"></div>
              </div>
              <div class="h-5 bg-gray-300 rounded mb-2"></div>
              <div class="h-4 bg-gray-300 rounded mb-3"></div>
              <div class="h-4 bg-gray-300 rounded w-3/4"></div>
            </div>
          </div>  
        {/each}
      {:else}
        <!-- Dynamic app modules -->  
        {#each appModules as module}
          <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer" 
               on:click={() => navigateToApp(getModuleRoute(module.name))}>
            <div class="flex items-center justify-between mb-4">
              <div class="w-12 h-12 bg-gradient-to-br {getGradientClass(module.iconColor)} rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{getModuleIcon(module.name)}"/>
                </svg>
              </div>
              <span class="text-xs px-2 py-1 rounded-full {getStatusBadgeClass(module.iconColor)}">
                {module.statusDisplay}
              </span>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-1">{module.displayName}</h3>
            <p class="text-gray-600 text-sm mb-3">
              {getModuleDescription(module.name)}
            </p>
            <div class="flex items-center text-sm text-gray-500">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              {module.activityDisplay}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</section>

<!-- Left Sidebar & Recent Activity -->
<section class="py-12 bg-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">

      <!-- Left Sidebar - Quick Actions & System Status -->
      <div class="space-y-6">
        <!-- Quick Actions -->
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div class="space-y-2">
            <button
              on:click={() => goto('/projects/new')}
              class="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors hover:border-blue-300">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                <span class="text-sm font-medium text-gray-900">Create New Project</span>
              </div>
            </button>

            <button
              on:click={() => goto('/data-capture?tab=upload')}
              class="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors hover:border-blue-300">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-emerald-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 711 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                </svg>
                <span class="text-sm font-medium text-gray-900">Import Data</span>
              </div>
            </button>

            <button
              on:click={navigateToReports}
              class="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors hover:border-blue-300">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span class="text-sm font-medium text-gray-900">View Reports</span>
              </div>
            </button>
          </div>
        </div>

        <!-- System Status -->
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
          <div class="bg-white border border-gray-200 rounded-xl p-4">
            <div class="space-y-3">
              {#if loading}
                {#each Array(3) as _, i}
                  <div class="animate-pulse flex items-center justify-between">
                    <div class="h-4 bg-gray-300 rounded w-1/3"></div>
                    <div class="flex items-center">
                      <div class="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                      <div class="h-4 bg-gray-300 rounded w-16"></div>
                    </div>
                  </div>
                {/each}
              {:else}
                {#each systemStatus as status}
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-600">{status.displayName}</span>
                    <div class="flex items-center">
                      <div class="w-2 h-2 {status.statusColor} rounded-full mr-2 animate-pulse"></div>
                      <span class="text-sm font-medium {getStatusTextClass(status.status)}">{status.statusDisplay}</span>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity (Right Side - Takes 2/3 width) -->
      <div class="lg:col-span-2">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-900">Recent Activity</h2>
          <button class="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</button>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div class="divide-y divide-gray-200">
            {#if loading}
              <!-- Loading activities -->
              {#each Array(5) as _, i}
                <div class="p-4">
                  <div class="animate-pulse flex items-center space-x-3">
                    <div class="w-8 h-8 bg-gray-300 rounded-full"></div>
                    <div class="flex-1">
                      <div class="h-4 bg-gray-300 rounded mb-2"></div>
                      <div class="h-3 bg-gray-300 rounded w-1/3"></div>
                    </div>
                  </div>
                </div>
              {/each}
            {:else}
              <!-- Dynamic activities with clickable actions -->
              {#each recentActivities as activity}
                <button
                  class="w-full p-4 hover:bg-blue-50 transition-colors text-left group"
                  on:click={() => {
                    // Navigate based on activity type
                    if (activity.activityType === 'dashboard_updated') goto('/dashboards');
                    else if (activity.activityType === 'analysis_completed') goto('/text-analytics');
                    else if (activity.activityType === 'data_imported') goto('/data-capture');
                  }}>
                  <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 {getActivityIconBgClass(activity.iconColor)} rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg class="w-4 h-4 {getActivityIconTextClass(activity.iconColor)}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{getActivityIcon(activity.activityType)}"/>
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-gray-900 font-medium group-hover:text-blue-700">{activity.title}</p>
                      <p class="text-xs text-gray-500">{activity.timeAgo}</p>
                    </div>
                    <svg class="w-5 h-5 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </div>
                </button>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- App Footer -->
<footer class="bg-gray-50 border-t border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex flex-col sm:flex-row justify-between items-center">
      <!-- Brand -->
      <div class="flex items-center mb-4 sm:mb-0">
        <div class="h-6 w-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mr-2">
          <span class="text-white font-bold text-sm">SE</span>
        </div>
        <span class="text-sm text-gray-600">Social Explorer v2.1.4</span>
      </div>
      
      <!-- App Links -->
      <div class="flex items-center space-x-6 text-sm text-gray-600">
        <a href="/settings" class="hover:text-gray-900 transition-colors">Settings</a>
        <a href="/help" class="hover:text-gray-900 transition-colors">Help</a>
        <a href="/api-docs" class="hover:text-gray-900 transition-colors">API</a>
        <span class="text-gray-300">|</span>
        <a href="https://concepttocloud.com/" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 font-medium transition-colors">
          Concept to Cloud
        </a>
        <button class="hover:text-gray-900 transition-colors">
          <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 713-3h4a3 3 0 713 3v1"></path>
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  </div>
</footer>