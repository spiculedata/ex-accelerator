<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { androidAnalyticsDb } from '$lib/services/androidAnalyticsDb';
  import type {
    AndroidAccessibilityEvent,
    AndroidAnalyticsSummary,
    AndroidAppSegment,
    AndroidScreenshot
  } from '$lib/services/types/databaseTypes';
  import { hasAndroidData } from '$lib/utils/androidData';
  import DataUnavailable from '$lib/components/ui/DataUnavailable.svelte';
  import ErrorAlert from '$lib/components/ui/ErrorAlert.svelte';

  const LOAD_ERROR = 'Could not load Android analytics data. Check the connection and try again.';
  const MS_PER_MINUTE = 60000;
  const MS_PER_SECOND = 1000;
  const TOP_APP_COUNT = 5;
  const PERCENT = 100;

  interface AppTotal {
    app: string;
    duration: number;
    percentage: number;
  }

  interface TimelineEntry {
    app: string;
    startTime: string;
    duration: number;
    timestamp: number;
  }

  interface BehaviourPattern {
    type: string;
    description: string;
    count: number;
    icon: string;
  }

  let loading = true;
  let loadError = '';
  let hasData = false;

  // Rows from the Princeton SMART / Screenlake research kit
  let appAccessibilityData: AndroidAccessibilityEvent[] = [];
  let appSegmentData: AndroidAppSegment[] = [];
  let screenshotData: AndroidScreenshot[] = [];

  // Figures on the dashboard, every one derived from the rows above
  let totalSessions = 0;
  let totalScreenshots = 0;
  let uniqueApps = new Set<string>();
  let sessionDuration = 0;
  let avgScreenshotInterval = 0;
  let topApps: AppTotal[] = [];
  let appUsageTimeline: TimelineEntry[] = [];
  let userBehaviorPatterns: BehaviourPattern[] = [];

  onMount(() => {
    void loadAndroidAnalyticsData();
  });

  async function loadAndroidAnalyticsData() {
    loading = true;
    loadError = '';
    hasData = false;
    try {
      const [summary, accessibility, segments, screenshots] = await Promise.all([
        androidAnalyticsDb.getAnalyticsSummary(),
        androidAnalyticsDb.getAccessibilityEvents(),
        androidAnalyticsDb.getAppSegments(),
        androidAnalyticsDb.getScreenshots()
      ]);

      appAccessibilityData = accessibility;
      appSegmentData = segments;
      screenshotData = screenshots;
      hasData = hasAndroidData([summary, accessibility, segments, screenshots]);
      if (hasData) calculateAnalytics(summary.data);
    } catch (error) {
      console.error('Android analytics data failed to load:', error);
      loadError = LOAD_ERROR;
    }
    loading = false;
  }

  // BIGINT columns can arrive as strings, so every millisecond value goes through Number()
  const segmentMs = (segment: AndroidAppSegment): number => Number(segment.duration_segment_ms) || 0;
  const segmentStart = (segment: AndroidAppSegment): number => Number(segment.t_unix_ts_segment_start) || 0;

  function calculateAnalytics(summary: AndroidAnalyticsSummary) {
    const totalSegmentMs = appSegmentData.reduce((sum, segment) => sum + segmentMs(segment), 0);

    totalSessions = summary.totalSessions || new Set(appAccessibilityData.map((event) => event.id_session)).size;
    totalScreenshots = summary.totalScreenshots || screenshotData.length;
    uniqueApps = new Set(appSegmentData.map((segment) => segment.apk));
    sessionDuration = summary.sessionDuration || Math.round(totalSegmentMs / MS_PER_MINUTE);
    avgScreenshotInterval = measureScreenshotInterval();

    const usageByApp = appSegmentData.reduce<Record<string, number>>((totals, segment) => {
      const name = getAppDisplayName(segment.apk);
      return { ...totals, [name]: (totals[name] ?? 0) + segmentMs(segment) };
    }, {});

    topApps = Object.entries(usageByApp)
      .map(([app, duration]) => ({
        app,
        duration: Math.round(duration / MS_PER_MINUTE),
        percentage: totalSegmentMs === 0 ? 0 : Math.round((duration / totalSegmentMs) * PERCENT)
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, TOP_APP_COUNT);

    appUsageTimeline = appSegmentData
      .map((segment) => ({
        app: getAppDisplayName(segment.apk),
        startTime: new Date(segmentStart(segment)).toLocaleTimeString(),
        duration: Math.round(segmentMs(segment) / MS_PER_MINUTE),
        timestamp: segmentStart(segment)
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    userBehaviorPatterns = analyzeUserPatterns();
  }

  /** Mean seconds between the first and last screenshot, or 0 when there are fewer than two. */
  function measureScreenshotInterval(): number {
    const firstShot = Number(screenshotData[0]?.t_epoch_ts_ms);
    const lastShot = Number(screenshotData[screenshotData.length - 1]?.t_epoch_ts_ms);
    if (totalScreenshots < 2 || !Number.isFinite(firstShot) || !Number.isFinite(lastShot)) return 0;
    return Math.round((lastShot - firstShot) / (totalScreenshots - 1) / MS_PER_SECOND);
  }

  function getAppDisplayName(apk: string | null): string {
    const appMap: Record<string, string> = {
      'com.google.android.youtube': 'YouTube',
      'com.android.chrome': 'Chrome Browser',
      'com.google.android.apps.nexuslauncher': 'Launcher',
      'com.screenlake': 'Screenlake Research',
      'com.android.systemui': 'System UI',
      'com.google.android.permissioncontroller': 'Permission Controller',
      'com.google.android.googlequicksearchbox': 'Google Search'
    };
    if (!apk) return 'Unknown app';
    return appMap[apk] ?? apk.split('.').pop() ?? apk;
  }

  function analyzeUserPatterns(): BehaviourPattern[] {
    const textEntries = appAccessibilityData.filter((event) => event.type === 'SCREEN_TEXT' && event.text);
    const urlEntries = appAccessibilityData.filter((event) => event.type === 'URL');

    return [
      textEntries.length > 0 && {
        type: 'Content Interaction',
        description: `Interacted with ${textEntries.length} screen elements`,
        count: textEntries.length,
        icon: '👆'
      },
      urlEntries.length > 0 && {
        type: 'Web Browsing',
        description: `Visited ${urlEntries.length} URLs`,
        count: urlEntries.length,
        icon: '🌐'
      },
      appSegmentData.length > 1 && {
        type: 'App Switching',
        description: `Switched between ${uniqueApps.size} applications`,
        count: uniqueApps.size,
        icon: '🔄'
      },
      avgScreenshotInterval > 0 && {
        type: 'Capture Frequency',
        description: `Screenshots captured every ~${avgScreenshotInterval} seconds on average`,
        count: avgScreenshotInterval,
        icon: '📸'
      }
    ].filter((pattern): pattern is BehaviourPattern => pattern !== false);
  }

  function formatTimestamp(timestamp: number) {
    const ms = Number(timestamp);
    return Number.isFinite(ms) ? new Date(ms).toLocaleString() : 'Unknown time';
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
  <title>Android Analytics - Social Explorer</title>
  <meta name="description" content="Analyze Android mobile device user interactions and app usage patterns" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <PageHeader
    title="Android Analytics Dashboard"
    subtitle="Princeton SMART and Screenlake Research Kit data analysis"
    showProject={false}
    iconPath="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z">
    <svelte:fragment slot="actions">
      <button
        on:click={() => goto('/android-research')}
        class="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
        </svg>
        Advanced Research
      </button>
      <button
        on:click={exportData}
        disabled={!hasData}
        title={hasData ? 'Export the analysis as JSON' : 'Export is available once Android data is loaded'}
        class="px-4 py-2 rounded-md text-sm font-medium bg-primary-600 hover:bg-primary-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        Export Analysis
      </button>
    </svelte:fragment>
  </PageHeader>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading Android analytics...</span>
      </div>
    {:else if loadError}
      <ErrorAlert message={loadError} dismissable={false} />
      <button
        on:click={loadAndroidAnalyticsData}
        class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
        Retry
      </button>
    {:else if !hasData}
      <DataUnavailable
        title="No Android data yet"
        description="This page reads data from the Princeton SMART / Screenlake research kit. Loading that data is not available in this release, so there is nothing to show." />
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
          <div class="text-xs text-gray-500 mt-1">{avgScreenshotInterval > 0 ? `Every ~${avgScreenshotInterval}s on average` : 'Interval not measured'}</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6 text-center">
          <div class="text-3xl font-bold text-emerald-600 mb-1">{uniqueApps.size}</div>
          <div class="text-sm text-gray-600">Unique Applications</div>
          <div class="text-xs text-gray-500 mt-1">Different apps used</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6 text-center">
          <div class="text-3xl font-bold text-signal-700 mb-1">{sessionDuration}</div>
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
            {#each appAccessibilityData.filter((event) => event.type === 'SCREEN_TEXT' && event.text) as textData}
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
            {#each appAccessibilityData.filter((event) => event.type === 'URL') as urlData}
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
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
