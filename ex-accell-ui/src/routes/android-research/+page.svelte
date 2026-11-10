<script lang="ts">
  import { CHART, DIVERGING } from '$lib/utils/chartColors';
  import { goto } from '$app/navigation';
  import { onMount, tick } from 'svelte';
  import * as echarts from 'echarts';
  import { androidResearchDb } from '$lib/services/androidResearchDb';
  import type {
    AppTransition,
    AttentionSpan,
    BehaviouralMetrics,
    CognitiveLoad,
    ContentEngagement,
    DigitalPhenotype,
    ResearchFinding,
    TemporalUsagePattern
  } from '$lib/services/types/androidResearchTypes';
  import { acyclicTransitions, behaviouralMetrics, hasAndroidData, temporalUsageFromSessions } from '$lib/utils/androidData';
  import DataUnavailable from '$lib/components/ui/DataUnavailable.svelte';
  import ErrorAlert from '$lib/components/ui/ErrorAlert.svelte';

  const LOAD_ERROR = 'Could not load Android research data. Check the connection and try again.';
  const CHART_SETTLE_MS = 200;
  const HOURS_IN_DAY = 24;
  const SECONDS_PER_MINUTE = 60;
  const PERCENT = 100;
  const NOT_CLASSIFIED = 'Not classified';
  const NOTHING_RECORDED = 'Nothing recorded for this section yet.';

  type Analysis = 'temporal-patterns' | 'network-analysis' | 'attention-research' | 'engagement-analysis' | 'findings';
  const ANALYSES: Array<{ id: Analysis; label: string }> = [
    { id: 'temporal-patterns', label: 'Temporal Patterns' },
    { id: 'network-analysis', label: 'Network Analysis' },
    { id: 'attention-research', label: 'Attention Research' },
    { id: 'engagement-analysis', label: 'Engagement Analysis' },
    { id: 'findings', label: 'Research Findings' }
  ];

  let activeAnalysis: Analysis = 'temporal-patterns';
  let loading = true;
  let loadError = '';
  let hasData = false;

  // Chart containers
  let temporalChart: HTMLDivElement | undefined;
  let appNetworkChart: HTMLDivElement | undefined;
  let attentionChart: HTMLDivElement | undefined;
  let engagementChart: HTMLDivElement | undefined;
  let transitionChart: HTMLDivElement | undefined;
  let heatmapChart: HTMLDivElement | undefined;

  // ECharts instances
  let temporalChartInstance: echarts.ECharts | undefined;
  let appNetworkChartInstance: echarts.ECharts | undefined;
  let attentionChartInstance: echarts.ECharts | undefined;
  let engagementChartInstance: echarts.ECharts | undefined;
  let transitionChartInstance: echarts.ECharts | undefined;
  let heatmapChartInstance: echarts.ECharts | undefined;

  // Rows from the Android research endpoints, and the figures derived from them
  let attentionSpans: AttentionSpan[] = [];
  let contentEngagement: ContentEngagement[] = [];
  let cognitiveLoad: CognitiveLoad[] = [];
  let appTransitions: AppTransition[] = [];
  let temporalUsage: TemporalUsagePattern[] = [];
  let keyFindings: ResearchFinding[] = [];
  let metrics: BehaviouralMetrics | null = null;
  let digitalPhenotype: DigitalPhenotype | null = null;

  $: appNames = [...new Set(temporalUsage.flatMap((hour) => hour.apps.map((entry) => entry.app)))];

  const chartInstances = () => [
    temporalChartInstance,
    appNetworkChartInstance,
    attentionChartInstance,
    engagementChartInstance,
    transitionChartInstance,
    heatmapChartInstance
  ];

  function resizeCharts() {
    chartInstances().forEach((chart) => chart?.resize());
  }

  onMount(() => {
    void loadResearchData();
    window.addEventListener('resize', resizeCharts);
    return () => {
      window.removeEventListener('resize', resizeCharts);
      chartInstances().forEach((chart) => chart?.dispose());
    };
  });

  async function loadResearchData() {
    loading = true;
    loadError = '';
    hasData = false;
    try {
      const [attention, engagement, cognitive, phenotype, findings, flow] = await Promise.all([
        androidResearchDb.getAttentionSpans(),
        androidResearchDb.getContentEngagement(),
        androidResearchDb.getCognitiveLoadData(),
        androidResearchDb.getDigitalPhenotype(),
        androidResearchDb.getResearchFindings(),
        androidResearchDb.getTransitionFlow()
      ]);

      attentionSpans = attention.data;
      contentEngagement = engagement.data;
      cognitiveLoad = cognitive.data;
      digitalPhenotype = phenotype.data;
      keyFindings = findings.data;
      appTransitions = flow.data;
      temporalUsage = temporalUsageFromSessions(attentionSpans);
      metrics = behaviouralMetrics(temporalUsage, attentionSpans, appTransitions);
      hasData = hasAndroidData([attention, engagement, cognitive, phenotype, findings, flow]);
    } catch (error) {
      console.error('Android research data failed to load:', error);
      loadError = LOAD_ERROR;
    }
    loading = false;
    if (hasData) await drawCharts();
  }

  /** Draws the charts once the dashboard is in the DOM. */
  async function drawCharts() {
    await tick();
    setTimeout(initializeCharts, CHART_SETTLE_MS);
  }

  function mountChart(container: HTMLDivElement | undefined, existing: echarts.ECharts | undefined, option: unknown): echarts.ECharts | undefined {
    if (!container || container.offsetWidth === 0) return existing;
    existing?.dispose();
    const chart = echarts.init(container, 'social-explorer');
    chart.setOption(option as echarts.EChartsOption);
    return chart;
  }

  function initializeCharts() {
    if (!hasData) return;
    if (activeAnalysis === 'temporal-patterns') {
      temporalChartInstance = mountChart(temporalChart, temporalChartInstance, getTemporalChartOption());
      heatmapChartInstance = mountChart(heatmapChart, heatmapChartInstance, getHeatmapOption());
    }
    if (activeAnalysis === 'network-analysis') {
      appNetworkChartInstance = mountChart(appNetworkChart, appNetworkChartInstance, getAppNetworkOption());
      transitionChartInstance = mountChart(transitionChart, transitionChartInstance, getTransitionFlowOption());
    }
    if (activeAnalysis === 'attention-research') {
      attentionChartInstance = mountChart(attentionChart, attentionChartInstance, getAttentionChartOption());
    }
    if (activeAnalysis === 'engagement-analysis') {
      engagementChartInstance = mountChart(engagementChart, engagementChartInstance, getEngagementChartOption());
    }
  }

  function getTemporalChartOption() {
    const series = appNames.map((app) => ({
      name: app,
      type: 'line',
      smooth: true,
      data: temporalUsage.map((hour) => [hour.hour, hour.apps.find((entry) => entry.app === app)?.usage ?? 0]),
      areaStyle: { opacity: 0.1 },
      lineStyle: { width: 3 }
    }));

    return {
      title: { text: 'Temporal Usage Patterns (24-Hour Analysis)', left: 'center', textStyle: { fontSize: 18, fontWeight: 'bold' } },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: Array<{ seriesName: string; value: [number, number] }>) =>
          [`<strong>Hour: ${params[0].value[0]}:00</strong>`, ...params.map((param) => `${param.seriesName}: ${param.value[1].toFixed(1)} min`)].join('<br/>')
      },
      legend: { top: 30, type: 'scroll' },
      xAxis: { type: 'value', name: 'Hour of day (UTC)', min: 0, max: HOURS_IN_DAY - 1, axisLabel: { formatter: '{value}:00' } },
      yAxis: { type: 'value', name: 'Usage (minutes)', axisLabel: { formatter: '{value}' } },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        { type: 'slider', xAxisIndex: 0, height: 20, bottom: 10 }
      ],
      series
    };
  }

  const APP_CATEGORIES = ['Social', 'Productivity', 'Entertainment', 'Communication', 'Utility', 'Other'];
  const CATEGORY_COLOURS = [CHART.danger500, CHART.primary500, CHART.catSky, CHART.catOrange, CHART.primary600, CHART.ink400];

  function getCategoryIndex(app: string): number {
    const categories: Record<string, number> = {
      Instagram: 0, YouTube: 2, Chrome: 1, Gmail: 1, WhatsApp: 3, Maps: 4, Camera: 4, Settings: 4, Launcher: 4
    };
    return categories[app] ?? APP_CATEGORIES.indexOf('Other');
  }

  function getAppNetworkOption() {
    const apps = [...new Set(appTransitions.flatMap((transition) => [transition.source, transition.target]))];
    const nodes = apps.map((app) => {
      const outgoing = appTransitions.filter((transition) => transition.source === app).reduce((sum, transition) => sum + transition.value, 0);
      return { id: app, name: app, value: outgoing, symbolSize: Math.sqrt(outgoing) * 2 + 20, category: getCategoryIndex(app) };
    });
    const links = appTransitions.map((transition) => ({
      source: transition.source,
      target: transition.target,
      value: transition.value,
      lineStyle: { width: Math.sqrt(transition.value) }
    }));

    return {
      title: { text: 'App Transition Network Analysis', left: 'center', textStyle: { fontSize: 18, fontWeight: 'bold' } },
      tooltip: {
        formatter: (params: { dataType: string; data: { source?: string; target?: string; value: number; name?: string } }) =>
          params.dataType === 'edge'
            ? `${params.data.source} → ${params.data.target}<br/>Transitions: ${params.data.value}`
            : `${params.data.name}<br/>Outgoing transitions: ${params.data.value}`
      },
      legend: { data: APP_CATEGORIES, top: 30 },
      series: [{
        type: 'graph',
        layout: 'force',
        force: { repulsion: 1000, gravity: 0.1, edgeLength: [50, 200] },
        roam: true,
        draggable: true,
        itemStyle: { borderWidth: 2, borderColor: CHART.white },
        lineStyle: { color: 'source', curveness: 0.1, opacity: 0.7 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 5 } },
        categories: APP_CATEGORIES.map((name, index) => ({ name, itemStyle: { color: CATEGORY_COLOURS[index] } })),
        data: nodes,
        links
      }]
    };
  }

  function getAttentionChartOption() {
    const data = attentionSpans.map((span) => ({
      name: span.app,
      value: [span.sessions.length, span.meanDuration, span.sessions.reduce((sum, session) => sum + session.duration, 0), span.app]
    }));

    return {
      title: { text: 'Attention Span by Application', left: 'center', textStyle: { fontSize: 18, fontWeight: 'bold' } },
      tooltip: {
        formatter: (params: { data: { value: [number, number, number, string] } }) =>
          `${params.data.value[3]}<br/>Sessions: ${params.data.value[0]}<br/>Mean session: ${params.data.value[1].toFixed(1)}s<br/>Total: ${(params.data.value[2] / SECONDS_PER_MINUTE).toFixed(1)} min`
      },
      xAxis: { type: 'value', name: 'Sessions' },
      yAxis: { type: 'value', name: 'Mean session length (seconds)', axisLabel: { formatter: '{value}s' } },
      series: [{
        type: 'scatter',
        symbolSize: (value: [number, number, number, string]) => Math.sqrt(value[2] / SECONDS_PER_MINUTE) * 3 + 8,
        itemStyle: { color: CHART.catBlue, opacity: 0.8 },
        data,
        markLine: { lineStyle: { type: 'dashed', color: CHART.ink400 }, data: [{ type: 'average', name: 'Average' }] }
      }]
    };
  }

  function getEngagementChartOption() {
    return {
      title: { text: 'Content Engagement Analysis', left: 'center', textStyle: { fontSize: 18, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 30 },
      xAxis: { type: 'category', data: contentEngagement.map((entry) => entry.content) },
      yAxis: [
        { type: 'value', name: 'Engagement Score', position: 'left', axisLabel: { formatter: '{value}' }, max: PERCENT },
        { type: 'value', name: 'Minutes / visits', position: 'right' }
      ],
      series: [
        { name: 'Engagement Score', type: 'bar', data: contentEngagement.map((entry) => entry.engagementScore), itemStyle: { color: CHART.catBlue } },
        { name: 'Avg Duration (min)', type: 'line', yAxisIndex: 1, data: contentEngagement.map((entry) => entry.avgDuration / SECONDS_PER_MINUTE), itemStyle: { color: CHART.catGreen }, lineStyle: { width: 3 } },
        { name: 'Avg Return Visits', type: 'line', yAxisIndex: 1, data: contentEngagement.map((entry) => entry.returnVisits), itemStyle: { color: CHART.catOrange }, lineStyle: { width: 3 } }
      ]
    };
  }

  function getTransitionFlowOption() {
    const links = acyclicTransitions(appTransitions);
    const nodes = [...new Set(links.flatMap((link) => [link.source, link.target]))].map((name) => ({ name }));

    return {
      title: { text: 'App Transition Flow (Sankey Diagram)', left: 'center', textStyle: { fontSize: 18, fontWeight: 'bold' } },
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: { dataType: string; data: { source?: string; target?: string; value?: number; name?: string } }) =>
          params.dataType === 'edge' ? `${params.data.source} → ${params.data.target}<br/>Transitions: ${params.data.value}` : `${params.data.name}`
      },
      series: [{
        type: 'sankey',
        layout: 'none',
        emphasis: { focus: 'adjacency' },
        nodeAlign: 'justify',
        nodeGap: 12,
        nodeWidth: 20,
        data: nodes,
        links,
        itemStyle: { borderWidth: 1, borderColor: CHART.ink300 },
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.6 },
        label: { show: true, fontSize: 12, fontWeight: 'bold', color: CHART.ink800 }
      }]
    };
  }

  function getHeatmapOption() {
    const hours = Array.from({ length: HOURS_IN_DAY }, (_, hour) => hour);
    const data = appNames.flatMap((app, appIndex) =>
      hours.map((hour) => [hour, appIndex, Math.round(temporalUsage[hour]?.apps.find((entry) => entry.app === app)?.usage ?? 0)])
    );
    const maxUsage = Math.max(1, ...data.map((cell) => cell[2]));

    return {
      title: { text: 'Usage Intensity Heatmap (App × Hour)', left: 'center', textStyle: { fontSize: 18, fontWeight: 'bold' } },
      tooltip: {
        position: 'top',
        formatter: (params: { data: [number, number, number] }) => `${appNames[params.data[1]]} at ${params.data[0]}:00<br/>Usage: ${params.data[2]} minutes`
      },
      xAxis: { type: 'category', data: hours.map((hour) => `${hour}:00`), splitArea: { show: true } },
      yAxis: { type: 'category', data: appNames, splitArea: { show: true } },
      visualMap: { min: 0, max: maxUsage, calculable: true, orient: 'horizontal', left: 'center', bottom: '5%', inRange: { color: [...DIVERGING] } },
      series: [{ type: 'heatmap', data, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } } }]
    };
  }

  function switchAnalysis(analysis: Analysis) {
    activeAnalysis = analysis;
    if (hasData) void drawCharts();
  }

  function exportResearchReport() {
    const report = {
      metadata: {
        exportDate: new Date().toISOString(),
        analysisType: 'Android behavioural research'
      },
      metrics,
      digitalPhenotype,
      keyFindings,
      rawData: { attentionSpans, contentEngagement, cognitiveLoad, appTransitions, temporalUsage }
    };

    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `android_research_report_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>Android Research Analytics - Social Explorer</title>
  <meta name="description" content="Advanced research dashboard for Android mobile behavior analysis using Princeton SMART data" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Research Header -->
  <div class="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/20 opacity-60"></div>

    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex min-w-0 items-center">
          <div class="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-600 rounded-xl shadow-lg flex items-center justify-center mr-4 border border-white/20 backdrop-blur-sm">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-white mb-1 tracking-tight">Android Research Analytics</h1>
            <p class="text-slate-300 text-sm font-medium">Deep Behavioral Analysis • Digital Phenotyping • Attention Research</p>
            <div class="flex flex-wrap items-center mt-2 gap-x-4 gap-y-2">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                🧠 Cognitive Analysis
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                📊 Interactive Visualizations
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                🔬 Research-Grade Metrics
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Research Toolbar -->
  <div class="bg-white border-b border-gray-200 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex items-center gap-3">
        <button
          on:click={() => goto('/android-analytics')}
          class="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors">
          <svg class="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Basic Analytics
        </button>
        <button
          on:click={exportResearchReport}
          disabled={!hasData}
          title={hasData ? 'Export the research report as JSON' : 'Export is available once Android research data is loaded'}
          class="disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors shadow-sm">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Export Report
        </button>
      </div>
    </div>
  </div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading Android research data...</span>
      </div>
    {:else if loadError}
      <ErrorAlert message={loadError} dismissable={false} />
      <button
        on:click={loadResearchData}
        class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
        Retry
      </button>
    {:else if !hasData}
      <DataUnavailable
        title="No Android data yet"
        description="This page reads data from the Princeton SMART / Screenlake research kit. Loading that data is not available in this release, so there is nothing to show." />
    {:else}
      {#if metrics}
        <!-- Behavioural Metrics Overview -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-3xl font-bold text-indigo-600 mb-1">{metrics.totalDailyUsage}m</div>
            <div class="text-sm text-gray-600">Usage per day</div>
            <div class="text-xs text-gray-500 mt-1">Over {metrics.daysRecorded} {metrics.daysRecorded === 1 ? 'day' : 'days'} recorded</div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-3xl font-bold text-purple-600 mb-1">{metrics.peakUsageHour === null ? '—' : `${metrics.peakUsageHour}:00`}</div>
            <div class="text-sm text-gray-600">Peak Activity (UTC)</div>
            <div class="text-xs text-gray-500 mt-1">{digitalPhenotype?.usagePattern ?? NOT_CLASSIFIED}</div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-3xl font-bold text-pink-600 mb-1">{metrics.avgSessionLength}s</div>
            <div class="text-sm text-gray-600">Avg Session</div>
            <div class="text-xs text-gray-500 mt-1">{digitalPhenotype?.attentionProfile ?? NOT_CLASSIFIED}</div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-3xl font-bold text-emerald-600 mb-1">{metrics.appSwitchingRate}</div>
            <div class="text-sm text-gray-600">Transitions per hour</div>
            <div class="text-xs text-gray-500 mt-1">{digitalPhenotype?.multitaskingIndex ?? NOT_CLASSIFIED} multitasking</div>
          </div>
        </div>
      {/if}

      <!-- Analysis Navigation -->
      <div class="bg-white rounded-xl shadow-sm mb-8">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8 overflow-x-auto whitespace-nowrap px-6 pt-1" aria-label="Analysis type">
            {#each ANALYSES as analysis}
              <button
                class="py-4 px-1 border-b-2 font-medium text-sm {activeAnalysis === analysis.id ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
                on:click={() => switchAnalysis(analysis.id)}>
                {analysis.label}
              </button>
            {/each}
          </nav>
        </div>

        <!-- Analysis Content -->
        <div class="p-6">

          {#if activeAnalysis === 'temporal-patterns'}
            {#if temporalUsage.length === 0}
              <p class="text-sm text-gray-500">{NOTHING_RECORDED}</p>
            {:else}
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-gray-50 rounded-xl p-4">
                  <div bind:this={temporalChart} class="w-full h-96"></div>
                </div>
                <div class="bg-gray-50 rounded-xl p-4">
                  <div bind:this={heatmapChart} class="w-full h-96"></div>
                </div>
              </div>
            {/if}
            <div class="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 class="font-semibold text-blue-900 mb-2">Temporal Analysis</h4>
              <p class="text-blue-800 text-sm">Minutes spent in each app during each hour of the day, summed from the recorded sessions, and the same figures as a heatmap. Hours are in UTC.</p>
            </div>
          {/if}

          {#if activeAnalysis === 'network-analysis'}
            {#if appTransitions.length === 0}
              <p class="text-sm text-gray-500">{NOTHING_RECORDED}</p>
            {:else}
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-gray-50 rounded-xl p-4">
                  <div bind:this={appNetworkChart} class="w-full h-96"></div>
                </div>
                <div class="bg-gray-50 rounded-xl p-4">
                  <div bind:this={transitionChart} class="w-full h-96"></div>
                </div>
              </div>
            {/if}
            <div class="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
              <h4 class="font-semibold text-purple-900 mb-2">Network Analysis</h4>
              <p class="text-purple-800 text-sm">Each node is an app and each link counts the recorded moves from one app to the next. The Sankey diagram shows the same transitions with any cycles removed so the flow can be drawn.</p>
            </div>
          {/if}

          {#if activeAnalysis === 'attention-research'}
            {#if attentionSpans.length === 0}
              <p class="text-sm text-gray-500">{NOTHING_RECORDED}</p>
            {:else}
              <div class="bg-gray-50 rounded-xl p-4">
                <div bind:this={attentionChart} class="w-full h-96"></div>
              </div>
            {/if}
            <div class="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <h4 class="font-semibold text-emerald-900 mb-2">Attention Research</h4>
              <p class="text-emerald-800 text-sm">Mean session length against the number of sessions for each app; larger points mark more total time. Apps high on the chart hold attention for longer at a stretch.</p>
            </div>
          {/if}

          {#if activeAnalysis === 'engagement-analysis'}
            {#if contentEngagement.length === 0}
              <p class="text-sm text-gray-500">{NOTHING_RECORDED}</p>
            {:else}
              <div class="bg-gray-50 rounded-xl p-4">
                <div bind:this={engagementChart} class="w-full h-96"></div>
              </div>
            {/if}
            <div class="mt-6 bg-pink-50 border border-pink-200 rounded-xl p-4">
              <h4 class="font-semibold text-pink-900 mb-2">Content Engagement</h4>
              <p class="text-pink-800 text-sm">Engagement score, average time spent and the average number of return visits for each kind of content in the recorded sessions.</p>
            </div>
          {/if}

          {#if activeAnalysis === 'findings'}
            <div class="space-y-6">
              <h3 class="text-xl font-semibold text-gray-900">Key Research Findings</h3>

              {#each keyFindings as finding}
                <div class="border border-gray-200 rounded-xl p-6">
                  <div class="flex items-start justify-between mb-4">
                    <h4 class="text-lg font-medium text-gray-900">{finding.title}</h4>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      Research Finding
                    </span>
                  </div>

                  <div class="space-y-3">
                    <div>
                      <span class="text-sm font-medium text-gray-700">Finding:</span>
                      <p class="text-sm text-gray-600 mt-1">{finding.finding}</p>
                    </div>

                    <div>
                      <span class="text-sm font-medium text-gray-700">Statistical Significance:</span>
                      <p class="text-sm text-gray-600 mt-1">{finding.significance}</p>
                    </div>

                    <div>
                      <span class="text-sm font-medium text-gray-700">Research Implication:</span>
                      <p class="text-sm text-gray-600 mt-1">{finding.implication}</p>
                    </div>
                  </div>
                </div>
              {:else}
                <p class="text-sm text-gray-500">No findings have been recorded for this data yet.</p>
              {/each}

              {#if digitalPhenotype}
                <!-- Digital Phenotype Summary -->
                <div class="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
                  <h4 class="text-lg font-semibold text-purple-900 mb-4">Digital Behavioural Phenotype</h4>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="text-center">
                      <div class="text-2xl font-bold text-purple-600">{digitalPhenotype.behaviorType}</div>
                      <div class="text-sm text-purple-700">Usage Profile</div>
                    </div>
                    <div class="text-center">
                      <div class="text-2xl font-bold text-purple-600">{digitalPhenotype.attentionProfile}</div>
                      <div class="text-sm text-purple-700">Attention Pattern</div>
                    </div>
                    <div class="text-center">
                      <div class="text-2xl font-bold text-purple-600">{digitalPhenotype.usagePattern}</div>
                      <div class="text-sm text-purple-700">Temporal Profile</div>
                    </div>
                    <div class="text-center">
                      <div class="text-2xl font-bold text-purple-600">{digitalPhenotype.multitaskingIndex}</div>
                      <div class="text-sm text-purple-700">Multitasking Index</div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
