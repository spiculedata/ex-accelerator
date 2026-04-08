<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, afterUpdate, tick } from 'svelte';
  import { androidResearchDb } from '$lib/services/androidResearchDb';
  import * as echarts from 'echarts';
  import ErrorAlert from '$lib/components/ui/ErrorAlert.svelte';

  let errorMessage = '';

  // Research Analysis State
  let activeAnalysis = 'temporal-patterns';
  let loading = true;
  let selectedTimeRange = '24h';
  let selectedUser = '7324';
  let isDemo = false;
  
  // Chart containers
  let temporalChart: HTMLDivElement;
  let appNetworkChart: HTMLDivElement;
  let attentionChart: HTMLDivElement;
  let engagementChart: HTMLDivElement;
  let transitionChart: HTMLDivElement;
  let heatmapChart: HTMLDivElement;

  // ECharts instances
  let temporalChartInstance: echarts.ECharts;
  let appNetworkChartInstance: echarts.ECharts;
  let attentionChartInstance: echarts.ECharts;
  let engagementChartInstance: echarts.ECharts;
  let transitionChartInstance: echarts.ECharts;
  let heatmapChartInstance: echarts.ECharts;

  // Research Data - Loaded from database service
  let researchData: {
    temporalUsage: any[];
    appTransitions: any[];
    attentionSpans: any[];
    contentEngagement: any[];
    cognitiveLoad: any[];
    userSessions: any[];
  } = {
    temporalUsage: [],
    appTransitions: [],
    attentionSpans: [],
    contentEngagement: [],
    cognitiveLoad: [],
    userSessions: []
  };

  // Research Insights
  let keyFindings: any[] = [];
  let behavioralMetrics: any = {};
  let digitalPhenotype: any = {};

  onMount(async () => {
    try {
      console.log('Loading research data from database...');
      await loadResearchData();
      console.log('Data loaded, performing analysis...');
      await performBehavioralAnalysis();
      console.log('Analysis complete, setting loading to false');
      loading = false;
      
      // Initialize charts after the loading is complete and DOM is updated
      await tick();
      setTimeout(() => {
        initializeCharts();
      }, 200);
    } catch (error) {
      console.error('Error in onMount:', error);
      errorMessage = 'Failed to load research data. Showing generated sample data instead.';
      // Fallback to generated data if database fails
      generateAdvancedResearchData();
      isDemo = true;
      performBehavioralAnalysis();
      loading = false;
      await tick();
      setTimeout(() => {
        initializeCharts();
      }, 200);
    }
  });

  // Load research data from database service
  async function loadResearchData() {
    try {
      // Load all research data from database service
      const temporalResult = await androidResearchDb.getTemporalUsagePatterns();
      const transitionsResult = await androidResearchDb.getAppTransitions();
      const attentionResult = await androidResearchDb.getAttentionSpans();
      const engagementResult = await androidResearchDb.getContentEngagement();
      const cognitiveResult = await androidResearchDb.getCognitiveLoadData();

      researchData.temporalUsage = temporalResult.data;
      researchData.appTransitions = transitionsResult.data;
      researchData.attentionSpans = attentionResult.data;
      researchData.contentEngagement = engagementResult.data;
      researchData.cognitiveLoad = cognitiveResult.data;

      // Flag as demo if any result is demo data
      isDemo = temporalResult.isDemo || transitionsResult.isDemo || attentionResult.isDemo || engagementResult.isDemo || cognitiveResult.isDemo;

      console.log('Research data loaded successfully from database', isDemo ? '(demo mode)' : '');
    } catch (error) {
      console.error('Error loading research data:', error);
      errorMessage = 'Failed to load research data from the database.';
      throw error;
    }
  }

  function generateAdvancedResearchData() {
    // Generate realistic temporal usage patterns (24-hour period)
    const apps = ['YouTube', 'Chrome', 'Instagram', 'WhatsApp', 'Gmail', 'Maps', 'Camera', 'Settings', 'Launcher'];
    const hours = Array.from({length: 24}, (_, i) => i);
    
    researchData.temporalUsage = hours.map(hour => {
      // Simulate realistic usage patterns - higher during day, peaks at lunch/evening
      const baseUsage = Math.max(0, Math.sin((hour - 6) * Math.PI / 12) * 100 + Math.random() * 20);
      const appUsage = apps.map(app => ({
        app,
        hour,
        usage: Math.max(0, baseUsage * (0.5 + Math.random()) * getAppPopularityMultiplier(app, hour)),
        sessions: Math.floor(Math.random() * 15) + 1,
        avgDuration: Math.floor(Math.random() * 300) + 30 // 30s to 5min average
      }));
      return { hour, apps: appUsage, totalUsage: appUsage.reduce((sum, a) => sum + a.usage, 0) };
    });

    // Generate app transition matrix for network analysis
    researchData.appTransitions = [];
    apps.forEach(fromApp => {
      apps.forEach(toApp => {
        if (fromApp !== toApp) {
          const weight = Math.floor(Math.random() * 50) + 5; // Ensure minimum weight
          const probability = getTransitionProbability(fromApp, toApp);
          const transitionValue = Math.max(1, Math.floor(weight * probability)); // Ensure minimum value
          researchData.appTransitions.push({
            source: fromApp,
            target: toApp,
            value: transitionValue,
            avgTime: Math.floor(Math.random() * 180) + 10 // Time spent before transition
          });
        }
      });
    });
    
    console.log('Generated app transitions:', researchData.appTransitions.length);

    // Generate attention span distribution data
    researchData.attentionSpans = apps.map(app => ({
      app,
      meanDuration: getAppMeanDuration(app),
      sessions: Array.from({length: 50}, () => ({
        duration: Math.max(5, Math.floor(Math.random() * 600) + getAppMeanDuration(app) - 100),
        timestamp: Date.now() - Math.random() * 86400000,
        taskSwitches: Math.floor(Math.random() * 5),
        interruptions: Math.floor(Math.random() * 3)
      }))
    }));

    // Generate content engagement data based on OCR text analysis
    researchData.contentEngagement = [
      { content: 'Social Media', engagementScore: 85, avgDuration: 180, interactionDepth: 7.2, returnRate: 0.65 },
      { content: 'Video Content', engagementScore: 92, avgDuration: 320, interactionDepth: 4.1, returnRate: 0.45 },
      { content: 'Shopping', engagementScore: 78, avgDuration: 240, interactionDepth: 8.9, returnRate: 0.35 },
      { content: 'Communication', engagementScore: 88, avgDuration: 90, interactionDepth: 6.5, returnRate: 0.85 },
      { content: 'Navigation', engagementScore: 70, avgDuration: 45, interactionDepth: 3.2, returnRate: 0.25 },
      { content: 'News/Information', engagementScore: 73, avgDuration: 150, interactionDepth: 5.8, returnRate: 0.40 }
    ];

    // Generate cognitive load indicators
    researchData.cognitiveLoad = hours.map(hour => ({
      hour,
      taskSwitches: Math.floor(Math.random() * 20) + 5,
      multitaskingIndex: Math.random() * 10,
      attentionFragmentation: Math.random() * 100,
      cognitiveEfficiency: Math.max(0, 100 - (Math.random() * 40))
    }));
  }

  function getAppPopularityMultiplier(app: string, hour: number): number {
    const patterns: Record<string, number> = {
      'YouTube': Math.max(0.3, Math.sin((hour - 20) * Math.PI / 8) * 0.7 + 0.5), // Peak evening
      'Instagram': Math.max(0.2, Math.sin((hour - 21) * Math.PI / 6) * 0.8 + 0.4), // Peak late evening
      'WhatsApp': Math.max(0.4, 1 - Math.abs(hour - 12) / 24), // Peak midday
      'Gmail': hour >= 9 && hour <= 17 ? 0.8 : 0.3, // Work hours
      'Chrome': Math.max(0.3, 1 - Math.abs(hour - 14) / 20) // Peak afternoon
    };
    return patterns[app] || (0.3 + Math.random() * 0.4);
  }

  function getTransitionProbability(from: string, to: string): number {
    const transitions: Record<string, Record<string, number>> = {
      'YouTube': { 'Chrome': 0.3, 'Instagram': 0.4, 'WhatsApp': 0.2 },
      'Instagram': { 'WhatsApp': 0.5, 'Chrome': 0.3, 'Camera': 0.4 },
      'Chrome': { 'YouTube': 0.4, 'Gmail': 0.3, 'Maps': 0.2 },
      'WhatsApp': { 'Camera': 0.3, 'Instagram': 0.4, 'Chrome': 0.2 }
    };
    return transitions[from]?.[to] || Math.random() * 0.3;
  }

  function getAppMeanDuration(app: string): number {
    const durations: Record<string, number> = {
      'YouTube': 280, 'Instagram': 180, 'WhatsApp': 90, 'Chrome': 200,
      'Gmail': 60, 'Maps': 45, 'Camera': 30, 'Settings': 40, 'Launcher': 15
    };
    return durations[app] || 120;
  }

  function initializeCharts() {
    try {
      console.log('Initializing charts...');
      
      // Temporal Usage Pattern Chart - check if we're on the temporal tab
      if (activeAnalysis === 'temporal-patterns' && temporalChart && temporalChart.offsetWidth > 0) {
        console.log('Initializing temporal chart');
        if (temporalChartInstance) {
          temporalChartInstance.dispose();
        }
        temporalChartInstance = echarts.init(temporalChart);
        temporalChartInstance.setOption(getTemporalChartOption());
      } else {
        console.log('Temporal chart container not ready or not on temporal tab');
      }

      // App Network Chart
      if (appNetworkChart && appNetworkChart.offsetWidth > 0) {
        console.log('Initializing app network chart');
        appNetworkChartInstance = echarts.init(appNetworkChart);
        appNetworkChartInstance.setOption(getAppNetworkOption());
      } else {
        console.log('App network chart container not ready');
      }

      // Attention Span Distribution Chart
      if (attentionChart && attentionChart.offsetWidth > 0) {
        console.log('Initializing attention chart');
        attentionChartInstance = echarts.init(attentionChart);
        attentionChartInstance.setOption(getAttentionChartOption());
      } else {
        console.log('Attention chart container not ready');
      }

      // Content Engagement Chart
      if (engagementChart && engagementChart.offsetWidth > 0) {
        console.log('Initializing engagement chart');
        engagementChartInstance = echarts.init(engagementChart);
        engagementChartInstance.setOption(getEngagementChartOption());
      } else {
        console.log('Engagement chart container not ready');
      }

      // App Transition Flow Chart
      if (transitionChart && transitionChart.offsetWidth > 0) {
        console.log('Initializing transition chart');
        transitionChartInstance = echarts.init(transitionChart);
        getTransitionFlowOption().then(option => {
          transitionChartInstance.setOption(option);
        });
      } else {
        console.log('Transition chart container not ready');
      }

      // Usage Heatmap Chart - also on temporal-patterns tab
      if (activeAnalysis === 'temporal-patterns' && heatmapChart && heatmapChart.offsetWidth > 0) {
        console.log('Initializing heatmap chart');
        if (heatmapChartInstance) {
          heatmapChartInstance.dispose();
        }
        heatmapChartInstance = echarts.init(heatmapChart);
        heatmapChartInstance.setOption(getHeatmapOption());
      } else {
        console.log('Heatmap chart container not ready or not on temporal tab');
      }

      // Handle window resize
      const resizeHandler = () => {
        temporalChartInstance?.resize();
        appNetworkChartInstance?.resize();
        attentionChartInstance?.resize();
        engagementChartInstance?.resize();
        transitionChartInstance?.resize();
        heatmapChartInstance?.resize();
      };
      
      window.removeEventListener('resize', resizeHandler);
      window.addEventListener('resize', resizeHandler);
      
      console.log('Charts initialization completed');
    } catch (error) {
      console.error('Error initializing charts:', error);
      errorMessage = 'Failed to initialize charts. Please refresh the page.';
    }
  }

  function getTemporalChartOption() {
    const apps = ['YouTube', 'Chrome', 'Instagram', 'WhatsApp', 'Gmail'];
    const series = apps.map((app, index) => ({
      name: app,
      type: 'line',
      smooth: true,
      data: researchData.temporalUsage.map(d => {
        const appData = d.apps.find((a: any) => a.app === app);
        return [d.hour, appData ? appData.usage : 0];
      }),
      areaStyle: { opacity: 0.1 },
      lineStyle: { width: 3 }
    }));

    return {
      title: {
        text: 'Temporal Usage Patterns (24-Hour Analysis)',
        left: 'center',
        textStyle: { fontSize: 18, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: function(params: any) {
          let result = `<strong>Hour: ${params[0].value[0]}:00</strong><br/>`;
          params.forEach((param: any) => {
            result += `${param.seriesName}: ${param.value[1].toFixed(1)} min<br/>`;
          });
          return result;
        }
      },
      legend: { top: 30, type: 'scroll' },
      xAxis: {
        type: 'value',
        name: 'Hour of Day',
        min: 0,
        max: 23,
        axisLabel: { formatter: '{value}:00' }
      },
      yAxis: {
        type: 'value',
        name: 'Usage (minutes)',
        axisLabel: { formatter: '{value}' }
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        { type: 'slider', xAxisIndex: 0, height: 20, bottom: 10 }
      ],
      series
    };
  }

  function getAppNetworkOption() {
    const nodes = ['YouTube', 'Chrome', 'Instagram', 'WhatsApp', 'Gmail', 'Maps', 'Camera'].map(app => ({
      id: app,
      name: app,
      symbolSize: Math.sqrt(researchData.appTransitions.filter(t => t.source === app).reduce((sum, t) => sum + t.value, 0)) * 2 + 20,
      category: getCategoryIndex(app)
    }));

    const links = researchData.appTransitions
      .filter(t => t.value > 5)
      .map(t => ({
        source: t.source,
        target: t.target,
        value: t.value,
        lineStyle: { width: Math.sqrt(t.value) }
      }));

    return {
      title: {
        text: 'App Transition Network Analysis',
        left: 'center',
        textStyle: { fontSize: 18, fontWeight: 'bold' }
      },
      tooltip: {
        formatter: function(params: any) {
          if (params.dataType === 'edge') {
            return `${params.data.source} → ${params.data.target}<br/>Transitions: ${params.data.value}`;
          } else {
            return `${params.data.name}<br/>Total transitions: ${params.data.symbolSize}`;
          }
        }
      },
      legend: {
        data: ['Social', 'Productivity', 'Entertainment', 'Communication', 'Utility'],
        top: 30
      },
      series: [{
        type: 'graph',
        layout: 'force',
        force: {
          repulsion: 1000,
          gravity: 0.1,
          edgeLength: [50, 200]
        },
        roam: true,
        draggable: true,
        focusNodeAdjacency: true,
        itemStyle: { borderWidth: 2, borderColor: '#fff' },
        lineStyle: { color: 'source', curveness: 0.1, opacity: 0.7 },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 5 }
        },
        categories: [
          { name: 'Social', itemStyle: { color: '#ff6b6b' } },
          { name: 'Productivity', itemStyle: { color: '#4ecdc4' } },
          { name: 'Entertainment', itemStyle: { color: '#45b7d1' } },
          { name: 'Communication', itemStyle: { color: '#f9ca24' } },
          { name: 'Utility', itemStyle: { color: '#6c5ce7' } }
        ],
        data: nodes,
        links: links
      }]
    };
  }

  function getCategoryIndex(app: string): number {
    const categories: Record<string, number> = {
      'Instagram': 0, 'YouTube': 2, 'Chrome': 1, 'Gmail': 1,
      'WhatsApp': 3, 'Maps': 4, 'Camera': 4, 'Settings': 4, 'Launcher': 4
    };
    return categories[app] || 0;
  }

  function getAttentionChartOption() {
    const data = researchData.attentionSpans.map(app => ({
      name: app.app,
      value: [
        app.meanDuration,
        app.sessions.reduce((sum: any, s: any) => sum + s.duration, 0) / app.sessions.length,
        app.sessions.length,
        app.app
      ]
    }));

    return {
      title: {
        text: 'Attention Span Analysis by Application',
        left: 'center',
        textStyle: { fontSize: 18, fontWeight: 'bold' }
      },
      tooltip: {
        formatter: function(params: any) {
          return `${params.data.value[3]}<br/>
                  Mean Duration: ${params.data.value[0].toFixed(1)}s<br/>
                  Actual Avg: ${params.data.value[1].toFixed(1)}s<br/>
                  Sessions: ${params.data.value[2]}`;
        }
      },
      xAxis: {
        type: 'value',
        name: 'Expected Mean Duration (seconds)',
        axisLabel: { formatter: '{value}s' }
      },
      yAxis: {
        type: 'value',
        name: 'Actual Average Duration (seconds)',
        axisLabel: { formatter: '{value}s' }
      },
      series: [{
        type: 'scatter',
        symbolSize: function(data: any) {
          return Math.sqrt(data[2]) * 3;
        },
        itemStyle: {
          color: function(params: any) {
            const ratio = params.data.value[1] / params.data.value[0];
            return ratio > 1.2 ? '#52c41a' : ratio < 0.8 ? '#ff4d4f' : '#1890ff';
          },
          opacity: 0.8
        },
        data: data,
        markLine: {
          lineStyle: { type: 'dashed', color: '#999' },
          data: [{ type: 'average', name: 'Average' }]
        }
      }]
    };
  }

  function getEngagementChartOption() {
    return {
      title: {
        text: 'Content Engagement Analysis',
        left: 'center',
        textStyle: { fontSize: 18, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      legend: { top: 30 },
      xAxis: {
        type: 'category',
        data: researchData.contentEngagement.map(d => d.content)
      },
      yAxis: [
        {
          type: 'value',
          name: 'Engagement Score',
          position: 'left',
          axisLabel: { formatter: '{value}' },
          max: 100
        },
        {
          type: 'value',
          name: 'Avg Duration (min)',
          position: 'right',
          axisLabel: { formatter: '{value}m' }
        }
      ],
      series: [
        {
          name: 'Engagement Score',
          type: 'bar',
          data: researchData.contentEngagement.map(d => d.engagementScore),
          itemStyle: { color: '#5470c6' }
        },
        {
          name: 'Avg Duration',
          type: 'line',
          yAxisIndex: 1,
          data: researchData.contentEngagement.map(d => d.avgDuration / 60),
          itemStyle: { color: '#91cc75' },
          lineStyle: { width: 3 }
        },
        {
          name: 'Return Rate',
          type: 'line',
          data: researchData.contentEngagement.map(d => d.returnRate * 100),
          itemStyle: { color: '#fac858' },
          lineStyle: { width: 3 }
        }
      ]
    };
  }

  async function getTransitionFlowOption() {
    // Get transition flow data from database service
    let flowData;
    try {
      const flowResult = await androidResearchDb.getTransitionFlow();
      flowData = flowResult.data;
      if (flowResult.isDemo) isDemo = true;
    } catch (error) {
      console.error('Error loading transition flow data:', error);
      errorMessage = 'Failed to load transition flow data. Using fallback data.';
      // Fallback data
      flowData = [
        { source: 'Launcher', target: 'YouTube', value: 45 },
        { source: 'Launcher', target: 'Chrome', value: 38 },
        { source: 'Launcher', target: 'Instagram', value: 32 },
        { source: 'Launcher', target: 'WhatsApp', value: 28 },
        { source: 'Launcher', target: 'Gmail', value: 22 },
        { source: 'YouTube', target: 'Chrome', value: 25 },
        { source: 'Chrome', target: 'Gmail', value: 20 },
        { source: 'Chrome', target: 'WhatsApp', value: 15 },
        { source: 'Instagram', target: 'WhatsApp', value: 22 },
        { source: 'WhatsApp', target: 'Gmail', value: 16 }
      ];
    }

    // All nodes in the flow
    const allNodes = ['Launcher', 'YouTube', 'Chrome', 'Instagram', 'WhatsApp', 'Gmail'];

    console.log('Sankey flowData (acyclic):', flowData.length, flowData);

    return {
      title: {
        text: 'App Transition Flow (Sankey Diagram)',
        left: 'center',
        textStyle: { fontSize: 18, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: function(params: any) {
          if (params.dataType === 'edge') {
            return `${params.data.source} → ${params.data.target}<br/>Transitions: ${params.data.value}`;
          }
          return `${params.data.name}`;
        }
      },
      series: [{
        type: 'sankey',
        layout: 'none',
        emphasis: { focus: 'adjacency' },
        nodeAlign: 'justify',
        nodeGap: 12,
        nodeWidth: 20,
        data: allNodes.map(app => ({ name: app })),
        links: flowData,
        itemStyle: { 
          borderWidth: 1, 
          borderColor: '#aaa' 
        },
        lineStyle: { 
          color: 'gradient', 
          curveness: 0.5, 
          opacity: 0.6 
        },
        label: { 
          show: true,
          fontSize: 12, 
          fontWeight: 'bold',
          color: '#333'
        }
      }]
    };
  }

  function getHeatmapOption() {
    const hours = Array.from({length: 24}, (_, i) => i);
    const apps = ['YouTube', 'Chrome', 'Instagram', 'WhatsApp', 'Gmail'];
    const data: any[] = [];

    apps.forEach((app, appIndex) => {
      hours.forEach(hour => {
        const usage = researchData.temporalUsage[hour]?.apps.find((a: any) => a.app === app)?.usage || 0;
        data.push([hour, appIndex, Math.round(usage)]);
      });
    });

    return {
      title: {
        text: 'Usage Intensity Heatmap (App × Hour)',
        left: 'center',
        textStyle: { fontSize: 18, fontWeight: 'bold' }
      },
      tooltip: {
        position: 'top',
        formatter: function(params: any) {
          return `${apps[params.data[1]]} at ${params.data[0]}:00<br/>Usage: ${params.data[2]} minutes`;
        }
      },
      xAxis: {
        type: 'category',
        data: hours.map(h => `${h}:00`),
        splitArea: { show: true }
      },
      yAxis: {
        type: 'category',
        data: apps,
        splitArea: { show: true }
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '5%',
        inRange: {
          color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
        }
      },
      series: [{
        type: 'heatmap',
        data: data,
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
        }
      }]
    };
  }

  async function performBehavioralAnalysis() {
    try {
      // Load behavioral metrics and insights from database service
      const metricsResult = await androidResearchDb.getBehavioralMetrics();
      const phenotypeResult = await androidResearchDb.getDigitalPhenotype();
      const findingsResult = await androidResearchDb.getResearchFindings();
      behavioralMetrics = metricsResult.data;
      digitalPhenotype = phenotypeResult.data;
      keyFindings = findingsResult.data;
      if (metricsResult.isDemo || phenotypeResult.isDemo || findingsResult.isDemo) {
        isDemo = true;
      }
      
      console.log('Behavioral analysis completed using database service');
    } catch (error) {
      console.error('Error performing behavioral analysis:', error);
      errorMessage = 'Failed to perform behavioral analysis. Using local calculations.';
      // Fallback to local calculation if database fails
      performLocalBehavioralAnalysis();
    }
  }

  function performLocalBehavioralAnalysis() {
    // Calculate key behavioral metrics locally as fallback
    const totalUsage = researchData.temporalUsage.reduce((sum, h) => sum + h.totalUsage, 0);
    const peakHour = researchData.temporalUsage.reduce((max, h) => h.totalUsage > max.totalUsage ? h : max);
    const avgSessionLength = researchData.attentionSpans.reduce((sum, app) => {
      return sum + app.sessions.reduce((s: any, session: any) => s + session.duration, 0) / app.sessions.length;
    }, 0) / researchData.attentionSpans.length;

    behavioralMetrics = {
      totalDailyUsage: Math.round(totalUsage),
      peakUsageHour: peakHour.hour,
      avgSessionLength: Math.round(avgSessionLength),
      appSwitchingRate: researchData.appTransitions.reduce((sum, t) => sum + t.value, 0) / 24,
      digitalWellbeingScore: Math.max(0, 100 - (totalUsage / 10)) // Inverse relationship
    };

    // Generate key research findings
    keyFindings = [
      {
        title: "Peak Digital Activity Window",
        finding: `Highest usage occurs at ${peakHour.hour}:00 (${Math.round(peakHour.totalUsage)} minutes)`,
        significance: "Indicates primary attention allocation period",
        implication: "Optimal time for important notifications or interventions"
      },
      {
        title: "Attention Fragmentation Pattern", 
        finding: `Average session length: ${Math.round(avgSessionLength)} seconds`,
        significance: avgSessionLength < 120 ? "High fragmentation detected" : "Moderate attention spans",
        implication: "May indicate multitasking behavior or attention difficulties"
      },
      {
        title: "App Ecosystem Centrality",
        finding: "YouTube and Chrome serve as primary transition hubs",
        significance: "These apps act as 'gateway' applications in user behavior",
        implication: "High influence potential for behavioral interventions"
      },
      {
        title: "Content Engagement Depth",
        finding: `Video content shows highest engagement (${researchData.contentEngagement[1]?.engagementScore || 92}/100)`,
        significance: "Visual media captures sustained attention most effectively",
        implication: "Video-based interfaces may improve user retention"
      }
    ];

    // Digital phenotyping analysis
    digitalPhenotype = {
      behaviorType: totalUsage > 300 ? "Heavy User" : totalUsage > 150 ? "Moderate User" : "Light User",
      attentionProfile: avgSessionLength > 180 ? "Sustained" : avgSessionLength > 90 ? "Moderate" : "Fragmented",
      usagePattern: peakHour.hour > 18 ? "Evening-Peak" : peakHour.hour > 12 ? "Afternoon-Peak" : "Morning-Peak",
      multitaskingIndex: behavioralMetrics.appSwitchingRate > 15 ? "High" : behavioralMetrics.appSwitchingRate > 8 ? "Moderate" : "Low"
    };

    // Analysis complete
  }

  function switchAnalysis(analysis: string) {
    activeAnalysis = analysis;
    // Reinitialize charts after tab switch
    setTimeout(() => {
      initializeCharts();
      // Also trigger resize for existing charts
      temporalChartInstance?.resize();
      appNetworkChartInstance?.resize();
      attentionChartInstance?.resize();
      engagementChartInstance?.resize();
      transitionChartInstance?.resize();
      heatmapChartInstance?.resize();
    }, 100);
  }

  function exportResearchReport() {
    const report = {
      metadata: {
        exportDate: new Date().toISOString(),
        userId: selectedUser,
        timeRange: selectedTimeRange,
        analysisType: "Deep Behavioral Research"
      },
      behavioralMetrics,
      digitalPhenotype,
      keyFindings,
      rawData: researchData
    };
    
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `android_research_report_${selectedUser}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>Android Research Analytics - Deep Behavioral Analysis</title>
  <meta name="description" content="Advanced research dashboard for Android mobile behavior analysis using Princeton SMART data" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

    {#if isDemo && !loading}
      <div class="mb-6 bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center">
        <svg class="w-5 h-5 text-amber-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <span class="font-semibold text-amber-800">Demo Data</span>
          <span class="text-amber-700 text-sm ml-2">No real Android device tables are available. The data shown below is derived from social analytics or generated for demonstration purposes.</span>
        </div>
      </div>
    {/if}
  <!-- Research Header -->
  <div class="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/20 opacity-60"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-600 rounded-xl shadow-lg flex items-center justify-center mr-4 border border-white/20 backdrop-blur-sm">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-white mb-1 tracking-tight">Android Research Analytics</h1>
            <p class="text-slate-300 text-sm font-medium">Deep Behavioral Analysis • Digital Phenotyping • Attention Research</p>
            <div class="flex items-center mt-2 space-x-4">
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
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <!-- Navigation Actions -->
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
            class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors shadow-sm">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Export Report
          </button>
        </div>
        
        <!-- Filters -->
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium text-gray-700 whitespace-nowrap">User:</label>
            <div class="relative">
              <select bind:value={selectedUser} class="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none pr-8 min-w-[140px]">
                <option value="7324">User 7324</option>
                <option value="all">All Users</option>
              </select>
              <svg class="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium text-gray-700 whitespace-nowrap">Period:</label>
            <div class="relative">
              <select bind:value={selectedTimeRange} class="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none pr-8 min-w-[140px]">
                <option value="24h">24 Hours</option>
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
              </select>
              <svg class="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      <span class="ml-4 text-lg text-gray-600">Loading advanced behavioral analysis from database...</span>
    </div>
  {:else}
    <!-- Research Findings Summary -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-amber-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <p class="text-sm font-medium text-amber-800">Demo Mode</p>
            <p class="text-xs text-amber-700">Android research data is not connected yet. Showing sample visualizations of the interface capabilities.</p>
          </div>
        </div>
      </div>

      <!-- Behavioral Metrics Overview -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div class="bg-white rounded-xl shadow-sm p-6 text-center">
          <div class="text-3xl font-bold text-indigo-600 mb-1">{behavioralMetrics.totalDailyUsage}m</div>
          <div class="text-sm text-gray-600">Daily Usage</div>
          <div class="text-xs text-gray-500 mt-1">{digitalPhenotype.behaviorType}</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6 text-center">
          <div class="text-3xl font-bold text-purple-600 mb-1">{behavioralMetrics.peakUsageHour}:00</div>
          <div class="text-sm text-gray-600">Peak Activity</div>
          <div class="text-xs text-gray-500 mt-1">{digitalPhenotype.usagePattern}</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6 text-center">
          <div class="text-3xl font-bold text-pink-600 mb-1">{behavioralMetrics.avgSessionLength}s</div>
          <div class="text-sm text-gray-600">Avg Session</div>
          <div class="text-xs text-gray-500 mt-1">{digitalPhenotype.attentionProfile}</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6 text-center">
          <div class="text-3xl font-bold text-emerald-600 mb-1">{Math.round(behavioralMetrics.appSwitchingRate)}</div>
          <div class="text-sm text-gray-600">Switches/Hour</div>
          <div class="text-xs text-gray-500 mt-1">{digitalPhenotype.multitaskingIndex} Multitasking</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6 text-center">
          <div class="text-3xl font-bold text-amber-600 mb-1">{Math.round(behavioralMetrics.digitalWellbeingScore)}</div>
          <div class="text-sm text-gray-600">Wellbeing Score</div>
          <div class="text-xs text-gray-500 mt-1">0-100 scale</div>
        </div>
      </div>

      <!-- Analysis Navigation -->
      <div class="bg-white rounded-xl shadow-sm mb-8">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8 px-6">
            <button 
              class="py-4 px-1 border-b-2 font-medium text-sm {activeAnalysis === 'temporal-patterns' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
              on:click={() => switchAnalysis('temporal-patterns')}>
              Temporal Patterns
            </button>
            <button 
              class="py-4 px-1 border-b-2 font-medium text-sm {activeAnalysis === 'network-analysis' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
              on:click={() => switchAnalysis('network-analysis')}>
              Network Analysis
            </button>
            <button 
              class="py-4 px-1 border-b-2 font-medium text-sm {activeAnalysis === 'attention-research' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
              on:click={() => switchAnalysis('attention-research')}>
              Attention Research
            </button>
            <button 
              class="py-4 px-1 border-b-2 font-medium text-sm {activeAnalysis === 'engagement-analysis' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
              on:click={() => switchAnalysis('engagement-analysis')}>
              Engagement Analysis
            </button>
            <button 
              class="py-4 px-1 border-b-2 font-medium text-sm {activeAnalysis === 'findings' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
              on:click={() => switchAnalysis('findings')}>
              Research Findings
            </button>
          </nav>
        </div>

        <!-- Analysis Content -->
        <div class="p-6">
          
          {#if activeAnalysis === 'temporal-patterns'}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div class="bg-gray-50 rounded-xl p-4">
                <div bind:this={temporalChart} class="w-full h-96"></div>
              </div>
              <div class="bg-gray-50 rounded-xl p-4">
                <div bind:this={heatmapChart} class="w-full h-96"></div>
              </div>
            </div>
            <div class="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 class="font-semibold text-blue-900 mb-2">Temporal Analysis Insights</h4>
              <p class="text-blue-800 text-sm">The temporal usage patterns reveal circadian rhythms in digital behavior. Peak usage occurs during {digitalPhenotype.usagePattern.toLowerCase()} hours, suggesting alignment with natural attention cycles. The heatmap visualization shows app-specific usage patterns that can inform optimal intervention timing.</p>
            </div>
          {/if}

          {#if activeAnalysis === 'network-analysis'}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div class="bg-gray-50 rounded-xl p-4">
                <div bind:this={appNetworkChart} class="w-full h-96"></div>
              </div>
              <div class="bg-gray-50 rounded-xl p-4">
                <div bind:this={transitionChart} class="w-full h-96"></div>
              </div>
            </div>
            <div class="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
              <h4 class="font-semibold text-purple-900 mb-2">Network Analysis Insights</h4>
              <p class="text-purple-800 text-sm">The app transition network reveals ecosystem structure in digital behavior. Hub applications (high centrality) serve as gateways to other apps, while the Sankey diagram shows transition flow patterns. This analysis identifies key intervention points for behavioral modification.</p>
            </div>
          {/if}

          {#if activeAnalysis === 'attention-research'}
            <div class="bg-gray-50 rounded-xl p-4">
              <div bind:this={attentionChart} class="w-full h-96"></div>
            </div>
            <div class="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <h4 class="font-semibold text-emerald-900 mb-2">Attention Research Insights</h4>
              <p class="text-emerald-800 text-sm">The attention span analysis compares expected vs. actual duration for each application. Points above the diagonal indicate apps that capture attention longer than expected, while points below suggest apps that lose attention quickly. This {digitalPhenotype.attentionProfile.toLowerCase()} attention profile indicates specific intervention strategies.</p>
            </div>
          {/if}

          {#if activeAnalysis === 'engagement-analysis'}
            <div class="bg-gray-50 rounded-xl p-4">
              <div bind:this={engagementChart} class="w-full h-96"></div>
            </div>
            <div class="mt-6 bg-pink-50 border border-pink-200 rounded-xl p-4">
              <h4 class="font-semibold text-pink-900 mb-2">Content Engagement Insights</h4>
              <p class="text-pink-800 text-sm">Content engagement analysis reveals which types of content capture sustained attention. Video content shows the highest engagement scores, while navigation tasks show lower engagement but higher efficiency. The return rate metric indicates content stickiness and habit formation potential.</p>
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
              {/each}

              <!-- Digital Phenotype Summary -->
              <div class="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
                <h4 class="text-lg font-semibold text-purple-900 mb-4">Digital Behavioral Phenotype</h4>
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
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.project-switcher) {
    position: relative;
    z-index: 50;
  }
</style>