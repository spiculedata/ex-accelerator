<script lang="ts">
  import { goto } from '$app/navigation';
  import PostDrilldown from '$lib/components/ui/PostDrilldown.svelte';
  import { filtersFromParams, type PostFilters } from '$lib/services/postsApi';
  import FilterBar from '$lib/components/ui/FilterBar.svelte';
  import { page } from '$app/stores';
  import { currentProject } from '$lib/stores/projectStore';
  import { topicModelingDb } from '$lib/services/topicModelingDb';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import WorkspaceBanner from '$lib/components/ui/WorkspaceBanner.svelte';
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { getCategoryColor } from '$lib/utils/colorUtils';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';
  import { ErrorAlert } from '$lib/components/ui';

  $: workspaceId = $page.url.searchParams.get('workspace');

  let currentFilterParams: Record<string, string> = {};

  function handleFilterChange(event: CustomEvent) {
    const detail = event.detail || {};
    currentFilterParams = {};
    if (detail.workspaceId) currentFilterParams.workspace_id = detail.workspaceId;
    currentFilterParams.platforms = (detail.platforms || []).join(',');
    if (detail.dateStart) currentFilterParams.date_start = detail.dateStart;
    if (detail.dateEnd) currentFilterParams.date_end = detail.dateEnd;
  }

  // Type definitions
  interface Topic {
    id: string;
    name: string;
    category: string;
    categoryColor?: string;
    size: number;
    weight: number;
    keywords: string[];
  }

  interface ChartData {
    [key: string]: any;
  }
  
  // Loading state
  let loading = true;
  let errorMessage = '';

  onMount(async () => {
    // Load topic modeling data from database
    await loadTopicModelingData();
  });

  // Topic modeling data - loaded from database
  let topicsData: Topic[] = [];
  let topicCategories: any[] = [];
  let topicRelationships: any[] = [];
  let topicStats: any = {};
  
  // Load topic modeling data from database service
  async function loadTopicModelingData() {
    try {
      // Load all topic data from database service
      const filters = {
        category: selectedCategory,
        search: searchQuery,
        minSize: minTopicSize
      };
      
      topicsData = (await topicModelingDb.getTopics(filters as any, workspaceId || undefined)) as Topic[];
      topicCategories = await topicModelingDb.getTopicCategories(workspaceId || undefined);
      topicRelationships = await topicModelingDb.getTopicRelationships(0.05, workspaceId || undefined);
      topicStats = await topicModelingDb.getTopicStats(workspaceId || undefined);
      
      console.log('Topic modeling data loaded successfully from database');
      loading = false;
      
      // The chart containers only exist once the loading state has been replaced, so wait for the page to render
      try {
        await tick();
        await waitForEcharts();
        initializeCharts();
      } catch (e) {
        console.error('Charts unavailable:', e);
      }
    } catch (error) {
      console.error('Error loading topic modeling data:', error);
      errorMessage = 'Failed to load topic modeling data. Please try again.';
      // No fallback - topic modeling requires database connection
      loading = false;
    }
  }
  

  let selectedCategory = 'all';
  let selectedTopic: Topic | null = null;
  let searchQuery = '';
  let minTopicSize = 1;
  let sliderValue = 0; // 0-100 linear slider mapped to log scale
  // The treemap reads at a glance; the network is for exploring how topics relate
  let showNetworkDiagram = false;
  let networkChart: any = null;
  let treemapChart: any = null;

  // Debounce timer for API-driven filters
  let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Reactive: re-fetch from API only when category or search change (debounced)
  $: if ((selectedCategory !== 'all' || searchQuery !== '') && !loading && topicsData.length > 0) {
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => loadFilteredTopics(), 300);
  }

  // Load filtered topics from database (only for category/search — minSize is client-side)
  async function loadFilteredTopics() {
    try {
      const filters = {
        category: selectedCategory,
        search: searchQuery
      };
      topicsData = (await topicModelingDb.getTopics(filters as any, workspaceId || undefined)) as Topic[];
    } catch (error) {
      console.error('Error loading filtered topics:', error);
      errorMessage = 'Failed to load filtered topics. Please try again.';
    }
  }

  // Log-scale mapping: slider 0-100 → minTopicSize 1 to maxSize
  $: maxTopicSize = Math.max(100, topicsData.reduce((max, t) => Math.max(max, t.size), 100));
  $: minTopicSize = sliderValue === 0 ? 1 : Math.round(Math.pow(10, (sliderValue / 100) * Math.log10(maxTopicSize)));

  // Client-side filtering for minTopicSize (no API call needed)
  $: filteredTopics = topicsData.filter(t => t.size >= minTopicSize);

  // Update charts when filteredTopics change
  $: if (browser && filteredTopics && !loading) {
    if (networkChart) updateNetworkChart();
    if (treemapChart) setTimeout(async () => await updateTreemapChart(), 50);
  }

  // Get categories from database data
  $: categories = ['all', ...topicCategories.map(cat => cat.category)];

  function initializeCharts() {
    initNetworkChart();
    initTreemapChart();
  }

  function initNetworkChart() {
    if (!browser) return;
    const networkContainer = document.getElementById('network-chart');
    if (!networkContainer) return;

    networkChart = initChart(networkContainer);
    if (!networkChart) return;
    updateNetworkChart();
  }

  async function initTreemapChart() {
    if (!browser) return;
    const treemapContainer = document.getElementById('treemap-chart');
    if (!treemapContainer) return;

    // Make sure container is visible before initializing
    if (treemapContainer.classList.contains('hidden')) {
      treemapContainer.classList.remove('hidden');
    }

    treemapChart = initChart(treemapContainer);
    if (!treemapChart) return;
    await updateTreemapChart();
    
    // Restore visibility state
    if (showNetworkDiagram) {
      treemapContainer.classList.add('hidden');
    }
  }

  // Okabe-Ito order, colour-blind safe; categories beyond the eighth reuse colours and are told apart by the legend and tooltip
  const NETWORK_COLOURS = ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#f0e442', '#0f1926'];
  const LABEL_LIMIT = 14;
  // A category has the same colour in the network, the treemap and the legend
  // The order is the sorted names of every category, not just those left after a filter, so a category keeps its
  // colour when the filters change and cannot differ between the two charts
  $: categoryOrder = [...new Set([...topicCategories.map(cat => cat.category), ...topicsData.map(topic => topic.category)].filter(Boolean))].sort();
  const colourOfCategory = (name: string) => NETWORK_COLOURS[Math.max(0, categoryOrder.indexOf(name)) % NETWORK_COLOURS.length];
  const colourByCategory = (nodes: any[]) =>
    nodes.map(group => ({ ...group, children: group.children?.map((topic: any) => ({ ...topic, itemStyle: { ...topic.itemStyle, color: colourOfCategory(group.name) } })) }));
  const truncate = (name: string) => (name.length > 22 ? `${name.slice(0, 21)}…` : name);

  function updateNetworkChart() {
    if (!browser || !networkChart) return;

    const categoryNames = categoryOrder;
    const largest = Math.max(1, ...filteredTopics.map(topic => topic.size));
    // Only the biggest topics are labelled; the rest are named on hover, so labels do not pile up
    const labelled = new Set([...filteredTopics].sort((a, b) => b.size - a.size).slice(0, LABEL_LIMIT).map(topic => topic.id));

    const nodes = filteredTopics.map(topic => ({
      id: topic.id,
      name: truncate(topic.name),
      fullName: topic.name,
      value: topic.size,
      category: Math.max(0, categoryNames.indexOf(topic.category)),
      categoryName: topic.category,
      symbolSize: 14 + 42 * Math.sqrt(topic.size / largest),
      label: { show: labelled.has(topic.id) }
    }));

    const links = topicRelationships.filter(rel =>
      filteredTopics.some(t => t.id === rel.topic1_id) &&
      filteredTopics.some(t => t.id === rel.topic2_id)
    ).map(rel => ({
      source: rel.topic1_id,
      target: rel.topic2_id,
      value: rel.similarity_score,
      lineStyle: { width: 1 + 5 * Math.min(1, rel.similarity_score) }
    }));

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: function(params: any) {
          if (params.dataType === 'node') {
            return `<strong>${params.data.fullName}</strong><br/>Posts: ${params.data.value.toLocaleString()}<br/>Category: ${params.data.categoryName}`;
          } else if (params.dataType === 'edge') {
            return `Connection Strength: ${(params.data.value * 100).toFixed(1)}%`;
          }
        }
      },
      legend: {
        type: 'scroll',
        orient: 'horizontal',
        bottom: 0,
        data: categoryNames
      },
      color: NETWORK_COLOURS,
      series: [{
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: links,
        categories: categoryNames.map(cat => ({ name: cat })),
        roam: true,
        top: 10,
        bottom: 40,
        itemStyle: { borderColor: '#fff', borderWidth: 1.5 },
        label: { show: false, position: 'right', formatter: '{b}', fontSize: 11, color: '#0f1926' },
        lineStyle: { color: '#98a2ae', curveness: 0.1, opacity: 0.7 },
        emphasis: { focus: 'adjacency', label: { show: true } },
        force: { repulsion: 260, gravity: 0.08, edgeLength: [60, 160], layoutAnimation: false }
      }]
    };

    networkChart.setOption(option);
  }

  async function updateTreemapChart() {
    if (!browser || !treemapChart) {
      console.error('Treemap chart not initialized');
      return;
    }
    
    if (filteredTopics.length === 0) {
      console.log('No filtered topics available');
      // Show empty state
      treemapChart.setOption({
        title: {
          text: 'No Topics to Display',
          left: 'center',
          top: 'center',
          textStyle: {
            fontSize: 16,
            color: '#999'
          }
        }
      });
      return;
    }

    try {
      // Get treemap data from database service
      const filters = {
        category: selectedCategory,
        search: searchQuery,
        minSize: minTopicSize
      };
      
      const treemapData = colourByCategory(await topicModelingDb.getTreemapData(filters as any, workspaceId || undefined));

      const option = {
        title: {
          text: 'Topic Size Distribution',
          left: 'center',
          top: 15,
          textStyle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#333'
          }
        },
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: '#333',
          borderWidth: 1,
          textStyle: {
            color: '#fff',
            fontSize: 12
          },
          formatter: function(params: any) {
            if (params.data.children) {
              // Category level
              const totalPosts = params.data.children.reduce((sum: number, child: any) => sum + child.value, 0);
              return `<strong style="color: #fff;">${params.name}</strong><br/>
                      <span style="color: #ccc;">Total Posts: ${totalPosts.toLocaleString()}</span><br/>
                      <span style="color: #ccc;">Topics: ${params.data.children.length}</span>`;
            } else {
              // Topic level
              return `<strong style="color: #fff;">${params.name}</strong><br/>
                      <span style="color: #ccc;">Posts: ${params.value ? params.value.toLocaleString() : 'N/A'}</span>`;
            }
          }
        },
        backgroundColor: '#fff',
        series: [{
          type: 'treemap',
          data: treemapData,
          top: 60,
          left: 15,
          right: 15,
          bottom: 15,
          roam: false,
          nodeClick: 'zoomToNode',
          breadcrumb: {
            show: false
          },
          label: {
            show: true,
            formatter: function(params: any) {
              if (params.data.children) {
                // Category label
                return params.name;
              } else {
                // Topic label - truncate if too long
                return params.name.length > 20 ? params.name.substring(0, 20) + '...' : params.name;
              }
            },
            fontSize: function(params: any) {
              return params.data.children ? 14 : 10;
            },
            fontWeight: 'bold',
            color: '#fff'
          },
          upperLabel: {
            show: true,
            height: 30,
            formatter: '{b}',
            fontSize: 14,
            fontWeight: 'bold',
            color: '#333'
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2,
            gapWidth: 2
          },
          emphasis: {
            itemStyle: {
              borderColor: '#333',
              borderWidth: 3,
              shadowBlur: 0,
              shadowColor: 'transparent'
            },
            label: {
              fontSize: function(params: any) {
                return params.data.children ? 16 : 12;
              },
              fontWeight: 'bold',
              color: '#fff'
            },
            upperLabel: {
              fontSize: 16,
              fontWeight: 'bold',
              color: '#fff'
            }
          },
          levels: [
            {
              // Category level (first level)
              itemStyle: {
                borderWidth: 2,
                gapWidth: 4,
                borderColor: '#fff'
              },
              upperLabel: {
                show: true,
                height: 30,
                fontSize: 14,
                fontWeight: 'bold',
                color: '#333'
              },
              label: {
                show: false
              },
              emphasis: {
                itemStyle: {
                  borderColor: '#333',
                  borderWidth: 3
                },
                upperLabel: {
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 'bold'
                }
              }
            },
            {
              // Topic level (second level)
              itemStyle: {
                borderWidth: 1,
                gapWidth: 2,
                borderColor: '#fff'
              },
              label: {
                show: true,
                fontSize: 11,
                fontWeight: 'bold',
                color: '#fff',
                textBorderColor: '#000',
                textBorderWidth: 1
              },
              emphasis: {
                itemStyle: {
                  borderColor: '#333',
                  borderWidth: 2
                },
                label: {
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 'bold',
                  textBorderColor: '#000',
                  textBorderWidth: 1
                }
              }
            }
          ]
        }]
      };

      treemapChart.setOption(option, true);
      
    } catch (error) {
      console.error('Error updating treemap chart:', error);
    }
  }


  // (chart updates handled in the filteredTopics reactive block above)

  // Watch for visualization toggle changes
  $: if (browser && showNetworkDiagram !== undefined) {
    setTimeout(async () => {
      if (showNetworkDiagram) {
        if (!networkChart) {
          initNetworkChart();
        } else {
          networkChart.resize();
          updateNetworkChart();
        }
      } else {
        if (!treemapChart) {
          await initTreemapChart();
        } else {
          treemapChart.resize();
          await updateTreemapChart();
        }
      }
    }, 100);
  }

  async function exportTopicData() {
    try {
      const filters = {
        category: selectedCategory,
        search: searchQuery,
        minSize: minTopicSize
      };
      
      const exportData = await topicModelingDb.exportTopicData(filters as any, workspaceId || undefined);

      // Create CSV from the exported data
      const csvData = (exportData as any).topics.map((topic: any) =>
        `"${topic.name}",${topic.category},${topic.size},${topic.weight},"${topic.keywords.join(';')}"`
      ).join('\n');
      
      const header = 'Topic Name,Category,Post Count,Weight,Keywords\n';
      const csv = header + csvData;
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'topic_modeling_analysis.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting topic data:', error);
      alert('Export failed: Database connection required');
    }
  }

  // The topic whose posts are open in the side panel
  let drilldown: { title: string; filters: PostFilters } | null = null;

  function selectTopic(topic: Topic) {
    selectedTopic = topic;
    drilldown = { title: `Topic: ${topic.name}`, filters: { topic: String(topic.id), ...filtersFromParams({ ...(workspaceId ? { workspace_id: workspaceId } : {}), ...currentFilterParams }) } };
  }
</script>

<svelte:head>
  <title>Topic Modeling - Text Analytics - Social Explorer</title>
  <meta name="description" content="Advanced topic modeling and analysis with network diagrams and treemap visualizations" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <PageHeader
    title="Topic Modeling"
    subtitle="Discover themes and relationships in your social media data with advanced topic analysis"
    accentColor="indigo"
    backHref="/text-analytics">
    <svelte:fragment slot="icon">
      <div class="w-16 h-16 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
        </svg>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="actions">
      <button
        on:click={exportTopicData}
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
        Export Analysis
      </button>
    </svelte:fragment>
  </PageHeader>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <WorkspaceBanner workspaceId={workspaceId || ''} workspaceName="" />


    <!-- Data Source Filter -->
    <div class="mb-6">
      <FilterBar workspaceId={workspaceId} datasetTypes={["social_media"]} on:change={handleFilterChange} />
    </div>
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading topic modeling data from database...</span>
      </div>
    {:else}
    {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

    <!-- Overview Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-indigo-600 mb-1">{topicStats.totalTopics || filteredTopics.length}</div>
        <div class="text-sm text-gray-600">Active Topics</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-indigo-600 mb-1">{topicStats.totalCategories || (categories.length - 1)}</div>
        <div class="text-sm text-gray-600">Categories</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-indigo-600 mb-1">{topicStats.totalDocuments || filteredTopics.reduce((sum, t) => sum + t.size, 0).toLocaleString()}</div>
        <div class="text-sm text-gray-600">Total Posts</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-indigo-600 mb-1">{topicRelationships.length}</div>
        <div class="text-sm text-gray-600">Topic Connections</div>
      </div>
    </div>

    <!-- Filters & Controls -->
    <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Analysis Filters</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Search Topics</label>
          <input 
            bind:value={searchQuery}
            type="text" 
            placeholder="Search topics or keywords..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select bind:value={selectedCategory} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            {#each categories as category}
              <option value={category}>{category === 'all' ? 'All Categories' : category}</option>
            {/each}
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Min mentions: {minTopicSize >= 1000 ? (minTopicSize / 1000).toFixed(1) + 'K' : minTopicSize}
            <span class="text-gray-400 font-normal">({filteredTopics.length} of {topicsData.length} topics)</span>
          </label>
          <input
            type="range"
            bind:value={sliderValue}
            min="0"
            max="100"
            step="1"
            class="w-full h-2 bg-gray-200 rounded-xl appearance-none cursor-pointer">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Visualization</label>
          <div class="flex space-x-4">
            <label class="flex items-center">
              <input 
                type="radio" 
                bind:group={showNetworkDiagram}
                value={true}
                class="text-indigo-600 focus:ring-indigo-500">
              <span class="ml-2 text-sm text-gray-700">Network</span>
            </label>
            <label class="flex items-center">
              <input 
                type="radio" 
                bind:group={showNetworkDiagram}
                value={false}
                class="text-indigo-600 focus:ring-indigo-500">
              <span class="ml-2 text-sm text-gray-700">Treemap</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Visualization Area -->
    <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">
          {showNetworkDiagram ? 'Topic Relationship Network' : 'Topic Size Distribution'}
        </h2>
        <div class="text-sm text-gray-500">
          {filteredTopics.length} topics shown
        </div>
      </div>
      
      <div class="h-[32rem]">
        <div id="network-chart" class="w-full h-full" class:hidden={!showNetworkDiagram}></div>
        <div id="treemap-chart" class="w-full h-full" class:hidden={showNetworkDiagram}></div>
      </div>
    </div>

    <!-- Topics Table -->
    <div class="bg-white rounded-xl shadow-sm p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Topic Details</h2>
        <span class="text-sm text-gray-500">{filteredTopics.length} topics</span>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posts</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keywords</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredTopics.slice(0, 50) as topic}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="w-3 h-3 rounded-full mr-3" style="background-color: {getCategoryColor(topic.category)}"></div>
                    <div class="text-sm font-medium text-gray-900">{topic.name}</div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style="background-color: {getCategoryColor(topic.category)}20; color: {getCategoryColor(topic.category)}">
                    {topic.category}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {topic.size.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                      <div class="bg-blue-600 h-2 rounded-full" style="width: {topic.weight * 100}%"></div>
                    </div>
                    <span class="text-sm text-gray-500">{(topic.weight * 100).toFixed(1)}%</span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex flex-wrap gap-1">
                    {#each (topic.keywords || []).slice(0, 3) as keyword}
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {keyword}
                      </span>
                    {/each}
                    {#if (topic.keywords || []).length > 3}
                      <span class="text-xs text-gray-500">+{topic.keywords.length - 3} more</span>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    on:click={() => selectTopic(topic)}
                    class="text-primary-700 hover:text-primary-900 font-medium">
                    View posts
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      
      {#if filteredTopics.length > 50}
        <div class="mt-4 text-center">
          <p class="text-sm text-gray-500">Showing first 50 topics. Use filters to narrow results.</p>
        </div>
      {/if}
    </div>
    
    {/if}
  </div>
</div>

<PostDrilldown open={drilldown !== null} title={drilldown?.title ?? ''} filters={drilldown?.filters ?? {}} onclose={() => (drilldown = null)} />
