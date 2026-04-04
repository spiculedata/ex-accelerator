<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import { topicModelingDb } from '$lib/services/topicModelingDb';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

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
  
  // Redirect to projects if no current project
  onMount(async () => {
    if (!$currentProject) {
      window.location.href = '/projects';
      return;
    }
    
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
      
      topicsData = (await topicModelingDb.getTopics(filters as any)) as Topic[];
      topicCategories = await topicModelingDb.getTopicCategories();
      topicRelationships = await topicModelingDb.getTopicRelationships(0.5);
      topicStats = await topicModelingDb.getTopicStats();
      
      console.log('Topic modeling data loaded successfully from database');
      loading = false;
      
      // Initialize charts after data is loaded
      if (typeof window !== 'undefined' && (window as any).echarts) {
        setTimeout(() => {
          initializeCharts();
        }, 100);
      }
    } catch (error) {
      console.error('Error loading topic modeling data:', error);
      // No fallback - topic modeling requires database connection
      loading = false;
    }
  }
  

  let selectedCategory = 'all';
  let selectedTopic: Topic | null = null;
  let searchQuery = '';
  let minTopicSize = 1;
  let showNetworkDiagram = true;
  let networkChart: any = null;
  let treemapChart: any = null;

  // Reactive statements for filter changes - only reload after initial load
  $: if ((selectedCategory !== 'all' || searchQuery !== '' || minTopicSize !== 1) && !loading && topicsData.length > 0) {
    loadFilteredTopics();
  }

  // Load filtered topics from database
  async function loadFilteredTopics() {
    try {
      const filters = {
        category: selectedCategory,
        search: searchQuery,
        minSize: minTopicSize
      };
      topicsData = (await topicModelingDb.getTopics(filters as any)) as Topic[];

      // Update charts with new data
      if (typeof window !== 'undefined' && (window as any).echarts) {
        setTimeout(async () => {
          updateNetworkChart();
          await updateTreemapChart();
        }, 100);
      }
    } catch (error) {
      console.error('Error loading filtered topics:', error);
    }
  }

  // Filtered topics (for display purposes, actual filtering happens in database)
  $: filteredTopics = topicsData;

  // Get categories from database data
  $: categories = ['all', ...topicCategories.map(cat => cat.name)];

  // Initialize charts after component mounts
  onMount(async () => {
    // ECharts is now loaded globally from app.html
    if (typeof window !== 'undefined') {
      // Wait for echarts to be available
      if (!(window as any).echarts) {
        setTimeout(initializeCharts, 100);
      } else {
        initializeCharts();
      }
    }
  });

  function initializeCharts() {
    if (typeof window !== 'undefined' && (window as any).echarts) {
      initNetworkChart();
      initTreemapChart();
    }
  }

  function initNetworkChart() {
    if (!browser) return;
    const networkContainer = document.getElementById('network-chart');
    if (!networkContainer) return;

    networkChart = (window as any).echarts.init(networkContainer);
    updateNetworkChart();
  }

  async function initTreemapChart() {
    if (!browser) return;
    const treemapContainer = document.getElementById('treemap-chart');
    if (!treemapContainer) {
      console.error('Treemap container not found');
      return;
    }

    // Make sure container is visible before initializing
    if (treemapContainer.classList.contains('hidden')) {
      treemapContainer.classList.remove('hidden');
    }

    console.log('Initializing treemap chart...');
    treemapChart = (window as any).echarts.init(treemapContainer);
    console.log('Treemap chart initialized:', treemapChart);
    await updateTreemapChart();
    
    // Restore visibility state
    if (showNetworkDiagram) {
      treemapContainer.classList.add('hidden');
    }
  }

  function updateNetworkChart() {
    if (!browser || !networkChart) return;

    const nodes = filteredTopics.map(topic => ({
      id: topic.id,
      name: topic.name,
      value: topic.size,
      category: topic.category,
      symbolSize: Math.sqrt(topic.size) / 10
    }));

    const links = topicRelationships.filter(rel => 
      filteredTopics.some(t => t.id === rel.source) && 
      filteredTopics.some(t => t.id === rel.target)
    ).map(rel => ({
      source: rel.source,
      target: rel.target,
      value: rel.strength
    }));

    const option = {
      title: {
        text: 'Topic Relationship Network',
        left: 'center',
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: function(params: any) {
          if (params.dataType === 'node') {
            return `<strong>${params.data.name}</strong><br/>Posts: ${params.data.value.toLocaleString()}<br/>Category: ${params.data.category}`;
          } else if (params.dataType === 'edge') {
            return `Connection Strength: ${(params.data.value * 100).toFixed(1)}%`;
          }
        }
      },
      legend: {
        orient: 'horizontal',
        bottom: 20,
        data: categories.filter(c => c !== 'all')
      },
      series: [{
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: links,
        categories: categories.filter(c => c !== 'all').map(cat => ({ name: cat })),
        roam: true,
        focusNodeAdjacency: true,
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1,
          shadowBlur: 3,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          fontSize: 10
        },
        lineStyle: {
          color: 'source',
          curveness: 0.3,
          opacity: 0.6
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 10
          }
        },
        force: {
          repulsion: 500,
          edgeLength: [50, 200]
        }
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
      
      const treemapData = await topicModelingDb.getTreemapData(filters as any);

      console.log('Treemap data:', treemapData);

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

      console.log('Setting treemap option:', option);
      treemapChart.setOption(option, true);
      console.log('Treemap chart updated successfully');
      
    } catch (error) {
      console.error('Error updating treemap chart:', error);
    }
  }

  function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'Technology': '#3b82f6',
      'Health': '#10b981',
      'Business': '#f59e0b',
      'Environment': '#059669',
      'Politics': '#dc2626',
      'Entertainment': '#8b5cf6',
      'Education': '#0891b2',
      'Sports': '#ea580c',
      'Lifestyle': '#ec4899',
      'Science': '#6366f1',
      'Culture': '#84cc16',
      'Religion': '#a855f7',
      'Legal': '#475569',
      'Psychology': '#06b6d4',
      'Agriculture': '#65a30d',
      'Energy': '#eab308',
      'Transportation': '#e11d48',
      'Manufacturing': '#64748b',
      'Social': '#14b8a6'
    };
    return colors[category] || '#6b7280';
  }

  // Update charts when filters change
  $: if (browser && filteredTopics) {
    if (networkChart) {
      updateNetworkChart();
    }
    if (treemapChart) {
      setTimeout(async () => await updateTreemapChart(), 50);
    }
  }

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
      
      const exportData = await topicModelingDb.exportTopicData(filters as any);

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

  function selectTopic(topic: Topic) {
    selectedTopic = topic;
  }
</script>

<svelte:head>
  <title>Topic Modeling - Text Analytics - Social Explorer</title>
  <meta name="description" content="Advanced topic modeling and analysis with network diagrams and treemap visualizations" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-indigo-900/10 to-slate-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <button 
            on:click={() => window.location.href='/text-analytics'}
            class="mr-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors backdrop-blur-sm">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div class="w-16 h-16 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Topic Modeling</h1>
            <p class="text-slate-300 text-lg font-medium">Discover themes and relationships in your social media data with advanced topic analysis</p>
            {#if $currentProject}
              <div class="flex items-center mt-3">
                <span class="text-sm text-slate-400">Project:</span>
                <span class="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                  {$currentProject.name}
                </span>
              </div>
            {/if}
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          <button 
            on:click={exportTopicData}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
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
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <span class="ml-4 text-lg text-gray-600">Loading topic modeling data from database...</span>
      </div>
    {:else}
    
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
          <label class="block text-sm font-medium text-gray-700 mb-2">Min Topic Size: {minTopicSize.toLocaleString()}</label>
          <input 
            type="range" 
            bind:value={minTopicSize}
            min="1" 
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
      
      <div class="h-96">
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
                    {#each topic.keywords.slice(0, 3) as keyword}
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {keyword}
                      </span>
                    {/each}
                    {#if topic.keywords.length > 3}
                      <span class="text-xs text-gray-500">+{topic.keywords.length - 3} more</span>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    on:click={() => selectTopic(topic)}
                    class="text-indigo-600 hover:text-indigo-900">
                    Analyze
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