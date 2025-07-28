<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  
  let activeTab = 'schedule';
  
  // Check URL parameters on mount
  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['schedule', 'crawler', 'upload', 'princeton-smart'].includes(tabParam)) {
      activeTab = tabParam;
    }
  });
  let crawlerConfigStep = 'basic'; // basic, platform, advanced, review
  
  // Crawler configuration state matching CLI flags
  let crawlerConfig = {
    // Basic settings
    name: '',
    crawlId: '',
    
    // Global flags
    logLevel: 'debug',
    concurrency: 1,
    timeout: 30,
    userAgent: 'Mozilla/5.0 Crawler',
    outputFormat: 'json',
    
    // Platform and URLs
    platform: 'telegram',
    urls: [] as string[],
    urlFileURL: '',
    
    // Date and time filters
    minPostDate: '',
    timeAgo: '1m',
    dateBetween: '',
    sampleSize: 0,
    
    // Limits and constraints
    maxComments: -1,
    maxDepth: -1,
    maxPosts: -1,
    maxPages: 108000,
    minUsers: 100,
    minChannelVideos: 10,
    
    // Platform-specific settings
    tdlibDatabaseURLs: [] as string[],
    tdlibVerbosity: 1,
    skipMediaDownload: false,
    youtubeApiKey: '',
    samplingMethod: 'channel'
  };
  
  // URL upload state
  let urlUploadFiles: FileList | null = null;
  
  // UI state for collapsible sections
  let showCrawlLimits = false;
  
  // Form validation
  function validateForm() {
    if (!crawlerConfig.name.trim()) return false;
    if (crawlerConfig.urls.length === 0 && !crawlerConfig.urlFileURL.trim()) return false;
    if (crawlerConfig.platform === 'telegram' && crawlerConfig.tdlibDatabaseURLs.length === 0) return false;
    return true;
  }
  
  // Schedule configuration
  let scheduleConfig = {
    frequency: 'daily',
    time: '09:00',
    timezone: 'UTC',
    enabled: false
  };
  
  // Mock data for crawl jobs
  let crawlJobs = [
    {
      id: '1',
      name: 'Twitter Sentiment Analysis',
      status: 'running',
      progress: 65,
      startTime: '2025-01-27T08:30:00Z',
      schedule: 'Daily at 9:00 AM UTC',
      itemsCollected: 2847,
      totalEstimated: 4500,
      logs: [
        '[2025-01-27 08:30:12] INFO: Starting Twitter crawl job "Twitter Sentiment Analysis"',
        '[2025-01-27 08:30:15] INFO: Initializing crawler with platform: twitter',
        '[2025-01-27 08:30:18] INFO: Loaded 15 target URLs for crawling',
        '[2025-01-27 08:31:22] INFO: Connected to Twitter API successfully',
        '[2025-01-27 08:31:45] INFO: Starting data collection from timeline endpoints',
        '[2025-01-27 08:32:10] DEBUG: Processing batch 1/15 - collected 245 posts',
        '[2025-01-27 08:33:15] DEBUG: Processing batch 2/15 - collected 198 posts',
        '[2025-01-27 08:34:22] DEBUG: Processing batch 3/15 - collected 312 posts',
        '[2025-01-27 08:35:18] INFO: Rate limit reached, waiting 60 seconds...',
        '[2025-01-27 08:36:25] DEBUG: Processing batch 4/15 - collected 289 posts',
        '[2025-01-27 08:37:45] DEBUG: Processing batch 5/15 - collected 267 posts',
        '[2025-01-27 08:38:52] DEBUG: Processing batch 6/15 - collected 198 posts',
        '[2025-01-27 08:39:58] DEBUG: Processing batch 7/15 - collected 234 posts',
        '[2025-01-27 08:41:12] DEBUG: Processing batch 8/15 - collected 176 posts',
        '[2025-01-27 08:42:28] DEBUG: Processing batch 9/15 - collected 245 posts',
        '[2025-01-27 08:43:35] INFO: Currently processing batch 10/15 - 683 posts remaining...'
      ]
    },
    {
      id: '2', 
      name: 'Reddit Tech Discussion',
      status: 'completed',
      progress: 100,
      startTime: '2025-01-27T06:00:00Z',
      endTime: '2025-01-27T07:45:00Z',
      schedule: 'Every 6 hours',
      itemsCollected: 1253,
      totalEstimated: 1253,
      logs: [
        '[2025-01-27 06:00:05] INFO: Starting Reddit crawl job "Reddit Tech Discussion"',
        '[2025-01-27 06:00:08] INFO: Initializing crawler with platform: reddit',
        '[2025-01-27 06:00:12] INFO: Loaded 8 subreddits for crawling',
        '[2025-01-27 06:00:45] INFO: Connected to Reddit API successfully',
        '[2025-01-27 06:01:15] INFO: Starting data collection from subreddit: r/programming',
        '[2025-01-27 06:05:22] DEBUG: Collected 156 posts from r/programming',
        '[2025-01-27 06:05:35] INFO: Starting data collection from subreddit: r/webdev',
        '[2025-01-27 06:08:45] DEBUG: Collected 89 posts from r/webdev',
        '[2025-01-27 06:09:02] INFO: Starting data collection from subreddit: r/javascript',
        '[2025-01-27 06:12:18] DEBUG: Collected 234 posts from r/javascript',
        '[2025-01-27 06:12:35] INFO: Starting data collection from subreddit: r/python',
        '[2025-01-27 06:16:42] DEBUG: Collected 198 posts from r/python',
        '[2025-01-27 06:17:05] INFO: Starting data collection from subreddit: r/MachineLearning',
        '[2025-01-27 06:22:15] DEBUG: Collected 167 posts from r/MachineLearning',
        '[2025-01-27 06:22:35] INFO: Starting data collection from subreddit: r/datascience',
        '[2025-01-27 06:26:45] DEBUG: Collected 134 posts from r/datascience',
        '[2025-01-27 06:27:05] INFO: Starting data collection from subreddit: r/artificial',
        '[2025-01-27 06:30:25] DEBUG: Collected 89 posts from r/artificial',
        '[2025-01-27 06:30:45] INFO: Starting data collection from subreddit: r/cscareerquestions',
        '[2025-01-27 06:35:15] DEBUG: Collected 186 posts from r/cscareerquestions',
        '[2025-01-27 06:35:35] INFO: Processing collected comments and metadata',
        '[2025-01-27 06:42:22] INFO: Data processing completed',
        '[2025-01-27 06:42:45] INFO: Saving 1253 posts to output format: json',
        '[2025-01-27 07:44:58] INFO: Crawl job completed successfully',
        '[2025-01-27 07:45:00] INFO: Total items collected: 1253 posts, 3847 comments'
      ]
    },
    {
      id: '3',
      name: 'Instagram Hashtag Monitor',
      status: 'scheduled',
      progress: 0,
      nextRun: '2025-01-28T12:00:00Z',
      schedule: 'Weekly on Mondays',
      itemsCollected: 0,
      totalEstimated: 0,
      logs: []
    },
    {
      id: '4',
      name: 'LinkedIn Company Posts',
      status: 'failed',
      progress: 0,
      startTime: '2025-01-27T05:00:00Z',
      error: 'API rate limit exceeded',
      schedule: 'Daily at 5:00 AM UTC',
      itemsCollected: 0,
      totalEstimated: 0,
      logs: [
        '[2025-01-27 05:00:05] INFO: Starting LinkedIn crawl job "LinkedIn Company Posts"',
        '[2025-01-27 05:00:08] INFO: Initializing crawler with platform: linkedin',
        '[2025-01-27 05:00:12] INFO: Loaded 25 company pages for crawling',
        '[2025-01-27 05:00:45] INFO: Attempting to connect to LinkedIn API',
        '[2025-01-27 05:01:15] WARN: API response slow, retrying connection...',
        '[2025-01-27 05:01:45] ERROR: Failed to authenticate with LinkedIn API',
        '[2025-01-27 05:02:15] INFO: Retrying with backup authentication method',
        '[2025-01-27 05:02:45] WARN: Rate limit warning received from API',
        '[2025-01-27 05:03:15] ERROR: API rate limit exceeded - 429 Too Many Requests',
        '[2025-01-27 05:03:16] ERROR: Maximum retry attempts reached',
        '[2025-01-27 05:03:17] ERROR: Crawl job failed: API rate limit exceeded',
        '[2025-01-27 05:03:18] INFO: Cleaning up resources and exiting'
      ]
    }
  ];
  
  // User upload state
  let uploadFiles: FileList | null = null;
  let uploadProgress = 0;
  let uploadStatus = 'idle'; // idle, uploading, completed, error

  // Princeton SMART configuration state
  let princetonSmartConfig = {
    apiEndpoint: 'https://smart.princeton.edu/api/v1',
    apiKey: '',
    datasetId: '',
    query: '',
    dateRange: {
      start: '',
      end: ''
    },
    filters: {
      location: '',
      language: 'en',
      contentType: 'all', // all, text, media, links
      sentiment: 'all', // all, positive, negative, neutral
      minEngagement: 0
    },
    outputFormat: 'json', // json, csv, xml
    maxRecords: 10000,
    includeMetadata: true,
    includeAnalytics: false
  };
  
  let princetonSmartStatus = 'idle'; // idle, connecting, fetching, completed, error
  let princetonSmartProgress = 0;
  let princetonSmartResults = null;

  // Log viewer state
  let showLogViewer = false;
  let currentLogJob = null;
  let logUpdateInterval = null;
  
  // Princeton SMART functions
  function resetPrincetonSmartForm() {
    princetonSmartConfig = {
      apiEndpoint: 'https://smart.princeton.edu/api/v1',
      apiKey: '',
      datasetId: '',
      query: '',
      dateRange: {
        start: '',
        end: ''
      },
      filters: {
        location: '',
        language: 'en',
        contentType: 'all',
        sentiment: 'all',
        minEngagement: 0
      },
      outputFormat: 'json',
      maxRecords: 10000,
      includeMetadata: true,
      includeAnalytics: false
    };
    princetonSmartStatus = 'idle';
    princetonSmartProgress = 0;
    princetonSmartResults = null;
  }

  async function handlePrincetonSmartImport() {
    if (!princetonSmartConfig.apiKey || !princetonSmartConfig.datasetId) {
      return;
    }

    princetonSmartStatus = 'connecting';
    princetonSmartProgress = 0;

    try {
      // Simulate API connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      princetonSmartStatus = 'fetching';
      
      // Simulate data fetching with progress
      for (let i = 0; i <= 100; i += 10) {
        princetonSmartProgress = i;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Mock successful import
      princetonSmartResults = {
        recordCount: Math.floor(Math.random() * princetonSmartConfig.maxRecords) + 100,
        datasetId: princetonSmartConfig.datasetId,
        query: princetonSmartConfig.query,
        dateRange: princetonSmartConfig.dateRange,
        format: princetonSmartConfig.outputFormat
      };
      
      princetonSmartStatus = 'completed';
      
    } catch (error) {
      console.error('Princeton SMART import error:', error);
      princetonSmartStatus = 'error';
    }
  }

  function addUrl(url: string) {
    if (url.trim() && !crawlerConfig.urls.includes(url.trim())) {
      crawlerConfig.urls = [...crawlerConfig.urls, url.trim()];
    }
  }
  
  function removeUrl(index: number) {
    crawlerConfig.urls = crawlerConfig.urls.filter((_, i) => i !== index);
  }
  
  function addTdlibUrl(url: string) {
    if (url.trim() && !crawlerConfig.tdlibDatabaseURLs.includes(url.trim())) {
      crawlerConfig.tdlibDatabaseURLs = [...crawlerConfig.tdlibDatabaseURLs, url.trim()];
    }
  }
  
  function removeTdlibUrl(index: number) {
    crawlerConfig.tdlibDatabaseURLs = crawlerConfig.tdlibDatabaseURLs.filter((_, i) => i !== index);
  }
  
  function nextStep() {
    const steps = ['basic', 'platform', 'advanced', 'review'];
    const currentIndex = steps.indexOf(crawlerConfigStep);
    if (currentIndex < steps.length - 1) {
      crawlerConfigStep = steps[currentIndex + 1];
    }
  }
  
  function previousStep() {
    const steps = ['basic', 'platform', 'advanced', 'review'];
    const currentIndex = steps.indexOf(crawlerConfigStep);
    if (currentIndex > 0) {
      crawlerConfigStep = steps[currentIndex - 1];
    }
  }
  
  function handleUrlUpload() {
    if (!urlUploadFiles || urlUploadFiles.length === 0) return;
    
    const file = urlUploadFiles[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        // Split by lines and filter out empty lines
        const urls = content
          .split('\n')
          .map(url => url.trim())
          .filter(url => url.length > 0 && url.startsWith('http'));
        
        // Add unique URLs to the existing list
        const uniqueUrls = urls.filter(url => !crawlerConfig.urls.includes(url));
        crawlerConfig.urls = [...crawlerConfig.urls, ...uniqueUrls];
      }
    };
    
    reader.readAsText(file);
    urlUploadFiles = null;
  }
  
  function goToStep(step: string) {
    crawlerConfigStep = step;
  }
  
  function saveCrawlerJob() {
    const newJob = {
      id: Date.now().toString(),
      name: crawlerConfig.name || `${crawlerConfig.platform} crawl`,
      status: scheduleConfig.enabled ? 'scheduled' : 'pending',
      progress: 0,
      schedule: scheduleConfig.enabled ? `${scheduleConfig.frequency} at ${scheduleConfig.time} ${scheduleConfig.timezone}` : 'On-demand',
      itemsCollected: 0,
      totalEstimated: 0,
      nextRun: scheduleConfig.enabled ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined,
      platform: crawlerConfig.platform,
      crawlId: crawlerConfig.crawlId,
      crawlLabel: crawlerConfig.name
    };
    
    crawlJobs = [newJob, ...crawlJobs];
    
    // Reset form
    crawlerConfig = {
      name: '',
      crawlId: '',
      logLevel: 'debug',
      concurrency: 1,
      timeout: 30,
      userAgent: 'Mozilla/5.0 Crawler',
      outputFormat: 'json',
      platform: 'telegram',
      urls: [],
      urlFileURL: '',
      minPostDate: '',
      timeAgo: '1m',
      dateBetween: '',
      sampleSize: 0,
      maxComments: -1,
      maxDepth: -1,
      maxPosts: -1,
      maxPages: 108000,
      minUsers: 100,
      minChannelVideos: 10,
      tdlibDatabaseURLs: [],
      tdlibVerbosity: 1,
      skipMediaDownload: false,
      youtubeApiKey: '',
      samplingMethod: 'channel'
    };
    
    crawlerConfigStep = 'basic';
    activeTab = 'schedule';
  }
  
  function runCrawl(jobId: string) {
    crawlJobs = crawlJobs.map(job => 
      job.id === jobId 
        ? { ...job, status: 'running', progress: 0, startTime: new Date().toISOString() }
        : job
    );
  }
  
  function handleFileUpload() {
    if (!uploadFiles || uploadFiles.length === 0) return;
    
    uploadStatus = 'uploading';
    uploadProgress = 0;
    
    // Simulate upload progress
    const interval = setInterval(() => {
      uploadProgress += 10;
      if (uploadProgress >= 100) {
        clearInterval(interval);
        uploadStatus = 'completed';
        setTimeout(() => {
          uploadStatus = 'idle';
          uploadProgress = 0;
          uploadFiles = null;
        }, 2000);
      }
    }, 200);
  }
  
  function getStatusColor(status: string) {
    switch (status) {
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'scheduled': return 'text-purple-600 bg-purple-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }
  
  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function openLogViewer(job) {
    currentLogJob = job;
    showLogViewer = true;
    
    // For running jobs, simulate real-time log updates
    if (job.status === 'running') {
      logUpdateInterval = setInterval(() => {
        simulateLogUpdate(job);
      }, 3000);
    }
  }

  function closeLogViewer() {
    showLogViewer = false;
    currentLogJob = null;
    if (logUpdateInterval) {
      clearInterval(logUpdateInterval);
      logUpdateInterval = null;
    }
  }

  function simulateLogUpdate(job) {
    if (job.status === 'running' && job.logs) {
      const newLogMessages = [
        `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] DEBUG: Processing batch ${Math.floor(Math.random() * 15) + 1}/15 - collected ${Math.floor(Math.random() * 300) + 100} posts`,
        `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] INFO: Rate limit check passed, continuing...`,
        `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] DEBUG: Validating data structure for ${Math.floor(Math.random() * 50) + 20} posts`,
        `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] INFO: Memory usage: ${Math.floor(Math.random() * 40) + 30}MB`
      ];
      
      const randomMessage = newLogMessages[Math.floor(Math.random() * newLogMessages.length)];
      job.logs = [...job.logs, randomMessage];
      
      // Trigger reactivity
      crawlJobs = [...crawlJobs];
    }
  }
</script>

<svelte:head>
  <title>Data Capture - Social Explorer</title>
  <meta name="description" content="Data collection and capture tools for social media platforms" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="bg-white shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center mr-4">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Data Capture</h1>
            <p class="text-gray-600 mt-1">Configure and manage your data collection sources</p>
          </div>
        </div>
        <div class="text-sm text-gray-600 font-medium">
          {crawlJobs.filter(job => job.status === 'running').length} jobs running
        </div>
      </div>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="bg-white border-b border-gray-200">
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex space-x-8">
        <button 
          class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'schedule' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'schedule'}>
          Schedule & Status
        </button>
        <button 
          class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'crawler' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'crawler'}>
          Web Crawler
        </button>
        <button 
          class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'upload' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'upload'}>
          File Upload
        </button>
        <button 
          class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'princeton-smart' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'princeton-smart'}>
          Princeton SMART
        </button>
      </div>
    </nav>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <!-- Web Crawler Tab -->
    {#if activeTab === 'crawler'}
      <div class="max-w-6xl mx-auto">
        <!-- Step Progress -->
        <div class="mb-8">
          <nav aria-label="Progress">
            <ol class="flex items-center justify-center space-x-4">
              {#each [
                { id: 'basic', name: 'Basic Settings', icon: '1' },
                { id: 'platform', name: 'Platform & URLs', icon: '2' },
                { id: 'advanced', name: 'Filters & Limits', icon: '3' },
                { id: 'review', name: 'Review & Schedule', icon: '4' }
              ] as step, i}
                <li class="flex items-center">
                  <button 
                    on:click={() => goToStep(step.id)}
                    class="flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-medium transition-colors
                      {crawlerConfigStep === step.id 
                        ? 'bg-orange-600 border-orange-600 text-white' 
                        : 'border-gray-300 text-gray-500 hover:border-gray-400'
                      }">
                    {step.icon}
                  </button>
                  <span class="ml-2 text-sm font-medium text-gray-900 hidden sm:block">{step.name}</span>
                  {#if i < 3}
                    <div class="w-8 h-px bg-gray-300 ml-4"></div>
                  {/if}
                </li>
              {/each}
            </ol>
          </nav>
        </div>

        <!-- Step Content -->
        <div class="bg-white rounded-lg shadow-sm p-8">
          
          <!-- Step 1: Basic Settings -->
          {#if crawlerConfigStep === 'basic'}
            <div class="space-y-6">
              <div>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">Basic Settings</h2>
                <p class="text-gray-600">Configure the fundamental settings for your crawler job.</p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div class="flex items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">Job Name *</label>
                    <div class="group relative ml-2">
                      <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        A descriptive name for your crawl job that will help you identify it later
                      </div>
                    </div>
                  </div>
                  <input 
                    bind:value={crawlerConfig.name}
                    type="text" 
                    placeholder="e.g., Telegram Sentiment Analysis"
                    required
                    class="w-full px-3 py-2 border {crawlerConfig.name.trim() ? 'border-gray-300' : 'border-red-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                </div>
                <div>
                  <div class="flex items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">Crawl ID</label>
                    <div class="group relative ml-2">
                      <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        Optional unique identifier for tracking this specific crawl operation
                      </div>
                    </div>
                  </div>
                  <input 
                    bind:value={crawlerConfig.crawlId}
                    type="text" 
                    placeholder="unique-identifier"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                </div>
                <div>
                  <div class="flex items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">Log Level</label>
                    <div class="group relative ml-2">
                      <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        Controls how much detail is logged during crawling (debug recommended for troubleshooting)
                      </div>
                    </div>
                  </div>
                  <select 
                    bind:value={crawlerConfig.logLevel}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="trace">Trace</option>
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                    <option value="fatal">Fatal</option>
                    <option value="panic">Panic</option>
                  </select>
                </div>
                <div>
                  <div class="flex items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">Concurrency</label>
                    <div class="group relative ml-2">
                      <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        Number of parallel crawlers to run simultaneously (higher = faster but more load)
                      </div>
                    </div>
                  </div>
                  <input 
                    bind:value={crawlerConfig.concurrency}
                    type="number" 
                    min="1"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                </div>
                <div>
                  <div class="flex items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">Timeout (seconds)</label>
                    <div class="group relative ml-2">
                      <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        Maximum time to wait for HTTP requests before giving up
                      </div>
                    </div>
                  </div>
                  <input 
                    bind:value={crawlerConfig.timeout}
                    type="number" 
                    min="1"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                </div>
                <div>
                  <div class="flex items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">User Agent</label>
                    <div class="group relative ml-2">
                      <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        Browser identification string sent with requests (helps avoid blocks)
                      </div>
                    </div>
                  </div>
                  <input 
                    bind:value={crawlerConfig.userAgent}
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                </div>
                <div>
                  <div class="flex items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">Output Format</label>
                    <div class="group relative ml-2">
                      <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        Format for storing crawled data (JSON recommended for rich data structures)
                      </div>
                    </div>
                  </div>
                  <select 
                    bind:value={crawlerConfig.outputFormat}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
              </div>

              <!-- Skip Media Download - applies to all platforms -->
              <div class="border-t pt-6">
                <div class="space-y-3">
                  <div class="flex items-center">
                    <input 
                      bind:checked={crawlerConfig.skipMediaDownload}
                      type="checkbox" 
                      id="skip-media-global"
                      class="rounded border-gray-300 text-orange-600 focus:ring-orange-500">
                    <label for="skip-media-global" class="ml-2 text-sm text-gray-700">Skip media download</label>
                    <div class="group relative ml-2">
                      <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        Skip downloading images, videos, and other media files to save storage space
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- Step 2: Platform & URLs -->
          {#if crawlerConfigStep === 'platform'}
            <div class="space-y-6">
              <div>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">Platform & URLs</h2>
                <p class="text-gray-600">Select the platform and configure target URLs or files.</p>
              </div>

              <div>
                <div class="flex items-center mb-2">
                  <label class="block text-sm font-medium text-gray-700">Platform</label>
                  <div class="group relative ml-2">
                    <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      Choose the social media platform you want to crawl
                    </div>
                  </div>
                </div>
                <div class="flex space-x-4">
                  <label class="flex items-center">
                    <input 
                      bind:group={crawlerConfig.platform}
                      type="radio" 
                      value="telegram"
                      class="text-orange-600 focus:ring-orange-500">
                    <span class="ml-2 text-sm text-gray-700">Telegram</span>
                  </label>
                  <label class="flex items-center">
                    <input 
                      bind:group={crawlerConfig.platform}
                      type="radio" 
                      value="youtube"
                      class="text-orange-600 focus:ring-orange-500">
                    <span class="ml-2 text-sm text-gray-700">YouTube</span>
                  </label>
                </div>
              </div>

              <!-- URL Configuration -->
              <div class="space-y-4">
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="block text-sm font-medium text-gray-700">Direct URLs</label>
                    <div class="flex items-center space-x-2">
                      <input 
                        bind:files={urlUploadFiles}
                        type="file" 
                        accept=".txt,.csv"
                        class="hidden" 
                        id="url-upload">
                      <label 
                        for="url-upload"
                        class="inline-flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md cursor-pointer transition-colors">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                        </svg>
                        Upload List
                      </label>
                      {#if urlUploadFiles && urlUploadFiles.length > 0}
                        <button 
                          on:click={handleUrlUpload}
                          class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors">
                          Process File
                        </button>
                      {/if}
                    </div>
                  </div>
                  <div class="space-y-2">
                    {#each crawlerConfig.urls as url, i}
                      <div class="flex items-center space-x-2">
                        <input 
                          bind:value={crawlerConfig.urls[i]}
                          type="url" 
                          placeholder="https://example.com"
                          class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                        <button 
                          on:click={() => removeUrl(i)}
                          class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors">
                          Remove
                        </button>
                      </div>
                    {/each}
                    <button 
                      on:click={() => crawlerConfig.urls = [...crawlerConfig.urls, '']}
                      class="flex items-center px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-md transition-colors">
                      <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                      </svg>
                      Add URL
                    </button>
                  </div>
                  {#if urlUploadFiles && urlUploadFiles.length > 0}
                    <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div class="flex items-center">
                        <svg class="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-sm text-blue-800">Selected: {urlUploadFiles[0].name} - Click "Process File" to add URLs</span>
                      </div>
                    </div>
                  {/if}
                </div>

                <div>
                  <div class="flex items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">URL File URL</label>
                    <div class="group relative ml-2">
                      <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        URL to a remote file containing URLs to crawl (one per line). Alternative to direct URLs.
                      </div>
                    </div>
                  </div>
                  <input 
                    bind:value={crawlerConfig.urlFileURL}
                    type="url" 
                    placeholder="https://example.com/urls.txt"
                    class="w-full px-3 py-2 border {(crawlerConfig.urls.length > 0 || crawlerConfig.urlFileURL.trim()) ? 'border-gray-300' : 'border-red-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {#if crawlerConfig.urls.length === 0 && !crawlerConfig.urlFileURL.trim()}
                    <p class="text-red-600 text-xs mt-1">Either provide direct URLs above or a URL file URL</p>
                  {/if}
                </div>
              </div>

              <!-- Platform-specific settings -->
              {#if crawlerConfig.platform === 'telegram'}
                <div class="border-t pt-6">
                  <h3 class="text-lg font-medium text-gray-900 mb-4">Telegram Settings</h3>
                  <div class="space-y-4">
                    <div>
                      <div class="flex items-center mb-2">
                        <label class="block text-sm font-medium text-gray-700">TDLib Database URLs *</label>
                        <div class="group relative ml-2">
                          <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            URLs to pre-seeded TDLib database archives required for Telegram access
                          </div>
                        </div>
                      </div>
                      <div class="space-y-2">
                        {#each crawlerConfig.tdlibDatabaseURLs as url, i}
                          <div class="flex items-center space-x-2">
                            <input 
                              bind:value={crawlerConfig.tdlibDatabaseURLs[i]}
                              type="url" 
                              placeholder="https://example.com/database.tar.gz"
                              class="flex-1 px-3 py-2 border {crawlerConfig.tdlibDatabaseURLs.length > 0 && crawlerConfig.tdlibDatabaseURLs.some(u => u.trim()) ? 'border-gray-300' : 'border-red-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                            <button 
                              on:click={() => removeTdlibUrl(i)}
                              class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              Remove
                            </button>
                          </div>
                        {/each}
                        <button 
                          on:click={() => crawlerConfig.tdlibDatabaseURLs = [...crawlerConfig.tdlibDatabaseURLs, '']}
                          class="flex items-center px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-md transition-colors">
                          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                          </svg>
                          Add TDLib URL
                        </button>
                        {#if crawlerConfig.tdlibDatabaseURLs.length === 0 || !crawlerConfig.tdlibDatabaseURLs.some(u => u.trim())}
                          <p class="text-red-600 text-xs">At least one TDLib database URL is required for Telegram crawling</p>
                        {/if}
                      </div>
                    </div>
                    <div>
                      <div class="flex items-center mb-2">
                        <label class="block text-sm font-medium text-gray-700">TDLib Verbosity (0-10)</label>
                        <div class="group relative ml-2">
                          <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            TDLib logging verbosity level (0=quiet, 10=maximum detail)
                          </div>
                        </div>
                      </div>
                      <input 
                        bind:value={crawlerConfig.tdlibVerbosity}
                        type="number" 
                        min="0" max="10"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    </div>
                  </div>
                </div>
              {:else if crawlerConfig.platform === 'youtube'}
                <div class="border-t pt-6">
                  <h3 class="text-lg font-medium text-gray-900 mb-4">YouTube Settings</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div class="flex items-center mb-2">
                        <label class="block text-sm font-medium text-gray-700">YouTube API Key</label>
                        <div class="group relative ml-2">
                          <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            YouTube Data API v3 key from Google Cloud Console
                          </div>
                        </div>
                      </div>
                      <input 
                        bind:value={crawlerConfig.youtubeApiKey}
                        type="password"
                        placeholder="Enter your YouTube API key"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    </div>
                    <div>
                      <div class="flex items-center mb-2">
                        <label class="block text-sm font-medium text-gray-700">Min Channel Videos</label>
                        <div class="group relative ml-2">
                          <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            Minimum number of videos a channel must have to be included in crawling
                          </div>
                        </div>
                      </div>
                      <input 
                        bind:value={crawlerConfig.minChannelVideos}
                        type="number" 
                        min="1"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Step 3: Advanced Settings -->
          {#if crawlerConfigStep === 'advanced'}
            <div class="space-y-6">
              <div>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">Filters & Limits</h2>
                <p class="text-gray-600">Configure date filters, limits, and sampling methods.</p>
              </div>

              <!-- Date Filters -->
              <div class="border border-gray-200 rounded-lg p-4">
                <h3 class="text-lg font-medium text-gray-900 mb-4">Date Filters</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div class="flex items-center mb-2">
                      <label class="block text-sm font-medium text-gray-700">Min Post Date</label>
                      <div class="group relative ml-2">
                        <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Only crawl posts created after this date
                        </div>
                      </div>
                    </div>
                    <input 
                      bind:value={crawlerConfig.minPostDate}
                      type="date"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                  </div>
                  <div>
                    <div class="flex items-center mb-2">
                      <label class="block text-sm font-medium text-gray-700">Time Ago</label>
                      <div class="group relative ml-2">
                        <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Only consider posts newer than this time ago (e.g., 30d, 6h, 2w, 1m, 1y)
                        </div>
                      </div>
                    </div>
                    <input 
                      bind:value={crawlerConfig.timeAgo}
                      type="text" 
                      placeholder="1m, 30d, 6h, 2w, 1y"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                  </div>
                  <div>
                    <div class="flex items-center mb-2">
                      <label class="block text-sm font-medium text-gray-700">Date Between</label>
                      <div class="group relative ml-2">
                        <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Crawl posts between specific dates (format: YYYY-MM-DD,YYYY-MM-DD)
                        </div>
                      </div>
                    </div>
                    <input 
                      bind:value={crawlerConfig.dateBetween}
                      type="text" 
                      placeholder="2024-01-01,2024-12-31"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                  </div>
                </div>
              </div>

              <!-- Limits -->
              <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-lg font-medium text-gray-900">Crawl Limits</h3>
                  <button 
                    type="button"
                    on:click={() => showCrawlLimits = !showCrawlLimits}
                    class="flex items-center text-sm text-orange-600 hover:text-orange-700 transition-colors">
                    {showCrawlLimits ? 'Hide' : 'Configure'} Limits
                    <svg class="w-4 h-4 ml-1 transform transition-transform {showCrawlLimits ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </button>
                </div>
                
                {#if showCrawlLimits}
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <div class="flex items-center mb-2">
                        <label class="block text-sm font-medium text-gray-700">Max Posts</label>
                        <div class="group relative ml-2">
                          <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            Maximum number of posts to collect (-1 for unlimited)
                          </div>
                        </div>
                      </div>
                      <input 
                        bind:value={crawlerConfig.maxPosts}
                        type="number"
                        placeholder="-1"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    </div>
                    <div>
                      <div class="flex items-center mb-2">
                        <label class="block text-sm font-medium text-gray-700">Max Comments</label>
                        <div class="group relative ml-2">
                          <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            Maximum number of comments per post to collect (-1 for unlimited)
                          </div>
                        </div>
                      </div>
                      <input 
                        bind:value={crawlerConfig.maxComments}
                        type="number"
                        placeholder="-1"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    </div>
                    <div>
                      <div class="flex items-center mb-2">
                        <label class="block text-sm font-medium text-gray-700">Max Depth</label>
                        <div class="group relative ml-2">
                          <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            Maximum crawl depth for following links (-1 for unlimited)
                          </div>
                        </div>
                      </div>
                      <input 
                        bind:value={crawlerConfig.maxDepth}
                        type="number"
                        placeholder="-1"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    </div>
                    <div>
                      <div class="flex items-center mb-2">
                        <label class="block text-sm font-medium text-gray-700">Max Pages</label>
                        <div class="group relative ml-2">
                          <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            Maximum number of pages/channels to crawl
                          </div>
                        </div>
                      </div>
                      <input 
                        bind:value={crawlerConfig.maxPages}
                        type="number" 
                        min="1"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    </div>
                    <div>
                      <div class="flex items-center mb-2">
                        <label class="block text-sm font-medium text-gray-700">Min Users</label>
                        <div class="group relative ml-2">
                          <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            Minimum number of users in a channel to include it
                          </div>
                        </div>
                      </div>
                      <input 
                        bind:value={crawlerConfig.minUsers}
                        type="number" 
                        min="1"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    </div>
                    <div>
                      <div class="flex items-center mb-2">
                        <label class="block text-sm font-medium text-gray-700">Sample Size</label>
                        <div class="group relative ml-2">
                          <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            Number of posts to randomly sample when using date-between (0 = no sampling)
                          </div>
                        </div>
                      </div>
                      <input 
                        bind:value={crawlerConfig.sampleSize}
                        type="number" 
                        min="0"
                        placeholder="0"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    </div>
                  </div>
                {:else}
                  <p class="text-gray-600 text-sm">Click "Configure Limits" to set custom crawl limits. Default limits will be used.</p>
                {/if}
              </div>

              <!-- Sampling Method -->
              <div>
                <div class="flex items-center mb-2">
                  <label class="block text-sm font-medium text-gray-700">Sampling Method</label>
                  <div class="group relative ml-2">
                    <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      Method for selecting data: channel (by channel), random (random selection), snowball (following connections)
                    </div>
                  </div>
                </div>
                <div class="flex space-x-6">
                  <label class="flex items-center">
                    <input 
                      bind:group={crawlerConfig.samplingMethod}
                      type="radio" 
                      value="channel"
                      class="text-orange-600 focus:ring-orange-500">
                    <span class="ml-2 text-sm text-gray-700">Channel</span>
                  </label>
                  <label class="flex items-center">
                    <input 
                      bind:group={crawlerConfig.samplingMethod}
                      type="radio" 
                      value="random"
                      class="text-orange-600 focus:ring-orange-500">
                    <span class="ml-2 text-sm text-gray-700">Random</span>
                  </label>
                  <label class="flex items-center">
                    <input 
                      bind:group={crawlerConfig.samplingMethod}
                      type="radio" 
                      value="snowball"
                      class="text-orange-600 focus:ring-orange-500">
                    <span class="ml-2 text-sm text-gray-700">Snowball</span>
                  </label>
                </div>
              </div>

            </div>
          {/if}

          <!-- Step 4: Review & Schedule -->
          {#if crawlerConfigStep === 'review'}
            <div class="space-y-6">
              <div>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">Review & Schedule</h2>
                <p class="text-gray-600">Review your configuration and set up scheduling.</p>
              </div>

              <!-- Configuration Summary -->
              <div class="border border-gray-200 rounded-lg p-4">
                <h3 class="text-lg font-medium text-gray-900 mb-4">Configuration Summary</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="text-gray-500">Job Name:</span>
                    <span class="ml-2 font-medium">{crawlerConfig.name || 'Untitled'}</span>
                  </div>
                  <div>
                    <span class="text-gray-500">Platform:</span>
                    <span class="ml-2 font-medium capitalize">{crawlerConfig.platform}</span>
                  </div>
                  <div>
                    <span class="text-gray-500">URLs:</span>
                    <span class="ml-2 font-medium">{crawlerConfig.urls.length} configured</span>
                  </div>
                  <div>
                    <span class="text-gray-500">Max Pages:</span>
                    <span class="ml-2 font-medium">{crawlerConfig.maxPages}</span>
                  </div>
                  <div>
                    <span class="text-gray-500">Concurrency:</span>
                    <span class="ml-2 font-medium">{crawlerConfig.concurrency}</span>
                  </div>
                  <div>
                    <span class="text-gray-500">Sampling Method:</span>
                    <span class="ml-2 font-medium capitalize">{crawlerConfig.samplingMethod}</span>
                  </div>
                </div>
              </div>

              <!-- Schedule Configuration -->
              <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-lg font-medium text-gray-900">Schedule Configuration</h3>
                  <label class="flex items-center">
                    <input 
                      bind:checked={scheduleConfig.enabled}
                      type="checkbox" 
                      class="rounded border-gray-300 text-orange-600 focus:ring-orange-500">
                    <span class="ml-2 text-sm text-gray-700">Enable scheduling</span>
                  </label>
                </div>

                {#if scheduleConfig.enabled}
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                      <select 
                        bind:value={scheduleConfig.frequency}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Time</label>
                      <input 
                        bind:value={scheduleConfig.time}
                        type="time"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                      <select 
                        bind:value={scheduleConfig.timezone}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">EST</option>
                        <option value="America/Los_Angeles">PST</option>
                        <option value="Europe/London">GMT</option>
                      </select>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Navigation -->
          <div class="flex justify-between pt-6 border-t">
            <button 
              on:click={previousStep}
              disabled={crawlerConfigStep === 'basic'}
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Previous
            </button>
            
            <div class="flex space-x-3">
              <button class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Save as Draft
              </button>
              
              {#if crawlerConfigStep === 'review'}
                <button 
                  on:click={saveCrawlerJob}
                  disabled={!validateForm()}
                  class="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors">
                  Create Crawler Job
                </button>
              {:else}
                <button 
                  on:click={nextStep}
                  class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm font-medium transition-colors">
                  Next
                </button>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- File Upload Tab -->
    {#if activeTab === 'upload'}
      <div class="max-w-2xl mx-auto">
        <div class="bg-white rounded-lg shadow-sm p-8">
          <h2 class="text-xl font-semibold text-gray-900 mb-6">Upload Data Files</h2>
          
          <!-- Upload Area -->
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
            <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
            </svg>
            <p class="text-lg font-medium text-gray-900 mb-2">Drop files here or click to browse</p>
            <p class="text-sm text-gray-600 mb-4">Supported formats: CSV, JSON, Excel, TSV</p>
            <input 
              bind:files={uploadFiles}
              type="file" 
              multiple 
              accept=".csv,.json,.xlsx,.xls,.tsv"
              class="hidden" 
              id="file-upload">
            <label 
              for="file-upload"
              class="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md cursor-pointer transition-colors">
              Select Files
            </label>
          </div>

          <!-- File List -->
          {#if uploadFiles && uploadFiles.length > 0}
            <div class="mb-6">
              <h3 class="text-sm font-medium text-gray-900 mb-3">Selected Files</h3>
              <div class="space-y-2">
                {#each Array.from(uploadFiles) as file}
                  <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center">
                      <svg class="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                      <div>
                        <div class="text-sm font-medium text-gray-900">{file.name}</div>
                        <div class="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Upload Progress -->
          {#if uploadStatus === 'uploading'}
            <div class="mb-6">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-700">Uploading files...</span>
                <span class="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-orange-600 h-2 rounded-full transition-all duration-300" style="width: {uploadProgress}%"></div>
              </div>
            </div>
          {:else if uploadStatus === 'completed'}
            <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="text-sm font-medium text-green-800">Files uploaded successfully!</span>
              </div>
            </div>
          {/if}

          <!-- Upload Settings -->
          <div class="border-t pt-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Upload Settings</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Data Source Name</label>
                <input 
                  type="text" 
                  placeholder="e.g., Customer Survey Data Q4 2024"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea 
                  placeholder="Describe the data source and its purpose..."
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"></textarea>
              </div>
              <div class="flex items-center">
                <input type="checkbox" id="auto-parse" class="rounded border-gray-300 text-orange-600 focus:ring-orange-500">
                <label for="auto-parse" class="ml-2 text-sm text-gray-700">Automatically parse and analyze data structure</label>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end space-x-3 pt-6 border-t">
            <button class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button 
              on:click={handleFileUpload}
              disabled={!uploadFiles || uploadFiles.length === 0 || uploadStatus === 'uploading'}
              class="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors">
              Upload Files
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Princeton SMART Tab -->
    {#if activeTab === 'princeton-smart'}
      <div class="max-w-4xl mx-auto">
        <div class="bg-white rounded-lg shadow-sm p-8">
          <div class="flex items-center mb-6">
            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-4">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
            </div>
            <div>
              <h2 class="text-2xl font-semibold text-gray-900">Princeton SMART Data Import</h2>
              <p class="text-gray-600">Connect to Princeton's Social Media Analysis and Research Toolkit</p>
            </div>
          </div>
          
          <!-- Connection Settings -->
          <div class="border-b pb-6 mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Connection Settings</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">API Endpoint</label>
                <input 
                  bind:value={princetonSmartConfig.apiEndpoint}
                  type="url" 
                  placeholder="https://smart.princeton.edu/api/v1"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                <input 
                  bind:value={princetonSmartConfig.apiKey}
                  type="password" 
                  placeholder="Enter your SMART API key"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
            </div>
          </div>

          <!-- Dataset Configuration -->
          <div class="border-b pb-6 mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Dataset Configuration</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Dataset ID</label>
                <input 
                  bind:value={princetonSmartConfig.datasetId}
                  type="text" 
                  placeholder="e.g., twitter-2024-election, reddit-climate-change"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Search Query</label>
                <textarea 
                  bind:value={princetonSmartConfig.query}
                  placeholder="Enter search terms, hashtags, or complex queries..."
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                <p class="text-xs text-gray-500 mt-1">Use SMART query syntax for advanced filtering</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input 
                    bind:value={princetonSmartConfig.dateRange.start}
                    type="date" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input 
                    bind:value={princetonSmartConfig.dateRange.end}
                    type="date" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
              </div>
            </div>
          </div>

          <!-- Filters -->
          <div class="border-b pb-6 mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Advanced Filters</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input 
                  bind:value={princetonSmartConfig.filters.location}
                  type="text" 
                  placeholder="e.g., United States, NYC"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Language</label>
                <select 
                  bind:value={princetonSmartConfig.filters.language}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ru">Russian</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                  <option value="ar">Arabic</option>
                  <option value="all">All Languages</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
                <select 
                  bind:value={princetonSmartConfig.filters.contentType}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">All Content</option>
                  <option value="text">Text Only</option>
                  <option value="media">Media Posts</option>
                  <option value="links">Link Shares</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Sentiment Filter</label>
                <select 
                  bind:value={princetonSmartConfig.filters.sentiment}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">All Sentiments</option>
                  <option value="positive">Positive Only</option>
                  <option value="negative">Negative Only</option>
                  <option value="neutral">Neutral Only</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Min Engagement</label>
                <input 
                  bind:value={princetonSmartConfig.filters.minEngagement}
                  type="number" 
                  min="0"
                  placeholder="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Max Records</label>
                <input 
                  bind:value={princetonSmartConfig.maxRecords}
                  type="number" 
                  min="1"
                  max="100000"
                  placeholder="10000"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
            </div>
          </div>

          <!-- Output Settings -->
          <div class="border-b pb-6 mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Output Settings</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Output Format</label>
                <select 
                  bind:value={princetonSmartConfig.outputFormat}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="xml">XML</option>
                </select>
              </div>
              <div class="flex items-center space-x-6">
                <label class="flex items-center">
                  <input 
                    bind:checked={princetonSmartConfig.includeMetadata}
                    type="checkbox" 
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                  <span class="ml-2 text-sm text-gray-700">Include Metadata</span>
                </label>
                <label class="flex items-center">
                  <input 
                    bind:checked={princetonSmartConfig.includeAnalytics}
                    type="checkbox" 
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                  <span class="ml-2 text-sm text-gray-700">Include Analytics</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Status and Progress -->
          {#if princetonSmartStatus === 'connecting'}
            <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div class="flex items-center">
                <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                <span class="text-sm font-medium text-blue-800">Connecting to Princeton SMART API...</span>
              </div>
            </div>
          {:else if princetonSmartStatus === 'fetching'}
            <div class="mb-6">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-700">Fetching data from SMART...</span>
                <span class="text-sm text-gray-500">{princetonSmartProgress}%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {princetonSmartProgress}%"></div>
              </div>
            </div>
          {:else if princetonSmartStatus === 'completed'}
            <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <svg class="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span class="text-sm font-medium text-green-800">Data imported successfully!</span>
                </div>
                {#if princetonSmartResults}
                  <span class="text-sm text-green-600">{princetonSmartResults.recordCount} records imported</span>
                {/if}
              </div>
            </div>
          {:else if princetonSmartStatus === 'error'}
            <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="text-sm font-medium text-red-800">Error connecting to Princeton SMART API</span>
              </div>
            </div>
          {/if}

          <!-- Actions -->
          <div class="flex justify-between items-center">
            <div class="text-sm text-gray-600">
              <a href="https://smart.princeton.edu/docs" target="_blank" class="text-blue-600 hover:text-blue-800 underline">
                View SMART API Documentation
              </a>
            </div>
            <div class="flex space-x-3">
              <button 
                on:click={resetPrincetonSmartForm}
                class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Reset Form
              </button>
              <button 
                on:click={handlePrincetonSmartImport}
                disabled={!princetonSmartConfig.apiKey || !princetonSmartConfig.datasetId || princetonSmartStatus === 'connecting' || princetonSmartStatus === 'fetching'}
                class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors">
                {princetonSmartStatus === 'connecting' || princetonSmartStatus === 'fetching' ? 'Importing...' : 'Import Data'}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Schedule & Status Tab -->
    {#if activeTab === 'schedule'}
      <div class="space-y-6">
        <!-- Statistics -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div class="bg-white rounded-lg shadow-sm p-6 text-center">
            <div class="text-2xl font-bold text-blue-600 mb-1">{crawlJobs.filter(job => job.status === 'running').length}</div>
            <div class="text-sm text-gray-600">Running</div>
          </div>
          <div class="bg-white rounded-lg shadow-sm p-6 text-center">
            <div class="text-2xl font-bold text-purple-600 mb-1">{crawlJobs.filter(job => job.status === 'scheduled').length}</div>
            <div class="text-sm text-gray-600">Scheduled</div>
          </div>
          <div class="bg-white rounded-lg shadow-sm p-6 text-center">
            <div class="text-2xl font-bold text-green-600 mb-1">{crawlJobs.filter(job => job.status === 'completed').length}</div>
            <div class="text-sm text-gray-600">Completed</div>
          </div>
          <div class="bg-white rounded-lg shadow-sm p-6 text-center">
            <div class="text-2xl font-bold text-red-600 mb-1">{crawlJobs.filter(job => job.status === 'failed').length}</div>
            <div class="text-sm text-gray-600">Failed</div>
          </div>
        </div>

        <!-- Jobs List -->
        <div class="bg-white rounded-lg shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-xl font-semibold text-gray-900">Crawl Jobs</h2>
          </div>
          <div class="divide-y divide-gray-200">
            {#each crawlJobs as job}
              <div class="p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center">
                    <h3 class="text-lg font-medium text-gray-900 mr-3">{job.name}</h3>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(job.status)}">
                      {job.status}
                    </span>
                  </div>
                  <div class="flex items-center space-x-2">
                    {#if job.status === 'scheduled' || job.status === 'pending'}
                      <button 
                        on:click={() => runCrawl(job.id)}
                        class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors">
                        Run Now
                      </button>
                    {/if}
                    {#if job.logs && job.logs.length > 0}
                      <button 
                        on:click={() => openLogViewer(job)}
                        class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors">
                        View Logs
                      </button>
                    {/if}
                    <button class="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors">
                      Edit
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div class="text-sm text-gray-500">Schedule</div>
                    <div class="text-sm font-medium text-gray-900">{job.schedule}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500">Items Collected</div>
                    <div class="text-sm font-medium text-gray-900">{job.itemsCollected.toLocaleString()}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500">
                      {job.status === 'running' ? 'Started' : job.status === 'scheduled' ? 'Next Run' : 'Last Run'}
                    </div>
                    <div class="text-sm font-medium text-gray-900">
                      {#if job.status === 'scheduled' && job.nextRun}
                        {formatDateTime(job.nextRun)}
                      {:else if job.startTime}
                        {formatDateTime(job.startTime)}
                      {:else}
                        Never
                      {/if}
                    </div>
                  </div>
                </div>

                {#if job.status === 'running' && job.progress !== undefined}
                  <div class="mb-4">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-sm font-medium text-gray-700">Progress</span>
                      <span class="text-sm text-gray-500">{job.progress}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {job.progress}%"></div>
                    </div>
                  </div>
                {/if}

                {#if job.error}
                  <div class="p-3 bg-red-50 border border-red-200 rounded-md">
                    <div class="flex items-center">
                      <svg class="w-4 h-4 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span class="text-sm font-medium text-red-800">Error: {job.error}</span>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Log Viewer Modal -->
{#if showLogViewer && currentLogJob}
  <div class="fixed inset-0 bg-gray-500/20 backdrop-blur-sm flex items-center justify-center z-50 p-4" on:click={closeLogViewer}>
    <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col" on:click|stopPropagation>
      <!-- Modal Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <div class="flex items-center space-x-3">
          <h2 class="text-xl font-semibold text-gray-900">Crawl Logs</h2>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(currentLogJob.status)}">
            {currentLogJob.status}
          </span>
        </div>
        <button 
          on:click={closeLogViewer}
          class="text-gray-400 hover:text-gray-600 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Job Info -->
      <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span class="font-medium text-gray-700">Job Name:</span>
            <span class="ml-2 text-gray-900">{currentLogJob.name}</span>
          </div>
          <div>
            <span class="font-medium text-gray-700">Started:</span>
            <span class="ml-2 text-gray-900">
              {currentLogJob.startTime ? formatDateTime(currentLogJob.startTime) : 'Not started'}
            </span>
          </div>
          <div>
            <span class="font-medium text-gray-700">Items Collected:</span>
            <span class="ml-2 text-gray-900">{currentLogJob.itemsCollected.toLocaleString()}</span>
          </div>
        </div>
        
        {#if currentLogJob.status === 'running' && currentLogJob.progress !== undefined}
          <div class="mt-3">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium text-gray-700">Progress</span>
              <span class="text-sm text-gray-500">{currentLogJob.progress}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {currentLogJob.progress}%"></div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Logs Container -->
      <div class="flex-1 overflow-hidden p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            {currentLogJob.status === 'running' ? 'Live Logs' : 'Complete Log Output'}
          </h3>
          {#if currentLogJob.status === 'running'}
            <div class="flex items-center text-sm text-green-600">
              <div class="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
              Live updating
            </div>
          {/if}
        </div>
        
        <div class="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
          {#if currentLogJob.logs && currentLogJob.logs.length > 0}
            {#each currentLogJob.logs as logLine}
              <div class="mb-1 {logLine.includes('ERROR') ? 'text-red-400' : logLine.includes('WARN') ? 'text-yellow-400' : logLine.includes('DEBUG') ? 'text-blue-400' : 'text-green-400'}">
                {logLine}
              </div>
            {/each}
          {:else}
            <div class="text-gray-500 italic">No logs available for this job.</div>
          {/if}
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
        <div class="text-sm text-gray-500">
          {currentLogJob.logs ? currentLogJob.logs.length : 0} log entries
        </div>
        <div class="flex space-x-3">
          <button 
            on:click={() => navigator.clipboard.writeText(currentLogJob.logs.join('\n'))}
            class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors">
            Copy Logs
          </button>
          <button 
            on:click={closeLogViewer}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}