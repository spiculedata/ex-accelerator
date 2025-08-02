<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { jobSchedulerService } from '$lib/services/jobSchedulerService';
  import type { JobScheduleRequest } from '$lib/services/jobSchedulerService';
  import type { JobState } from '$lib/services/jobStateStore';
  
  let activeTab = 'schedule';
  
  // Load job states from state store
  async function loadJobStates(forceRefresh = false) {
    loadingJobStates = true;
    try {
      // Add timestamp to bypass cache if forcing refresh
      const timestamp = forceRefresh ? `&t=${Date.now()}` : '';
      const response = await fetch(`/api/jobs?state=true${timestamp}`);
      
      if (response.ok) {
        jobStates = await response.json();
        console.log('Loaded job states:', jobStates.length, 'jobs found');
        
        // Convert job states to UI format
        crawlJobs = jobStates.map(state => ({
          id: state.id,
          name: state.name,
          status: state.status,
          progress: getProgressFromStatus(state.status, state.result?.itemsProcessed, state.jobData.maxPosts),
          startTime: state.createdAt,
          schedule: `Scheduled for ${new Date(state.scheduledFor).toLocaleString()}`,
          itemsCollected: state.result?.itemsProcessed || 0,
          totalEstimated: state.jobData.maxPosts || 0,
          platform: state.platform,
          crawlId: state.jobData.crawlId,
          crawlLabel: state.name,
          daprJobName: state.name,
          logs: state.executionLog || [],
          stateData: state,
          lastLogCount: state.executionLog?.length || 0,
          hasNewLogs: false // Reset new logs indicator
        }));
        
        console.log('UI jobs updated:', crawlJobs.length, 'jobs');
        
        // If there are running jobs, start global polling
        const runningJobs = crawlJobs.filter(job => job.status === 'running');
        if (runningJobs.length > 0 && !isGlobalPollingActive) {
          startGlobalJobMonitoring();
        }
      } else {
        console.error('Failed to load job states:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to load job states:', error);
    } finally {
      loadingJobStates = false;
    }
  }

  // Load job states for a specific job (for real-time updates)
  async function refreshJobState(jobId) {
    try {
      const response = await fetch(`/api/job-state?jobId=${jobId}`);
      if (response.ok) {
        const updatedState = await response.json();
        
        // Update the specific job in crawlJobs
        const jobIndex = crawlJobs.findIndex(job => job.id === jobId);
        if (jobIndex !== -1) {
          const previousLogCount = crawlJobs[jobIndex].lastLogCount || 0;
          const newLogCount = updatedState.executionLog?.length || 0;
          
          crawlJobs[jobIndex] = {
            ...crawlJobs[jobIndex],
            status: updatedState.status,
            progress: getProgressFromStatus(updatedState.status, updatedState.result?.itemsProcessed, updatedState.jobData.maxPosts),
            itemsCollected: updatedState.result?.itemsProcessed || 0,
            logs: updatedState.executionLog || [],
            stateData: updatedState,
            lastLogCount: newLogCount,
            hasNewLogs: newLogCount > previousLogCount // Flag for UI indication
          };
          
          // Update currentLogJob if it's the same job being viewed
          if (currentLogJob && currentLogJob.id === jobId) {
            currentLogJob = crawlJobs[jobIndex];
            
            // Auto-scroll to new logs if they were added
            if (newLogCount > previousLogCount && logScrollAnchor) {
              setTimeout(() => {
                logScrollAnchor?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }
          }
          
          // Trigger reactivity
          crawlJobs = [...crawlJobs];
        }
      }
    } catch (error) {
      console.error('Failed to refresh job state:', error);
    }
  }

  function getProgressFromStatus(status: string, itemsProcessed?: number, totalEstimated?: number): number {
    switch (status) {
      case 'scheduled': return 0;
      case 'running': 
        if (itemsProcessed && totalEstimated && totalEstimated > 0) {
          return Math.min(Math.round((itemsProcessed / totalEstimated) * 100), 99); // Cap at 99% for running jobs
        }
        return 25; // Default progress for running jobs without estimates
      case 'completed': return 100;
      case 'failed': return 0;
      case 'cancelled': return 0;
      default: return 0;
    }
  }

  // Check URL parameters on mount and load job states
  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['schedule', 'crawler', 'upload', 'princeton-smart', 'wavepulse'].includes(tabParam)) {
      activeTab = tabParam;
    }
    
    // Load job states from the state store
    loadJobStates();
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
    enabled: false,
    dueTime: 'now',
    schedulingMode: 'immediate' // immediate, delayed, scheduled
  };

  // Job scheduling state
  let isSchedulingJob = false;
  let schedulingError = '';
  let scheduledJobs: any[] = [];
  let jobStates: JobState[] = [];
  let loadingJobStates = true;
  
  // Global job monitoring
  let globalJobPollingInterval = null;
  let isGlobalPollingActive = false;
  
  // Crawl jobs loaded from state store
  let crawlJobs: any[] = [];

  // Function to format WavePulse time slots into schedule text
  function formatWavePulseSchedule(timeSlots: Array<{start: string, end: string}>): string {
    if (timeSlots.length === 0) return 'No schedule configured';
    if (timeSlots.length === 1) {
      return `Daily ${timeSlots[0].start} - ${timeSlots[0].end}`;
    }
    return `Daily (${timeSlots.length} time slots)`;
  }

  // Combine crawler jobs, WavePulse schedules, and Princeton SMART extracts
  $: allJobs = [
    ...crawlJobs,
    ...wavePulseConfig.radioStreams.map((stream, index) => ({
      id: `wavepulse-${index}`,
      name: `${stream.radioName || 'Unknown Station'} (${stream.state || 'Unknown'})`,
      type: 'wavepulse',
      status: wavePulseStatus === 'running' ? 'running' : wavePulseStatus === 'idle' ? 'scheduled' : wavePulseStatus,
      progress: wavePulseStatus === 'starting' ? wavePulseProgress : undefined,
      startTime: wavePulseResults?.startTime || null,
      schedule: formatWavePulseSchedule(stream.timeSlots),
      itemsCollected: wavePulseStatus === 'running' ? Math.floor(Math.random() * 500) : 0, // Mock data
      totalEstimated: wavePulseStatus === 'running' ? Math.floor(Math.random() * 1000) + 500 : 0,
      streamUrl: stream.url,
      logs: wavePulseStatus === 'running' ? [
        `[${new Date().toISOString()}] INFO: Started WavePulse for ${stream.radioName}`,
        `[${new Date().toISOString()}] INFO: Recording radio stream from ${stream.url}`,
        `[${new Date().toISOString()}] INFO: Transcription pipeline active`,
        wavePulseConfig.enableClassification ? `[${new Date().toISOString()}] INFO: Content classification enabled` : null,
        wavePulseConfig.enableDiarization ? `[${new Date().toISOString()}] INFO: Speaker diarization active` : null
      ].filter(Boolean) : []
    })),
    // Add Princeton SMART extract job (always show at least a sample)
    {
      id: 'princeton-smart-extract',
      name: princetonSmartConfig.datasetId 
        ? `Princeton SMART: ${princetonSmartConfig.datasetId}`
        : 'Princeton SMART: twitter-election-2024 (Sample)',
      type: 'princeton-smart',
      status: princetonSmartConfig.datasetId 
        ? (princetonSmartStatus === 'connecting' || princetonSmartStatus === 'fetching' ? 'running' : princetonSmartStatus === 'completed' ? 'completed' : princetonSmartStatus === 'error' ? 'failed' : 'scheduled')
        : 'scheduled',
      progress: princetonSmartStatus === 'fetching' ? princetonSmartProgress : undefined,
      startTime: princetonSmartResults?.startTime || null,
      nextRun: princetonSmartConfig.datasetId ? null : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now for demo
      schedule: princetonSmartConfig.datasetId 
        ? (princetonSmartConfig.dateRange.start && princetonSmartConfig.dateRange.end 
            ? `${princetonSmartConfig.dateRange.start} to ${princetonSmartConfig.dateRange.end}` 
            : 'Date range not configured')
        : '2024-01-01 to 2024-12-31',
      itemsCollected: princetonSmartResults?.recordCount || (princetonSmartConfig.datasetId ? 0 : 12547), // Sample data for demo
      totalEstimated: princetonSmartConfig.maxRecords || 50000,
      query: princetonSmartConfig.datasetId 
        ? (princetonSmartConfig.query || 'No query specified')
        : '#election2024 OR #vote2024',
      apiEndpoint: princetonSmartConfig.apiEndpoint,
      logs: princetonSmartConfig.datasetId && princetonSmartStatus !== 'idle' ? [
        `[${new Date().toISOString()}] INFO: Princeton SMART extract initiated`,
        `[${new Date().toISOString()}] INFO: Dataset: ${princetonSmartConfig.datasetId}`,
        `[${new Date().toISOString()}] INFO: Query: ${princetonSmartConfig.query || 'No query specified'}`,
        princetonSmartConfig.filters.language !== 'all' ? `[${new Date().toISOString()}] INFO: Language filter: ${princetonSmartConfig.filters.language}` : null,
        princetonSmartConfig.filters.location ? `[${new Date().toISOString()}] INFO: Location filter: ${princetonSmartConfig.filters.location}` : null,
        princetonSmartResults ? `[${new Date().toISOString()}] INFO: Extracted ${princetonSmartResults.recordCount} records` : null
      ].filter(Boolean) : [
        `[2025-01-29T14:30:00.000Z] INFO: Sample Princeton SMART configuration`,
        `[2025-01-29T14:30:00.000Z] INFO: Dataset: twitter-election-2024`,
        `[2025-01-29T14:30:00.000Z] INFO: Query: #election2024 OR #vote2024`,
        `[2025-01-29T14:30:00.000Z] INFO: Language filter: en`,
        `[2025-01-29T14:30:00.000Z] INFO: Location filter: United States`,
        `[2025-01-29T14:30:00.000Z] INFO: Configure dataset to activate extraction`
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

  // WavePulse configuration state
  let wavePulseConfig = {
    // API Configuration
    huggingFaceToken: '',
    geminiApiKey: '',
    
    // Component Control
    enableRecording: true,
    enableTranscription: true,
    enableClassification: true,
    enableDiarization: false,
    
    // Transcription Settings
    whisperModel: 'large-v3',
    batchSize: 16,
    computeType: 'float16',
    device: 'cuda', // cuda or cpu
    
    // Radio Stream Schedule
    radioStreams: [
      {
        url: 'https://example.com/stream',
        radioName: 'WXYZ',
        state: 'NY',
        timeSlots: [
          { start: '08:00', end: '14:00' },
          { start: '17:00', end: '22:00' }
        ]
      }
    ],
    
    // Recording Settings
    segmentDuration: 1800, // 30 minutes in seconds
    retries: 3,
    waitTime: 60,
    
    // Directory Configuration
    assetsDir: 'assets',
    dataDir: 'data',
    recordingsDir: 'recordings',
    transcriptsDir: 'transcripts',
    
    // Application Settings
    timezone: 'US/Eastern',
    shutdownTime: '03:00',
    restartTime: '03:10',
    
    // Analytics Settings
    sentimentAnalysis: false,
    narrativeTracking: false,
    
    // Backup Settings
    enableBackup: false,
    ftpServer: '',
    ftpUsername: '',
    ftpPassword: ''
  };
  
  let wavePulseStatus = 'idle'; // idle, starting, running, stopping, error
  let wavePulseProgress = 0;
  let wavePulseResults = null;

  // Log viewer state
  let showLogViewer = false;
  let currentLogJob = null;
  let logUpdateInterval = null;
  let logContainer = null;
  let logScrollAnchor = null;
  
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

  // WavePulse functions
  function resetWavePulseForm() {
    wavePulseConfig = {
      huggingFaceToken: '',
      geminiApiKey: '',
      enableRecording: true,
      enableTranscription: true,
      enableClassification: true,
      enableDiarization: false,
      whisperModel: 'large-v3',
      batchSize: 16,
      computeType: 'float16',
      device: 'cuda',
      radioStreams: [
        {
          url: 'https://example.com/stream',
          radioName: 'WXYZ',
          state: 'NY',
          timeSlots: [
            { start: '08:00', end: '14:00' },
            { start: '17:00', end: '22:00' }
          ]
        }
      ],
      segmentDuration: 1800,
      retries: 3,
      waitTime: 60,
      assetsDir: 'assets',
      dataDir: 'data',
      recordingsDir: 'recordings',
      transcriptsDir: 'transcripts',
      timezone: 'US/Eastern',
      shutdownTime: '03:00',
      restartTime: '03:10',
      sentimentAnalysis: false,
      narrativeTracking: false,
      enableBackup: false,
      ftpServer: '',
      ftpUsername: '',
      ftpPassword: ''
    };
    wavePulseStatus = 'idle';
    wavePulseProgress = 0;
    wavePulseResults = null;
  }

  function addRadioStream() {
    wavePulseConfig.radioStreams = [...wavePulseConfig.radioStreams, {
      url: '',
      radioName: '',
      state: '',
      timeSlots: [{ start: '08:00', end: '18:00' }]
    }];
  }

  function removeRadioStream(index: number) {
    wavePulseConfig.radioStreams = wavePulseConfig.radioStreams.filter((_, i) => i !== index);
  }

  function addTimeSlot(streamIndex: number) {
    wavePulseConfig.radioStreams[streamIndex].timeSlots = [
      ...wavePulseConfig.radioStreams[streamIndex].timeSlots,
      { start: '08:00', end: '18:00' }
    ];
  }

  function removeTimeSlot(streamIndex: number, slotIndex: number) {
    wavePulseConfig.radioStreams[streamIndex].timeSlots = 
      wavePulseConfig.radioStreams[streamIndex].timeSlots.filter((_, i) => i !== slotIndex);
  }

  async function handleWavePulseStart() {
    if (!wavePulseConfig.huggingFaceToken && wavePulseConfig.enableDiarization) {
      alert('Hugging Face token is required for speaker diarization');
      return;
    }
    
    if (!wavePulseConfig.geminiApiKey && wavePulseConfig.enableClassification) {
      alert('Google Gemini API key is required for content classification');
      return;
    }

    wavePulseStatus = 'starting';
    wavePulseProgress = 0;

    try {
      // Simulate WavePulse startup
      for (let i = 0; i <= 100; i += 10) {
        wavePulseProgress = i;
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      wavePulseResults = {
        status: 'Started WavePulse radio stream analysis',
        streamsConfigured: wavePulseConfig.radioStreams.length,
        componentsEnabled: {
          recording: wavePulseConfig.enableRecording,
          transcription: wavePulseConfig.enableTranscription,
          classification: wavePulseConfig.enableClassification,
          diarization: wavePulseConfig.enableDiarization
        },
        startTime: new Date().toISOString()
      };
      
      wavePulseStatus = 'running';
      
    } catch (error) {
      console.error('WavePulse startup error:', error);
      wavePulseStatus = 'error';
    }
  }

  async function handleWavePulseStop() {
    wavePulseStatus = 'stopping';
    
    try {
      // Simulate stopping WavePulse
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      wavePulseStatus = 'idle';
      wavePulseResults = null;
      
    } catch (error) {
      console.error('WavePulse stop error:', error);
      wavePulseStatus = 'error';
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
  
  async function saveCrawlerJob() {
    if (!validateForm()) {
      return;
    }

    isSchedulingJob = true;
    schedulingError = '';

    try {
      // Calculate due time based on scheduling mode
      let dueTime = '10s'; // Default to 10 seconds for immediate execution
      if (scheduleConfig.schedulingMode === 'delayed') {
        // Convert time formats to seconds that Dapr accepts
        const timeValue = scheduleConfig.dueTime;
        if (timeValue.endsWith('s')) {
          dueTime = timeValue; // Already in seconds
        } else if (timeValue.endsWith('m')) {
          const minutes = parseInt(timeValue.slice(0, -1));
          dueTime = `${minutes * 60}s`; // Convert to seconds
        } else if (timeValue.endsWith('h')) {
          const hours = parseInt(timeValue.slice(0, -1));
          dueTime = `${hours * 3600}s`; // Convert to seconds
        } else {
          dueTime = '10s'; // Fallback
        }
      } else if (scheduleConfig.schedulingMode === 'scheduled') {
        const scheduledDate = new Date();
        const [hours, minutes] = scheduleConfig.time.split(':');
        scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // If the time has passed today, schedule for tomorrow
        if (scheduledDate.getTime() <= Date.now()) {
          scheduledDate.setDate(scheduledDate.getDate() + 1);
        }
        
        // Convert to seconds from now
        const secondsFromNow = Math.floor((scheduledDate.getTime() - Date.now()) / 1000);
        dueTime = `${Math.max(10, secondsFromNow)}s`; // Minimum 10 seconds
      }

      // Use registered job handler name from telegram-scraper
      const jobName = 'my-scheduled-job'; // Must match registered handler

      // Build job request
      const jobRequest: JobScheduleRequest = {
        name: jobName,
        dueTime: dueTime,
        data: {
          droid: jobName,
          task: `crawl ${crawlerConfig.platform} channels`,
          urls: crawlerConfig.urls.filter(url => url.trim()),
          platform: crawlerConfig.platform as 'telegram' | 'youtube',
          crawlId: crawlerConfig.crawlId || undefined,
          maxDepth: crawlerConfig.maxDepth > 0 ? crawlerConfig.maxDepth : undefined,
          concurrency: crawlerConfig.concurrency,
          maxPosts: crawlerConfig.maxPosts > 0 ? crawlerConfig.maxPosts : undefined,
          skipMedia: crawlerConfig.skipMediaDownload,
          timeAgo: crawlerConfig.timeAgo || undefined,
          minPostDate: crawlerConfig.minPostDate || undefined
        }
      };

      // Add platform-specific configuration
      if (crawlerConfig.platform === 'youtube' && crawlerConfig.youtubeApiKey) {
        jobRequest.data.youtubeApiKey = crawlerConfig.youtubeApiKey;
        jobRequest.data.samplingMethod = crawlerConfig.samplingMethod;
        jobRequest.data.minChannelVideos = crawlerConfig.minChannelVideos;
      }

      // Schedule the job
      const result = await jobSchedulerService.scheduleJob(jobRequest);
      console.log('Job scheduled successfully:', result);

      // Reload job states from state store to reflect the new job
      await loadJobStates();
      
      // Reset form
      resetCrawlerForm();
      
      // Go back to schedule tab to see the created job
      activeTab = 'schedule';
      
    } catch (error) {
      console.error('Failed to schedule crawler job:', error);
      schedulingError = error instanceof Error ? error.message : 'Failed to schedule job';
    } finally {
      isSchedulingJob = false;
    }
  }

  function resetCrawlerForm() {
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
      case 'completed': return 'text-blue-600 bg-blue-100';
      case 'scheduled': return 'text-blue-600 bg-blue-100';
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
    
    // Clear new logs indicator
    const jobIndex = crawlJobs.findIndex(j => j.id === job.id);
    if (jobIndex !== -1) {
      crawlJobs[jobIndex].hasNewLogs = false;
      crawlJobs = [...crawlJobs]; // Trigger reactivity
    }
    
    // For running jobs, start real-time log updates
    if (job.status === 'running') {
      startRealTimeLogUpdates(job.id);
    }
    
    // Auto-scroll to bottom initially
    setTimeout(() => {
      if (logScrollAnchor) {
        logScrollAnchor.scrollIntoView({ behavior: 'smooth' });
      }
    }, 200);
  }

  function closeLogViewer() {
    showLogViewer = false;
    currentLogJob = null;
    stopRealTimeLogUpdates();
  }

  // Real-time log update functions
  function startRealTimeLogUpdates(jobId) {
    if (logUpdateInterval) {
      clearInterval(logUpdateInterval);
    }
    
    // Immediately refresh the job state
    refreshJobState(jobId);
    
    // Set up periodic updates every 2 seconds for running jobs
    logUpdateInterval = setInterval(async () => {
      await refreshJobState(jobId);
      
      // Stop polling if job is no longer running
      if (currentLogJob && currentLogJob.status !== 'running') {
        clearInterval(logUpdateInterval);
        logUpdateInterval = null;
      }
    }, 2000);
  }

  function stopRealTimeLogUpdates() {
    if (logUpdateInterval) {
      clearInterval(logUpdateInterval);
      logUpdateInterval = null;
    }
  }

  // Global job monitoring functions
  function startGlobalJobMonitoring() {
    if (isGlobalPollingActive) return;
    
    isGlobalPollingActive = true;
    
    // Check for running jobs and start polling if any exist
    const runningJobs = crawlJobs.filter(job => job.status === 'running');
    
    if (runningJobs.length > 0) {
      globalJobPollingInterval = setInterval(async () => {
        const currentRunningJobs = crawlJobs.filter(job => job.status === 'running');
        
        // Also check recently completed jobs (within last 5 minutes) for any final updates
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentlyCompletedJobs = crawlJobs.filter(job => {
          if (job.status !== 'completed' && job.status !== 'failed') return false;
          
          // Check if job was updated recently
          const updatedAt = new Date(job.stateData?.updatedAt || job.startTime);
          return updatedAt > fiveMinutesAgo;
        });
        
        const jobsToCheck = [...currentRunningJobs, ...recentlyCompletedJobs];
        
        // If no jobs to check, stop polling
        if (jobsToCheck.length === 0) {
          stopGlobalJobMonitoring();
          return;
        }
        
        // Update all jobs that need checking
        for (const job of jobsToCheck) {
          await refreshJobState(job.id);
        }
      }, 5000); // Poll every 5 seconds for global updates
    } else {
      isGlobalPollingActive = false;
    }
  }

  function stopGlobalJobMonitoring() {
    if (globalJobPollingInterval) {
      clearInterval(globalJobPollingInterval);
      globalJobPollingInterval = null;
    }
    isGlobalPollingActive = false;
  }

  // Auto-start monitoring when jobs are loaded or status changes
  $: {
    if (crawlJobs && crawlJobs.length > 0) {
      const hasRunningJobs = crawlJobs.some(job => job.status === 'running');
      if (hasRunningJobs && !isGlobalPollingActive) {
        startGlobalJobMonitoring();
      } else if (!hasRunningJobs && isGlobalPollingActive) {
        stopGlobalJobMonitoring();
      }
    }
  }

  // Cleanup on component destroy
  onDestroy(() => {
    stopGlobalJobMonitoring();
    stopRealTimeLogUpdates();
  });
</script>

<svelte:head>
  <title>Data Capture - Social Explorer</title>
  <meta name="description" content="Data collection and capture tools for social media platforms" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="relative bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 overflow-hidden">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-gradient-to-br from-emerald-900/10 to-slate-900/10 opacity-40"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Data Capture & Collection</h1>
            <p class="text-slate-300 text-lg font-medium">Web Crawling • File Upload • Smart Data Integration</p>
            <div class="flex items-center mt-3 space-x-4">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                🌐 Multi-Platform
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                📊 Real-time Monitoring
              </span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                ⚡ High Performance
              </span>
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          <div class="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
            <div class="text-white text-sm font-medium">
              {crawlJobs.filter(job => job.status === 'running').length} jobs running
            </div>
          </div>
          <button 
            on:click={() => loadJobStates(true)}
            disabled={loadingJobStates}
            class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg class="w-4 h-4 mr-2 {loadingJobStates ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            {loadingJobStates ? 'Refreshing...' : 'Refresh Jobs'}
          </button>
          <button 
            class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center border border-white/20">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            View Analytics
          </button>
          <button 
            class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            New Collection
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="bg-white border-b border-gray-200">
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex space-x-8">
        <button 
          class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'schedule' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'schedule'}>
          Schedule & Status
        </button>
        <button 
          class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'crawler' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'crawler'}>
          Web Crawler
        </button>
        <button 
          class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'upload' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'upload'}>
          File Upload
        </button>
        <button 
          class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'princeton-smart' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'princeton-smart'}>
          Princeton SMART
        </button>
        <button 
          class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'wavepulse' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'wavepulse'}>
          WavePulse
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
                        ? 'bg-blue-600 border-blue-600 text-white' 
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
        <div class="bg-white rounded-xl shadow-sm p-8">
          
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
                    class="w-full px-3 py-2 border {crawlerConfig.name.trim() ? 'border-gray-300' : 'border-red-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
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
                      class="text-blue-600 focus:ring-blue-500">
                    <span class="ml-2 text-sm text-gray-700">Telegram</span>
                  </label>
                  <label class="flex items-center">
                    <input 
                      bind:group={crawlerConfig.platform}
                      type="radio" 
                      value="youtube"
                      class="text-blue-600 focus:ring-blue-500">
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
                          class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors">
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
                          class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <button 
                          on:click={() => removeUrl(i)}
                          class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors">
                          Remove
                        </button>
                      </div>
                    {/each}
                    <button 
                      on:click={() => crawlerConfig.urls = [...crawlerConfig.urls, '']}
                      class="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                      <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                      </svg>
                      Add URL
                    </button>
                  </div>
                  {#if urlUploadFiles && urlUploadFiles.length > 0}
                    <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl">
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
                    class="w-full px-3 py-2 border {(crawlerConfig.urls.length > 0 || crawlerConfig.urlFileURL.trim()) ? 'border-gray-300' : 'border-red-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                              class="flex-1 px-3 py-2 border {crawlerConfig.tdlibDatabaseURLs.length > 0 && crawlerConfig.tdlibDatabaseURLs.some(u => u.trim()) ? 'border-gray-300' : 'border-red-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <button 
                              on:click={() => removeTdlibUrl(i)}
                              class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              Remove
                            </button>
                          </div>
                        {/each}
                        <button 
                          on:click={() => crawlerConfig.tdlibDatabaseURLs = [...crawlerConfig.tdlibDatabaseURLs, '']}
                          class="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
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
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
              <div class="border border-gray-200 rounded-xl p-4">
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
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  </div>
                </div>
              </div>

              <!-- Limits -->
              <div class="border border-gray-200 rounded-xl p-4">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-lg font-medium text-gray-900">Crawl Limits</h3>
                  <button 
                    type="button"
                    on:click={() => showCrawlLimits = !showCrawlLimits}
                    class="flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors">
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
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                      class="text-blue-600 focus:ring-blue-500">
                    <span class="ml-2 text-sm text-gray-700">Channel</span>
                  </label>
                  <label class="flex items-center">
                    <input 
                      bind:group={crawlerConfig.samplingMethod}
                      type="radio" 
                      value="random"
                      class="text-blue-600 focus:ring-blue-500">
                    <span class="ml-2 text-sm text-gray-700">Random</span>
                  </label>
                  <label class="flex items-center">
                    <input 
                      bind:group={crawlerConfig.samplingMethod}
                      type="radio" 
                      value="snowball"
                      class="text-blue-600 focus:ring-blue-500">
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
              <div class="border border-gray-200 rounded-xl p-4">
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

              <!-- Job Scheduling Configuration -->
              <div class="border border-gray-200 rounded-xl p-4">
                <div class="mb-4">
                  <h3 class="text-lg font-medium text-gray-900 mb-2">Job Scheduling</h3>
                  <p class="text-sm text-gray-600">Configure when and how your crawler job should be executed using Dapr Jobs.</p>
                </div>
                
                <!-- Scheduling Mode -->
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-2">Execution Mode</label>
                  <div class="space-y-2">
                    <label class="flex items-center">
                      <input 
                        bind:group={scheduleConfig.schedulingMode}
                        type="radio" 
                        value="immediate"
                        class="text-blue-600 focus:ring-blue-500">
                      <span class="ml-2 text-sm text-gray-700">Run immediately</span>
                      <span class="ml-2 text-xs text-gray-500">(Execute as soon as job is created)</span>
                    </label>
                    <label class="flex items-center">
                      <input 
                        bind:group={scheduleConfig.schedulingMode}
                        type="radio" 
                        value="delayed"
                        class="text-blue-600 focus:ring-blue-500">
                      <span class="ml-2 text-sm text-gray-700">Run with delay</span>
                      <span class="ml-2 text-xs text-gray-500">(Execute after a specified delay)</span>
                    </label>
                    <label class="flex items-center">
                      <input 
                        bind:group={scheduleConfig.schedulingMode}
                        type="radio" 
                        value="scheduled"
                        class="text-blue-600 focus:ring-blue-500">
                      <span class="ml-2 text-sm text-gray-700">Run at specific time</span>
                      <span class="ml-2 text-xs text-gray-500">(Execute at a specific date and time)</span>
                    </label>
                  </div>
                </div>

                <!-- Delayed Execution Configuration -->
                {#if scheduleConfig.schedulingMode === 'delayed'}
                  <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Delay Time</label>
                    <div class="flex space-x-2">
                      <select 
                        bind:value={scheduleConfig.dueTime}
                        class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="30s">30 seconds</option>
                        <option value="1m">1 minute</option>
                        <option value="5m">5 minutes</option>
                        <option value="15m">15 minutes</option>
                        <option value="30m">30 minutes</option>
                        <option value="1h">1 hour</option>
                        <option value="2h">2 hours</option>
                        <option value="6h">6 hours</option>
                        <option value="12h">12 hours</option>
                        <option value="1d">1 day</option>
                      </select>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Job will be executed after the specified delay from creation time.</p>
                  </div>
                {/if}

                <!-- Scheduled Execution Configuration -->
                {#if scheduleConfig.schedulingMode === 'scheduled'}
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Time</label>
                      <input 
                        bind:value={scheduleConfig.time}
                        type="time"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                      <select 
                        bind:value={scheduleConfig.timezone}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">EST</option>
                        <option value="America/Los_Angeles">PST</option>
                        <option value="Europe/London">GMT</option>
                      </select>
                    </div>
                  </div>
                  <p class="text-xs text-gray-500">Job will be executed at the specified time today (or tomorrow if time has passed).</p>
                {/if}

                <!-- Error Display -->
                {#if schedulingError}
                  <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div class="flex">
                      <svg class="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div>
                        <h4 class="text-sm font-medium text-red-800">Scheduling Error</h4>
                        <p class="text-sm text-red-700 mt-1">{schedulingError}</p>
                      </div>
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
                  disabled={!validateForm() || isSchedulingJob}
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors flex items-center">
                  {#if isSchedulingJob}
                    <svg class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Scheduling Job...
                  {:else}
                    Schedule Crawler Job
                  {/if}
                </button>
              {:else}
                <button 
                  on:click={nextStep}
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors">
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
        <div class="bg-white rounded-xl shadow-sm p-8">
          <h2 class="text-xl font-semibold text-gray-900 mb-6">Upload Data Files</h2>
          
          <!-- Upload Area -->
          <div class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-6">
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
              class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md cursor-pointer transition-colors">
              Select Files
            </label>
          </div>

          <!-- File List -->
          {#if uploadFiles && uploadFiles.length > 0}
            <div class="mb-6">
              <h3 class="text-sm font-medium text-gray-900 mb-3">Selected Files</h3>
              <div class="space-y-2">
                {#each Array.from(uploadFiles) as file}
                  <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
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
                <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {uploadProgress}%"></div>
              </div>
            </div>
          {:else if uploadStatus === 'completed'}
            <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="text-sm font-medium text-blue-800">Files uploaded successfully!</span>
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
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea 
                  placeholder="Describe the data source and its purpose..."
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
              </div>
              <div class="flex items-center">
                <input type="checkbox" id="auto-parse" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
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
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors">
              Upload Files
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Princeton SMART Tab -->
    {#if activeTab === 'princeton-smart'}
      <div class="max-w-4xl mx-auto">
        <div class="bg-white rounded-xl shadow-sm p-8">
          <div class="flex items-center mb-6">
            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-4">
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
            <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
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
            <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span class="text-sm font-medium text-blue-800">Data imported successfully!</span>
                </div>
                {#if princetonSmartResults}
                  <span class="text-sm text-blue-600">{princetonSmartResults.recordCount} records imported</span>
                {/if}
              </div>
            </div>
          {:else if princetonSmartStatus === 'error'}
            <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
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
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-2xl font-bold text-emerald-600 mb-1">{allJobs.filter(job => job.status === 'running').length}</div>
            <div class="text-sm text-gray-600">Running</div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-2xl font-bold text-blue-600 mb-1">{allJobs.filter(job => job.status === 'scheduled').length}</div>
            <div class="text-sm text-gray-600">Scheduled</div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-2xl font-bold text-indigo-600 mb-1">{allJobs.filter(job => job.status === 'completed').length}</div>
            <div class="text-sm text-gray-600">Completed</div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-2xl font-bold text-rose-600 mb-1">{allJobs.filter(job => job.status === 'failed').length}</div>
            <div class="text-sm text-gray-600">Failed</div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-2xl font-bold text-amber-600 mb-1">{allJobs.filter(job => job.type === 'wavepulse').length}</div>
            <div class="text-sm text-gray-600">Radio Streams</div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-2xl font-bold text-purple-600 mb-1">{allJobs.filter(job => job.type === 'princeton-smart').length}</div>
            <div class="text-sm text-gray-600">SMART Extracts</div>
          </div>
        </div>

        <!-- Jobs List -->
        <div class="bg-white rounded-xl shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">All Scheduled Jobs</h2>
              {#if loadingJobStates}
                <div class="flex items-center text-sm text-gray-500">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading jobs...
                </div>
              {:else}
                <button 
                  on:click={loadJobStates}
                  class="flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Refresh
                </button>
              {/if}
            </div>
          </div>
          <div class="divide-y divide-gray-200">
            {#if loadingJobStates}
              <div class="p-6 text-center text-gray-500">
                <svg class="mx-auto h-8 w-8 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="mt-2">Loading job states from Dapr state store...</p>
              </div>
            {:else if allJobs.length === 0}
              <div class="p-6 text-center text-gray-500">
                <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
                <p class="mt-2">No jobs scheduled yet</p>
                <p class="text-sm">Create a new crawl job to get started</p>
              </div>
            {:else}
              {#each allJobs as job}
              <div class="p-6" data-job-id="{job.id}" data-job-type="{job.type}">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center">
                    {#if job.type === 'wavepulse'}
                      <svg class="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828a2 2 0 01-1.414-.586l5-5A2 2 0 009 12.172V5L8 4z"></path>
                      </svg>
                    {:else if job.type === 'princeton-smart'}
                      <svg class="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                      </svg>
                    {:else}
                      <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0 9c-5 0-9-4-9-9m9 9c5 0 9-4 9-9m0-9v9"></path>
                      </svg>
                    {/if}
                    <h3 class="text-lg font-medium text-gray-900 mr-3">{job.name}</h3>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(job.status)}">
                      {job.status}
                    </span>
                    {#if job.type === 'wavepulse'}
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 ml-2">
                        Radio Stream
                      </span>
                    {:else if job.type === 'princeton-smart'}
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 ml-2">
                        SMART Extract
                      </span>
                    {/if}
                  </div>
                  <div class="flex items-center space-x-2">
                    {#if job.type === 'wavepulse'}
                      {#if job.status === 'scheduled' || job.status === 'idle'}
                        <button 
                          on:click={handleWavePulseStart}
                          class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-md transition-colors">
                          Start Stream
                        </button>
                      {:else if job.status === 'running'}
                        <button 
                          on:click={handleWavePulseStop}
                          class="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-sm rounded-md transition-colors">
                          Stop Stream
                        </button>
                      {/if}
                      <button 
                        on:click={() => activeTab = 'wavepulse'}
                        class="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors">
                        Configure
                      </button>
                    {:else if job.type === 'princeton-smart'}
                      {#if job.status === 'scheduled' || job.status === 'idle' || job.status === 'error'}
                        <button 
                          on:click={handlePrincetonSmartImport}
                          class="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md transition-colors">
                          Run Extract
                        </button>
                      {/if}
                      <button 
                        on:click={() => activeTab = 'princeton-smart'}
                        class="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors">
                        Configure
                      </button>
                    {:else}
                      {#if job.status === 'scheduled' || job.status === 'pending'}
                        <button 
                          on:click={() => runCrawl(job.id)}
                          class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors">
                          Run Now
                        </button>
                      {/if}
                      <button class="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors">
                        Edit
                      </button>
                    {/if}
                    {#if job.logs && job.logs.length > 0}
                      <button 
                        on:click={() => openLogViewer(job)}
                        class="relative px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors">
                        View Logs
                        {#if job.hasNewLogs}
                          <span class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                        {/if}
                        {#if job.status === 'running'}
                          <span class="ml-1 inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        {/if}
                      </button>
                    {/if}
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-{job.type === 'wavepulse' ? '4' : '3'} gap-4 mb-4">
                  <div>
                    <div class="text-sm text-gray-500">Schedule</div>
                    <div class="text-sm font-medium text-gray-900">{job.schedule}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500">{job.type === 'wavepulse' ? 'Audio Segments' : 'Items Collected'}</div>
                    <div class="text-sm font-medium text-gray-900">{(job.itemsCollected || 0).toLocaleString()}</div>
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
                  {#if job.type === 'wavepulse' && job.streamUrl}
                    <div>
                      <div class="text-sm text-gray-500">Stream URL</div>
                      <div class="text-sm font-medium text-gray-900 truncate" title="{job.streamUrl}">
                        {job.streamUrl || 'Not configured'}
                      </div>
                    </div>
                  {/if}
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
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- WavePulse Tab -->
    {#if activeTab === 'wavepulse'}
      <div class="max-w-6xl mx-auto">
        <div class="mb-8">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-2xl font-semibold text-gray-900">WavePulse Radio Stream Analytics</h2>
              <p class="text-gray-600">Real-time content analytics of radio livestreams with transcription and AI analysis</p>
            </div>
            <div class="flex space-x-3">
              {#if wavePulseStatus === 'idle'}
                <button 
                  on:click={handleWavePulseStart}
                  class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                  Start WavePulse
                </button>
              {:else if wavePulseStatus === 'running'}
                <button 
                  on:click={handleWavePulseStop}
                  class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                  Stop WavePulse
                </button>
              {/if}
              <button 
                on:click={resetWavePulseForm}
                class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                Reset
              </button>
            </div>
          </div>

          <!-- Status Display -->
          {#if wavePulseStatus !== 'idle'}
            <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-blue-800">Status: {wavePulseStatus}</span>
                {#if wavePulseStatus === 'starting'}
                  <span class="text-sm text-blue-600">{wavePulseProgress}%</span>
                {/if}
              </div>
              {#if wavePulseStatus === 'starting'}
                <div class="w-full bg-blue-200 rounded-full h-2">
                  <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {wavePulseProgress}%"></div>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Configuration Form -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            <!-- Left Column: API Configuration & Components -->
            <div class="space-y-6">
              
              <!-- API Configuration -->
              <div class="bg-white border border-gray-200 rounded-xl p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg class="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2h3m-3 0l-1-1m1 1l-1 1m-1-1v4"></path>
                  </svg>
                  API Configuration
                </h3>
                
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Hugging Face Token
                      <span class="text-gray-500">(Required for speaker diarization)</span>
                    </label>
                    <input 
                      bind:value={wavePulseConfig.huggingFaceToken}
                      type="password" 
                      placeholder="hf_..."
                      class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <p class="text-xs text-gray-500 mt-1">Get your token at <a href="https://huggingface.co/settings/tokens" target="_blank" class="text-blue-600 hover:underline">huggingface.co/settings/tokens</a></p>
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Google Gemini API Key
                      <span class="text-gray-500">(Required for content classification)</span>
                    </label>
                    <input 
                      bind:value={wavePulseConfig.geminiApiKey}
                      type="password" 
                      placeholder="AIza..."
                      class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <p class="text-xs text-gray-500 mt-1">Get your key at <a href="https://ai.google.dev/aistudio" target="_blank" class="text-blue-600 hover:underline">ai.google.dev/aistudio</a></p>
                  </div>
                </div>
              </div>

              <!-- Component Control -->
              <div class="bg-white border border-gray-200 rounded-xl p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg class="w-5 h-5 text-emerald-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Pipeline Components
                </h3>
                
                <div class="space-y-3">
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={wavePulseConfig.enableRecording} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    <span class="ml-2 text-sm text-gray-700">Enable Recording</span>
                  </label>
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={wavePulseConfig.enableTranscription} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    <span class="ml-2 text-sm text-gray-700">Enable Transcription</span>
                  </label>
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={wavePulseConfig.enableClassification} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    <span class="ml-2 text-sm text-gray-700">Enable Content Classification</span>
                  </label>
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={wavePulseConfig.enableDiarization} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    <span class="ml-2 text-sm text-gray-700">Enable Speaker Diarization</span>
                  </label>
                </div>
              </div>

              <!-- Transcription Settings -->
              <div class="bg-white border border-gray-200 rounded-xl p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg class="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4"></path>
                  </svg>
                  Transcription Settings
                </h3>
                
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Whisper Model</label>
                    <select bind:value={wavePulseConfig.whisperModel} class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="large-v3">Large V3 (Best Quality)</option>
                      <option value="large-v2">Large V2</option>
                      <option value="medium">Medium (Faster)</option>
                      <option value="small">Small (Fastest)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Device</label>
                    <select bind:value={wavePulseConfig.device} class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="cuda">CUDA (GPU)</option>
                      <option value="cpu">CPU</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Batch Size</label>
                    <input 
                      bind:value={wavePulseConfig.batchSize}
                      type="number" 
                      min="1" 
                      max="32"
                      class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Compute Type</label>
                    <select bind:value={wavePulseConfig.computeType} class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="float16">Float16 (Faster)</option>
                      <option value="float32">Float32 (More Accurate)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Radio Streams Configuration -->
            <div class="space-y-6">
              
              <!-- Radio Streams -->
              <div class="bg-white border border-gray-200 rounded-xl p-6">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-lg font-semibold text-gray-900 flex items-center">
                    <svg class="w-5 h-5 text-rose-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828a2 2 0 01-1.414-.586l5-5A2 2 0 009 12.172V5L8 4z"></path>
                    </svg>
                    Radio Streams ({wavePulseConfig.radioStreams.length})
                  </h3>
                  <button 
                    on:click={addRadioStream}
                    class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-sm font-medium transition-colors">
                    Add Stream
                  </button>
                </div>
                
                <div class="space-y-4 max-h-96 overflow-y-auto">
                  {#each wavePulseConfig.radioStreams as stream, streamIndex}
                    <div class="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div class="flex items-center justify-between">
                        <span class="text-sm font-medium text-gray-700">Stream {streamIndex + 1}</span>
                        <button 
                          on:click={() => removeRadioStream(streamIndex)}
                          class="text-rose-600 hover:text-rose-800 text-sm">
                          Remove
                        </button>
                      </div>
                      
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs font-medium text-gray-600 mb-1">Radio Name</label>
                          <input 
                            bind:value={stream.radioName}
                            placeholder="WXYZ"
                            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-gray-600 mb-1">State</label>
                          <input 
                            bind:value={stream.state}
                            placeholder="NY"
                            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
                        </div>
                      </div>
                      
                      <div>
                        <label class="block text-xs font-medium text-gray-600 mb-1">Stream URL</label>
                        <input 
                          bind:value={stream.url}
                          placeholder="https://example.com/stream"
                          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
                      </div>
                      
                      <div>
                        <div class="flex items-center justify-between mb-2">
                          <label class="block text-xs font-medium text-gray-600">Time Slots</label>
                          <button 
                            on:click={() => addTimeSlot(streamIndex)}
                            class="text-blue-600 hover:text-blue-800 text-xs">
                            Add Slot
                          </button>
                        </div>
                        <div class="space-y-2">
                          {#each stream.timeSlots as slot, slotIndex}
                            <div class="flex items-center space-x-2">
                              <input 
                                bind:value={slot.start}
                                type="time"
                                class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                              <span class="text-xs text-gray-500">to</span>
                              <input 
                                bind:value={slot.end}
                                type="time"
                                class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                              <button 
                                on:click={() => removeTimeSlot(streamIndex, slotIndex)}
                                class="text-rose-600 hover:text-rose-800 text-xs">
                                ×
                              </button>
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>

              <!-- Advanced Settings -->
              <div class="bg-white border border-gray-200 rounded-xl p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg class="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  Advanced Settings
                </h3>
                
                <div class="space-y-4">
                  <div class="grid grid-cols-3 gap-3">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Segment Duration (sec)</label>
                      <input 
                        bind:value={wavePulseConfig.segmentDuration}
                        type="number" 
                        min="300"
                        class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Retries</label>
                      <input 
                        bind:value={wavePulseConfig.retries}
                        type="number" 
                        min="1"
                        class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Wait Time (sec)</label>
                      <input 
                        bind:value={wavePulseConfig.waitTime}
                        type="number" 
                        min="10"
                        class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                      <select bind:value={wavePulseConfig.timezone} class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="US/Eastern">US/Eastern</option>
                        <option value="US/Central">US/Central</option>
                        <option value="US/Mountain">US/Mountain</option>
                        <option value="US/Pacific">US/Pacific</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Assets Directory</label>
                      <input 
                        bind:value={wavePulseConfig.assetsDir}
                        placeholder="assets"
                        class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                  </div>

                  <!-- Analytics Options -->
                  <div class="border-t pt-4 mt-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-3">Analytics Features</h4>
                    <div class="space-y-2">
                      <label class="flex items-center">
                        <input type="checkbox" bind:checked={wavePulseConfig.sentimentAnalysis} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                        <span class="ml-2 text-sm text-gray-700">Enable Sentiment Analysis</span>
                      </label>
                      <label class="flex items-center">
                        <input type="checkbox" bind:checked={wavePulseConfig.narrativeTracking} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                        <span class="ml-2 text-sm text-gray-700">Enable Narrative Tracking</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Results Display -->
          {#if wavePulseResults}
            <div class="mt-8 bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <h3 class="text-lg font-semibold text-emerald-800 mb-4">WavePulse Status</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white rounded-lg p-4">
                  <div class="text-2xl font-bold text-emerald-600">{wavePulseResults.streamsConfigured}</div>
                  <div class="text-sm text-gray-600">Radio Streams</div>
                </div>
                <div class="bg-white rounded-lg p-4">
                  <div class="text-2xl font-bold text-emerald-600">
                    {Object.values(wavePulseResults.componentsEnabled).filter(Boolean).length}
                  </div>
                  <div class="text-sm text-gray-600">Components Active</div>
                </div>
                <div class="bg-white rounded-lg p-4">
                  <div class="text-2xl font-bold text-emerald-600">
                    {new Date(wavePulseResults.startTime).toLocaleTimeString()}
                  </div>
                  <div class="text-sm text-gray-600">Started At</div>
                </div>
              </div>
              
              <div class="mt-4 text-sm text-emerald-700">
                <p><strong>Status:</strong> {wavePulseResults.status}</p>
                <p><strong>Components:</strong> 
                  {Object.entries(wavePulseResults.componentsEnabled).filter(([, enabled]) => enabled).map(([name]) => name).join(', ')}
                </p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Log Viewer Modal -->
{#if showLogViewer && currentLogJob}
  <div class="fixed inset-0 bg-gray-500/20 backdrop-blur-sm flex items-center justify-center z-50 p-4" on:click={closeLogViewer}>
    <div class="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col" on:click|stopPropagation>
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
            <span class="ml-2 text-gray-900">{(currentLogJob.itemsCollected || 0).toLocaleString()}</span>
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
            <div class="flex items-center space-x-4">
              <div class="flex items-center text-sm text-blue-600">
                <div class="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                Live updating
              </div>
              <div class="text-xs text-gray-500">
                Updates every 2 seconds
              </div>
            </div>
          {/if}
        </div>
        
        <div 
          bind:this={logContainer}
          class="bg-gray-900 rounded-xl p-4 h-96 overflow-y-auto font-mono text-sm">
          {#if currentLogJob.logs && currentLogJob.logs.length > 0}
            {#each currentLogJob.logs as logLine, index}
              <div class="mb-1 {logLine.includes('ERROR') ? 'text-red-400' : logLine.includes('WARN') ? 'text-yellow-400' : logLine.includes('DEBUG') ? 'text-blue-400' : logLine.includes('INFO') ? 'text-green-400' : 'text-gray-300'}">
                <span class="text-gray-500 text-xs mr-2">{index + 1}</span>
                {logLine}
              </div>
            {/each}
            <!-- Auto-scroll anchor -->
            <div bind:this={logScrollAnchor}></div>
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