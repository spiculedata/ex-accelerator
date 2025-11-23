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
  let appModules: any[] = [];
  let recentActivities: any[] = [];
  let systemStatus: any[] = [];
  let currentWorkspace = null;
  let recentProjects: any[] = [];

  onMount(async () => {
    loadCurrentProject();

    // If a project is already selected, redirect to dashboards
    if ($currentProject) {
      window.location.href = '/dashboards';
      return;
    }

    await loadOverviewData();
    await loadRecentProjects();
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
      currentWorkspace = workspace;
      
      console.log('Overview dashboard data loaded successfully from database');
    } catch (error) {
      console.error('Error loading overview data:', error);
      // Use fallback data on error
      appModules = getFallbackModules();
      recentActivities = getFallbackActivities();
      systemStatus = getFallbackSystemStatus();
    } finally {
      loading = false;
    }
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

  async function loadRecentProjects() {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      if (result.success) {
        // Get the 3 most recent projects
        recentProjects = (result.projects || []).slice(0, 3);
      }
    } catch (error) {
      console.error('Error loading recent projects:', error);
    }
  }
</script>

<Navigation />

<!-- Dashboard Header -->
<section class="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
  <div class="absolute inset-0 bg-black opacity-10"></div>
  <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between">
      <!-- User Welcome -->
      <div class="mb-6 lg:mb-0">
        <div class="flex items-center mb-2">
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

      <!-- Quick Stats -->
      <div class="grid grid-cols-3 gap-4 lg:gap-6">
        {#if loading}
          <div class="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-600">
            <div class="animate-pulse">
              <div class="h-8 bg-gray-700 rounded mb-2"></div>
              <div class="h-4 bg-gray-700 rounded"></div>
            </div>
          </div>
          <div class="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-600">
            <div class="animate-pulse">
              <div class="h-8 bg-gray-700 rounded mb-2"></div>
              <div class="h-4 bg-gray-700 rounded"></div>
            </div>
          </div>
          <div class="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-600">
            <div class="animate-pulse">
              <div class="h-8 bg-gray-700 rounded mb-2"></div>
              <div class="h-4 bg-gray-700 rounded"></div>
            </div>
          </div>
        {:else}
          <div class="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-600">
            <div class="text-2xl font-bold text-white">{overviewStats.activeProjects}</div>
            <div class="text-gray-200 text-sm font-medium">Active Projects</div>
          </div>
          <div class="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-600">
            <div class="text-2xl font-bold text-white">{formatNumber(overviewStats.postsAnalyzed)}</div>
            <div class="text-gray-200 text-sm font-medium">Posts Analyzed</div>
          </div>
          <div class="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-600">
            <div class="text-2xl font-bold text-white">{overviewStats.reportsReady}</div>
            <div class="text-gray-200 text-sm font-medium">Reports Ready</div>
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Floating elements -->
  <div class="absolute top-20 left-10 w-20 h-20 bg-white opacity-10 rounded-full blur-xl animate-pulse"></div>
  <div class="absolute bottom-20 right-10 w-32 h-32 bg-yellow-400 opacity-10 rounded-full blur-xl animate-pulse"></div>
</section>

<!-- App Modules -->
<section class="py-12 bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-2xl font-bold text-gray-900">Your Analytics Tools</h2>
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

<!-- Projects & Workspaces -->
<section class="py-12 bg-white border-t border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">

      <!-- Recent Projects -->
      <div>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Projects</h2>
          <button
            on:click={() => goto('/projects')}
            class="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View All
          </button>
        </div>

        {#if loading}
          <!-- Loading state -->
          <div class="space-y-3">
            {#each Array(3) as _, i}
              <div class="bg-gray-50 rounded-xl p-4 animate-pulse">
                <div class="h-4 bg-gray-300 rounded mb-2 w-3/4"></div>
                <div class="h-3 bg-gray-300 rounded w-1/2"></div>
              </div>
            {/each}
          </div>
        {:else if recentProjects.length === 0}
          <!-- Empty state -->
          <div class="bg-gray-50 rounded-xl p-8 text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
            <p class="mt-2 text-sm font-medium text-gray-900">No projects yet</p>
            <p class="text-xs text-gray-500 mt-1">Create your first project to get started</p>
            <button
              on:click={() => goto('/projects/new')}
              class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              Create Project
            </button>
          </div>
        {:else}
          <!-- Projects list -->
          <div class="space-y-3">
            {#each recentProjects as project}
              <div
                class="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                on:click={() => goto(`/projects/${project.id}`)}>
                <div class="flex items-start justify-between">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-base font-semibold text-gray-900 truncate">{project.name}</h3>
                    <p class="text-sm text-gray-600 mt-1 line-clamp-1">{project.description}</p>
                    <div class="flex items-center mt-2 space-x-3 text-xs text-gray-500">
                      <span>{project.totalPosts?.toLocaleString() || 0} posts</span>
                      <span>•</span>
                      <span>{project.dataSources?.length || 0} sources</span>
                    </div>
                  </div>
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Getting Started -->
      <div>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Getting Started</h2>
        </div>

        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 text-center border border-blue-200">
          <svg class="mx-auto h-16 w-16 text-blue-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Ready to Dive In?</h3>
          <p class="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            Select a project from the list to access powerful analytics, insights, and data visualization tools.
          </p>
          <div class="flex items-center justify-center space-x-3">
            <button
              on:click={() => goto('/projects')}
              class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors">
              Browse All Projects
            </button>
            <button
              on:click={() => goto('/projects/new')}
              class="bg-white hover:bg-gray-50 text-blue-600 border border-blue-600 px-6 py-2 rounded-md text-sm font-medium transition-colors">
              Create New Project
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Recent Activity & Workspace Overview -->
<section class="py-12 bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- Recent Activity -->
      <div class="lg:col-span-2">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-900">Recent Activity</h2>
          <button class="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</button>
        </div>
        
        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div class="divide-y divide-gray-200">
            {#if loading}
              <!-- Loading activities -->
              {#each Array(4) as _, i}
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
              <!-- Dynamic activities -->
              {#each recentActivities as activity}
                <div class="p-4 hover:bg-gray-50 transition-colors">
                  <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 {getActivityIconBgClass(activity.iconColor)} rounded-full flex items-center justify-center">
                      <svg class="w-4 h-4 {getActivityIconTextClass(activity.iconColor)}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{getActivityIcon(activity.activityType)}"/>
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-gray-900">{activity.title}</p>
                      <p class="text-xs text-gray-500">{activity.timeAgo}</p>
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Quick Actions & Current Workspace -->
      <div class="space-y-6">
        <!-- Current Workspace -->
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Current Workspace</h3>
          {#if loading}
            <div class="animate-pulse bg-gray-200 rounded-xl p-4">
              <div class="h-4 bg-gray-300 rounded mb-3"></div>
              <div class="h-3 bg-gray-300 rounded mb-3"></div>
              <div class="h-3 bg-gray-300 rounded w-2/3"></div>
            </div>
          {:else if currentWorkspace}
            <div class="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-medium text-gray-900">{currentWorkspace.name}</h4>
                <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Active</span>
              </div>
              <p class="text-sm text-gray-600 mb-3">{currentWorkspace.description}</p>
              <div class="flex items-center text-sm text-gray-500">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                {currentWorkspace.activityCount} recent activities
              </div>
            </div>
          {:else}
            <div class="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p class="text-sm text-gray-500">No active workspace</p>
            </div>
          {/if}
        </div>
        
        <!-- Quick Actions -->
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div class="space-y-2">
            <button 
              on:click={() => goto('/projects/new')}
              class="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                <span class="text-sm font-medium text-gray-900">Create New Project</span>
              </div>
            </button>
            
            <button 
              on:click={() => goto('/data-capture?tab=upload')}
              class="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 711 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                </svg>
                <span class="text-sm font-medium text-gray-900">Import Data</span>
              </div>
            </button>
            
            <button class="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 712-2h2a2 2 0 712 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 712-2h2a2 2 0 712 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                <span class="text-sm font-medium text-gray-900">View Reports</span>
              </div>
            </button>
          </div>
        </div>
        
        <!-- System Status -->
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
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
                    <div class="w-2 h-2 {status.statusColor} rounded-full mr-2"></div>
                    <span class="text-sm {getStatusTextClass(status.status)}">{status.statusDisplay}</span>
                  </div>
                </div>
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