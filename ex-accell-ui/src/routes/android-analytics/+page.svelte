<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { onMount } from 'svelte';

  // Data from the Princeton SMART / Screenlake research kit
  let appAccessibilityData = [];
  let appSegmentData = [];
  let screenshotData = [];
  let loading = true;

  // Analytics calculations
  let totalSessions = 0;
  let totalScreenshots = 0;
  let uniqueApps = new Set();
  let sessionDuration = 0;
  let topApps = [];
  let appUsageTimeline = [];
  let userBehaviorPatterns = [];

  onMount(async () => {
    // In a real implementation, you would fetch this data from an API
    // For now, we'll simulate the data structure based on what we observed
    loadSampleData();
  });

  function loadSampleData() {
    // Sample data based on the CSV structure we examined
    appAccessibilityData = [
      {
        id_user: "7324",
        type: "SESSION_START",
        t_unix_ts_ms: 1744765248255,
        apk: null,
        id_session: "5db4bc90-8fcf-4d20-b6d7-4474def9786f",
        text: null
      },
      {
        id_user: "7324", 
        type: "SCREEN_TEXT",
        t_unix_ts_ms: 1744765268335,
        apk: "com.android.systemui",
        id_session: "5db4bc90-8fcf-4d20-b6d7-4474def9786f",
        text: "Internet AndroidWifi Bluetooth On Flashlight Camera in use Do Not Disturb Off"
      },
      {
        id_user: "7324",
        type: "URL", 
        t_unix_ts_ms: 1744765042854,
        apk: "com.android.chrome",
        id_session: "5db4bc90-8fcf-4d20-b6d7-4474def9786f",
        text: "amazon.com/amazonprime"
      },
      {
        id_user: "7324",
        type: "SCREEN_TEXT",
        t_unix_ts_ms: 1744765017542,
        apk: "com.android.chrome", 
        id_session: "5db4bc90-8fcf-4d20-b6d7-4474def9786f",
        text: "TAP TO UNMUTE Dialog Search YouTube Account Open App 1 000 000 Villager MANHUNT"
      }
    ];

    appSegmentData = [
      {
        apk: "com.google.android.youtube",
        t_unix_ts_segment_start: 1744668380017,
        duration_segment_ms: 480032,
        id_session: "5db4bc90-8fcf-4d20-b6d7-4474def9786f",
        id_user: "7324"
      },
      {
        apk: "com.android.chrome", 
        t_unix_ts_segment_start: 1744765042854,
        duration_segment_ms: 245000,
        id_session: "5db4bc90-8fcf-4d20-b6d7-4474def9786f",
        id_user: "7324"
      },
      {
        apk: "com.google.android.apps.nexuslauncher",
        t_unix_ts_segment_start: 1744668862080,
        duration_segment_ms: 193172,
        id_session: "5db4bc90-8fcf-4d20-b6d7-4474def9786f", 
        id_user: "7324"
      },
      {
        apk: "com.screenlake",
        t_unix_ts_segment_start: 1744669057265,
        duration_segment_ms: 434279,
        id_session: "5db4bc90-8fcf-4d20-b6d7-4474def9786f",
        id_user: "7324"
      }
    ];

    screenshotData = [
      {
        id_user: "7324",
        file: "img_06a60ee6-006f-40f6-95d4-65fdce368553Screenshot_2025-04-14_18-06-14.jpg",
        apk: "com.google.android.permissioncontroller",
        app: "Permission controller",
        text: "srk ned screenshot service now taking screenshots every 3 seconds",
        t_epoch_ts_ms: 1744668374979,
        t_natural_day_ts: "04/14/2025"
      },
      {
        id_user: "7324", 
        file: "img_d9e776fb-a51b-47a7-a697-0be76429cfb9Screenshot_2025-04-14_18-06-20.jpg",
        apk: "com.google.android.youtube",
        app: "YouTube",
        text: "youtube search try searching to get started home shorts subscriptions library",
        t_epoch_ts_ms: 1744668380017,
        t_natural_day_ts: "04/14/2025"
      },
      {
        id_user: "7324",
        file: "img_91c04571-f0ea-4e05-814e-6b0cd36a472fScreenshot_2025-04-14_18-06-25.jpg", 
        apk: "com.google.android.youtube",
        app: "YouTube",
        text: "cat videos for cats to watch cat videos funny cat videos for kids",
        t_epoch_ts_ms: 1744668385039,
        t_natural_day_ts: "04/14/2025"
      }
    ];

    calculateAnalytics();
    loading = false;
  }

  function calculateAnalytics() {
    // Calculate total sessions
    totalSessions = new Set(appAccessibilityData.map(d => d.id_session)).size;
    
    // Calculate total screenshots
    totalScreenshots = screenshotData.length;
    
    // Calculate unique apps
    appSegmentData.forEach(segment => {
      uniqueApps.add(segment.apk);
    });
    
    // Calculate total session duration (in minutes)
    sessionDuration = Math.round(appSegmentData.reduce((sum, segment) => sum + segment.duration_segment_ms, 0) / 60000);
    
    // Calculate top apps by usage time
    const appUsage = {};
    appSegmentData.forEach(segment => {
      const appName = getAppDisplayName(segment.apk);
      appUsage[appName] = (appUsage[appName] || 0) + segment.duration_segment_ms;
    });
    
    topApps = Object.entries(appUsage)
      .map(([app, duration]) => ({ 
        app, 
        duration: Math.round(duration / 60000), // Convert to minutes
        percentage: Math.round((duration / appSegmentData.reduce((sum, s) => sum + s.duration_segment_ms, 0)) * 100)
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    // Create app usage timeline
    appUsageTimeline = appSegmentData.map(segment => ({
      app: getAppDisplayName(segment.apk),
      startTime: new Date(segment.t_unix_ts_segment_start).toLocaleTimeString(),
      duration: Math.round(segment.duration_segment_ms / 60000),
      timestamp: segment.t_unix_ts_segment_start
    })).sort((a, b) => a.timestamp - b.timestamp);

    // Analyze user behavior patterns
    userBehaviorPatterns = analyzeUserPatterns();
  }

  function getAppDisplayName(apk) {
    const appMap = {
      'com.google.android.youtube': 'YouTube',
      'com.android.chrome': 'Chrome Browser', 
      'com.google.android.apps.nexuslauncher': 'Launcher',
      'com.screenlake': 'Screenlake Research',
      'com.android.systemui': 'System UI',
      'com.google.android.permissioncontroller': 'Permission Controller',
      'com.google.android.googlequicksearchbox': 'Google Search'
    };
    return appMap[apk] || apk.split('.').pop();
  }

  function analyzeUserPatterns() {
    const patterns = [];
    
    // Analyze screen text patterns
    const textEntries = appAccessibilityData.filter(d => d.type === 'SCREEN_TEXT' && d.text);
    if (textEntries.length > 0) {
      patterns.push({
        type: 'Content Interaction',
        description: `User interacted with ${textEntries.length} different screen elements`,
        count: textEntries.length,
        icon: '👆'
      });
    }

    // Analyze URL visits
    const urlEntries = appAccessibilityData.filter(d => d.type === 'URL');
    if (urlEntries.length > 0) {
      patterns.push({
        type: 'Web Browsing',
        description: `Visited ${urlEntries.length} different URLs including Amazon and YouTube`,
        count: urlEntries.length,
        icon: '🌐'
      });
    }

    // Analyze app switching behavior
    if (appSegmentData.length > 1) {
      patterns.push({
        type: 'App Switching',
        description: `Switched between ${uniqueApps.size} different applications`,
        count: uniqueApps.size,
        icon: '🔄'
      });
    }

    // Analyze screenshot frequency
    const avgScreenshotInterval = totalScreenshots > 1 ? 
      Math.round((screenshotData[screenshotData.length - 1]?.t_epoch_ts_ms - screenshotData[0]?.t_epoch_ts_ms) / (totalScreenshots - 1) / 1000) : 0;
    
    if (avgScreenshotInterval > 0) {
      patterns.push({
        type: 'Capture Frequency',
        description: `Screenshots captured every ~${avgScreenshotInterval} seconds on average`,
        count: avgScreenshotInterval,
        icon: '📸'
      });
    }

    return patterns;
  }

  function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  function exportData() {
    const analysisData = {
      summary: {
        totalSessions,
        totalScreenshots,
        uniqueApps: uniqueApps.size,
        sessionDuration
      },
      topApps,
      userBehaviorPatterns,
      timeline: appUsageTimeline
    };
    
    const dataStr = JSON.stringify(analysisData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'android_analytics_report.json';
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>Android Analytics Dashboard - Princeton SMART Data</title>
  <meta name="description" content="Analyze Android mobile device user interactions and app usage patterns" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-blue-900 via-purple-900 to-blue-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-blue-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-16 h-16 bg-gradient-to-br from-purple-400 to-blue-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Android Analytics Dashboard</h1>
            <p class="text-slate-300 text-lg font-medium">Princeton SMART • Screenlake Research Kit Data Analysis</p>
            <div class="flex items-center mt-3 space-x-4">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                📱 Mobile Device Interactions
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                🔬 Research Data
              </span>
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          <button 
            on:click={() => window.location.href='/android-research'}
            class="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            Advanced Research
          </button>
          <button 
            on:click={exportData}
            class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            Export Analysis
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading Android analytics data...</span>
      </div>
    {:else}
      
      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-xl shadow-sm p-6 text-center">
          <div class="text-3xl font-bold text-purple-600 mb-1">{totalSessions}</div>
          <div class="text-sm text-gray-600">Active Sessions</div>
          <div class="text-xs text-gray-500 mt-1">Unique interaction periods</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6 text-center">
          <div class="text-3xl font-bold text-blue-600 mb-1">{totalScreenshots}</div>
          <div class="text-sm text-gray-600">Screenshots Captured</div>
          <div class="text-xs text-gray-500 mt-1">Every ~3-5 seconds</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6 text-center">
          <div class="text-3xl font-bold text-emerald-600 mb-1">{uniqueApps.size}</div>
          <div class="text-sm text-gray-600">Unique Applications</div>
          <div class="text-xs text-gray-500 mt-1">Different apps used</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6 text-center">
          <div class="text-3xl font-bold text-amber-600 mb-1">{sessionDuration}</div>
          <div class="text-sm text-gray-600">Total Duration (min)</div>
          <div class="text-xs text-gray-500 mt-1">Active usage time</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        <!-- Top Applications -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-gray-900">Top Applications by Usage</h2>
            <span class="text-sm text-gray-500">{topApps.length} apps</span>
          </div>
          
          <div class="space-y-4">
            {#each topApps as app, index}
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <div class="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center mr-3">
                    <span class="text-white font-bold text-xs">{index + 1}</span>
                  </div>
                  <div>
                    <div class="font-medium text-gray-900">{app.app}</div>
                    <div class="text-sm text-gray-500">{app.duration} minutes</div>
                  </div>
                </div>
                
                <div class="flex items-center space-x-3">
                  <div class="text-right">
                    <div class="font-semibold text-gray-900">{app.percentage}%</div>
                    <div class="text-xs text-gray-500">of total time</div>
                  </div>
                  <div class="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      class="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                      style="width: {app.percentage}%"></div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- User Behavior Patterns -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-6">User Behavior Patterns</h2>
          
          <div class="space-y-4">
            {#each userBehaviorPatterns as pattern}
              <div class="border border-gray-200 rounded-xl p-4">
                <div class="flex items-start">
                  <div class="text-2xl mr-3">{pattern.icon}</div>
                  <div class="flex-1">
                    <div class="font-medium text-gray-900 mb-1">{pattern.type}</div>
                    <div class="text-sm text-gray-600 mb-2">{pattern.description}</div>
                    <div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Count: {pattern.count}
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- App Usage Timeline -->
      <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-900">App Usage Timeline</h2>
          <span class="text-sm text-gray-500">{appUsageTimeline.length} segments</span>
        </div>
        
        <div class="space-y-3">
          {#each appUsageTimeline as segment}
            <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-purple-600 rounded-full mr-3"></div>
                <div>
                  <div class="font-medium text-gray-900">{segment.app}</div>
                  <div class="text-sm text-gray-500">Started at {segment.startTime}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="font-semibold text-gray-900">{segment.duration} min</div>
                <div class="text-xs text-gray-500">Duration</div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Raw Data Insights -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <!-- Screen Text Analysis -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-6">Screen Text Analysis</h2>
          
          <div class="space-y-4">
            {#each appAccessibilityData.filter(d => d.type === 'SCREEN_TEXT' && d.text) as textData}
              <div class="border-l-4 border-purple-600 pl-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-purple-600">{getAppDisplayName(textData.apk)}</span>
                  <span class="text-xs text-gray-500">{formatTimestamp(textData.t_unix_ts_ms)}</span>
                </div>
                <div class="text-sm text-gray-700 line-clamp-2">{textData.text}</div>
              </div>
            {/each}
          </div>
        </div>

        <!-- URL Visits -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-6">Web Browsing Activity</h2>
          
          <div class="space-y-4">
            {#each appAccessibilityData.filter(d => d.type === 'URL') as urlData}
              <div class="border border-gray-200 rounded-lg p-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-blue-600">🌐 Web Visit</span>
                  <span class="text-xs text-gray-500">{formatTimestamp(urlData.t_unix_ts_ms)}</span>
                </div>
                <div class="text-sm text-gray-700 font-mono bg-gray-50 p-2 rounded">
                  {urlData.text}
                </div>
                <div class="text-xs text-gray-500 mt-1">via {getAppDisplayName(urlData.apk)}</div>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Data Source Information -->
      <div class="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div class="flex items-start">
          <svg class="w-6 h-6 text-blue-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 class="text-lg font-semibold text-blue-900 mb-2">About This Data</h3>
            <div class="text-blue-800 text-sm space-y-2">
              <p><strong>Source:</strong> Princeton SMART (Social Media Analysis and Research Toolkit) using Screenlake Research Kit</p>
              <p><strong>Collection Method:</strong> Passive smartphone usage monitoring with automated screenshots every 3-5 seconds</p>
              <p><strong>Data Types:</strong> App accessibility events, app segment timing, screenshot OCR text extraction, and URL visits</p>
              <p><strong>Privacy:</strong> All data collection is participant-controlled and consent-based for research purposes</p>
              <p><strong>User ID:</strong> 7324 • <strong>Session:</strong> 5db4bc90-8fcf-4d20-b6d7-4474def9786f • <strong>Date:</strong> April 14, 2025</p>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>