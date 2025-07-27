<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject, loadCurrentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  
  onMount(() => {
    loadCurrentProject();
  });

  function navigateToApp(appPath: string) {
    if ($currentProject) {
      // If project is selected, go directly to the app with project context
      window.location.href = `${appPath}?project=${$currentProject.id}`;
    } else {
      // If no project selected, go to project selection first
      window.location.href = '/projects';
    }
  }
</script>

<Navigation />

<!-- Dashboard Header -->
<section class="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700">
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
        <div class="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-lg p-4 text-center border border-gray-600">
          <div class="text-2xl font-bold text-white">15</div>
          <div class="text-gray-200 text-sm font-medium">Active Projects</div>
        </div>
        <div class="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-lg p-4 text-center border border-gray-600">
          <div class="text-2xl font-bold text-white">2.3M</div>
          <div class="text-gray-200 text-sm font-medium">Posts Analyzed</div>
        </div>
        <div class="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-lg p-4 text-center border border-gray-600">
          <div class="text-2xl font-bold text-white">12</div>
          <div class="text-gray-200 text-sm font-medium">Reports Ready</div>
        </div>
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
        on:click={() => window.location.href='/projects/new'}
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-blue-600 hover:border-blue-700">
        + New Project
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Dashboards -->
      <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer" on:click={() => navigateToApp('/dashboards')}>
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
          <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">3 Active</span>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-1">Dashboards</h3>
        <p class="text-gray-600 text-sm mb-3">
          Real-time analytics and custom visualizations
        </p>
        <div class="flex items-center text-sm text-gray-500">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Updated 2 hours ago
        </div>
      </div>

      <!-- Text Analytics -->
      <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer" on:click={() => navigateToApp('/text-analytics')}>
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Running</span>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-1">Text Analytics</h3>
        <p class="text-gray-600 text-sm mb-3">
          NLP processing and sentiment analysis
        </p>
        <div class="flex items-center text-sm text-gray-500">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          Processing 1.2K posts
        </div>
      </div>

      <!-- Image Processing -->
      <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer" on:click={() => navigateToApp('/image-processing')}>
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <span class="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">2 Queued</span>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-1">Image Processing</h3>
        <p class="text-gray-600 text-sm mb-3">
          Computer vision and image analysis
        </p>
        <div class="flex items-center text-sm text-gray-500">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          Last run: 1 day ago
        </div>
      </div>

      <!-- Data Capture -->
      <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer" on:click={() => window.location.href='/data-capture'}>
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
            </svg>
          </div>
          <span class="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">Live</span>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-1">Data Capture</h3>
        <p class="text-gray-600 text-sm mb-3">
          Social media data collection
        </p>
        <div class="flex items-center text-sm text-gray-500">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
          </svg>
          5.2K posts today
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Recent Activity & Workspace Overview -->
<section class="py-12 bg-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- Recent Activity -->
      <div class="lg:col-span-2">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-900">Recent Activity</h2>
          <button class="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</button>
        </div>
        
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div class="divide-y divide-gray-200">
            <!-- Activity items -->
            <div class="p-4 hover:bg-gray-50 transition-colors">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-900">Text analysis completed for <span class="font-medium">Twitter Campaign Q4</span></p>
                  <p class="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
            </div>
            
            <div class="p-4 hover:bg-gray-50 transition-colors">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-900">New data batch imported: <span class="font-medium">5,230 posts</span></p>
                  <p class="text-xs text-gray-500">4 hours ago</p>
                </div>
              </div>
            </div>
            
            <div class="p-4 hover:bg-gray-50 transition-colors">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-900">Dashboard <span class="font-medium">Brand Sentiment</span> updated</p>
                  <p class="text-xs text-gray-500">6 hours ago</p>
                </div>
              </div>
            </div>
            
            <div class="p-4 hover:bg-gray-50 transition-colors">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg class="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-900">Image processing job started for <span class="font-medium">Instagram Posts</span></p>
                  <p class="text-xs text-gray-500">8 hours ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Quick Actions & Current Workspace -->
      <div class="space-y-6">
        <!-- Current Workspace -->
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Current Workspace</h3>
          <div class="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-medium text-gray-900">Brand Analysis Q4 2024</h4>
              <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Active</span>
            </div>
            <p class="text-sm text-gray-600 mb-3">Social media sentiment tracking for major brands</p>
            <div class="flex items-center text-sm text-gray-500">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              3 collaborators
            </div>
          </div>
        </div>
        
        <!-- Quick Actions -->
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div class="space-y-2">
            <button 
              on:click={() => window.location.href='/projects/new'}
              class="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                <span class="text-sm font-medium text-gray-900">Create New Project</span>
              </div>
            </button>
            
            <button 
              on:click={() => window.location.href='/data-capture?tab=upload'}
              class="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                </svg>
                <span class="text-sm font-medium text-gray-900">Import Data</span>
              </div>
            </button>
            
            <button class="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
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
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Data Pipeline</span>
              <div class="flex items-center">
                <div class="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                <span class="text-sm text-green-600">Healthy</span>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Analytics Engine</span>
              <div class="flex items-center">
                <div class="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                <span class="text-sm text-green-600">Running</span>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Storage</span>
              <div class="flex items-center">
                <div class="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                <span class="text-sm text-yellow-600">85% Used</span>
              </div>
            </div>
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
        <div class="h-6 w-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-2">
          <span class="text-white font-bold text-sm">SE</span>
        </div>
        <span class="text-sm text-gray-600">Social Explorer v2.1.4</span>
      </div>
      
      <!-- App Links -->
      <div class="flex items-center space-x-6 text-sm text-gray-600">
        <a href="/settings" class="hover:text-gray-900 transition-colors">Settings</a>
        <a href="/help" class="hover:text-gray-900 transition-colors">Help</a>
        <a href="/api-docs" class="hover:text-gray-900 transition-colors">API</a>
        <button class="hover:text-gray-900 transition-colors">
          <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  </div>
</footer>

