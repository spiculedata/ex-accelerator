<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { jobSchedulerService } from '$lib/services/jobSchedulerService';
  import ErrorAlert from '$lib/components/ui/ErrorAlert.svelte';
  import { describeJobStateFailure, type JobStateProblem } from '$lib/utils/jobStateProblem';
  import JobProblemAlert from '$lib/components/data-capture/JobProblemAlert.svelte';
  import CrawlerTab from '$lib/components/data-capture/CrawlerTab.svelte';
  import UploadTab from '$lib/components/data-capture/UploadTab.svelte';
  import PrincetonSmartTab from '$lib/components/data-capture/PrincetonSmartTab.svelte';
  import ScheduleTab from '$lib/components/data-capture/ScheduleTab.svelte';
  import WavePulseTab from '$lib/components/data-capture/WavePulseTab.svelte';
  import AnalyticsTab from '$lib/components/data-capture/AnalyticsTab.svelte';
  import LogViewerModal from '$lib/components/data-capture/LogViewerModal.svelte';
  import DeleteJobModal from '$lib/components/data-capture/DeleteJobModal.svelte';
  import JobErrorModal from '$lib/components/data-capture/JobErrorModal.svelte';
  import DataCaptureTabs from '$lib/components/data-capture/DataCaptureTabs.svelte';
  import type { JobState } from '$lib/services/jobStateStore';
  import {
    createDefaultCrawlerConfig,
    createDefaultPrincetonSmartConfig,
    createDefaultScheduleConfig,
    createDefaultWavePulseConfig,
    crawlerConfigFromJobData
  } from '$lib/utils/dataCapture/configDefaults';
  import {
    getUrlValidationErrors,
    isJobNameUnique,
    validateCurrentStep,
    validateForm
  } from '$lib/utils/dataCapture/crawlerValidation';
  import {
    applyJobStateUpdate,
    buildAnalyticsData,
    isNearBottom,
    jobStateToUiJob,
    parseTabParam,
    selectJobsToPoll,
    sortJobs,
    wavePulseStreamsToJobs
  } from '$lib/utils/dataCapture/jobList';
  import {
    buildCrawlerJobName,
    buildCrawlerJobRequest,
    buildRunNowPayload,
    computeDueTime,
    parseNewUrls,
    readRunError
  } from '$lib/utils/dataCapture/jobRequests';
  import {
    addRadioStream as addStream,
    addTimeSlot as addSlot,
    buildWavePulseResults,
    getWavePulseStartError,
    removeRadioStream as removeStream,
    removeTimeSlot as removeSlot
  } from '$lib/utils/dataCapture/wavePulseActions';
  import type { UiJob } from '$lib/utils/dataCapture/types';

  let activeTab = 'schedule';
  let errorMessage = '';

  // Why job history could not be shown, in terms a person can act on
  let jobProblem: JobStateProblem | null = null;

  // Load job states from state store
  async function loadJobStates(forceRefresh = false) {
    loadingJobStates = true;
    try {
      // Add timestamp to bypass cache if forcing refresh
      const timestamp = forceRefresh ? `&t=${Date.now()}` : '';
      const response = await fetch(`/api/jobs?state=true${timestamp}`);

      if (response.ok) {
        jobStates = (await response.json()).data ?? [];

        // Convert job states to UI format
        crawlJobs = jobStates.map(jobStateToUiJob);

        // If there are running jobs, start global polling
        const runningJobs = crawlJobs.filter(job => job.status === 'running');
        if (runningJobs.length > 0 && !isGlobalPollingActive) {
          startGlobalJobMonitoring();
        }
        jobProblem = null;
      } else {
        console.error('Failed to load job states:', response.status, response.statusText);
        jobProblem = describeJobStateFailure(response.status, await response.json().catch(() => null));
      }
    } catch (error) {
      console.error('Failed to load job states:', error);
      jobProblem = describeJobStateFailure(0, null);
    } finally {
      loadingJobStates = false;
    }
  }

  // Load job states for a specific job (for real-time updates)
  async function refreshJobState(jobId: any) {
    try {
      const response = await fetch(`/api/job-state?jobId=${jobId}`);
      if (response.ok) {
        const updatedState = (await response.json()).data;

        // Update the specific job in crawlJobs
        const jobIndex = crawlJobs.findIndex(job => job.id === jobId);
        if (jobIndex !== -1) {
          const previousLogCount = crawlJobs[jobIndex].lastLogCount || 0;
          const newLogCount = updatedState.executionLog?.length || 0;

          crawlJobs[jobIndex] = applyJobStateUpdate(crawlJobs[jobIndex], updatedState);

          // Update currentLogJob if it's the same job being viewed
          if (currentLogJob && currentLogJob.id === jobId) {
            currentLogJob = crawlJobs[jobIndex];

            // Auto-scroll to new logs only if user is near the bottom
            if (newLogCount > previousLogCount && logScrollAnchor && logContainer) {
              setTimeout(() => {
                // Only auto-scroll if user was already viewing the bottom
                if (isNearBottom(logContainer)) {
                  logScrollAnchor?.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
            }
          }

          // Trigger reactivity
          crawlJobs = [...crawlJobs];
        }
      }
    } catch (error) {
      console.error('Failed to refresh job state:', error);
      errorMessage = 'Failed to refresh job state. Please try again.';
    }
  }

  // Check URL parameters on mount and load job states
  onMount(() => {
    activeTab = parseTabParam(window.location.search) ?? activeTab;

    // Load job states from the state store
    loadJobStates();
  });
  let crawlerConfigStep = 'basic'; // basic, platform, advanced, review

  // Crawler configuration state matching CLI flags
  let crawlerConfig = createDefaultCrawlerConfig();

  // URL upload state
  let urlUploadFiles: FileList | null = null;

  // UI state for collapsible sections
  let showCrawlLimits = false;

  // Job names must be unique across crawl jobs and WavePulse schedules
  const isNameUnique = (name: string) => isJobNameUnique(name, allJobs);

  // Schedule configuration
  let scheduleConfig = createDefaultScheduleConfig();

  // Job scheduling state
  let isSchedulingJob = false;
  let schedulingError = '';
  let jobStates: JobState[] = [];
  let loadingJobStates = true;

  // Form validation state
  let stepValidationErrors: string[] = [];

  // Edit functionality state
  let editingJob = null;
  let showEditModal = false;

  // Delete functionality state
  let jobToDelete: any = null;
  let showDeleteConfirmation = false;

  // Error modal state
  let showErrorModal = false;
  let errorModalMessage = '';

  // Analytics calculations
  $: analyticsData = buildAnalyticsData(allJobs);

  // Clear validation errors when form fields change
  $: if (crawlerConfig.name) {
    stepValidationErrors = stepValidationErrors.filter(error =>
      !error.includes('Job name') && !error.includes('already exists')
    );
  }

  $: if (crawlerConfig.urls.length > 0 || crawlerConfig.urlFileURL.trim()) {
    stepValidationErrors = stepValidationErrors.filter(error => !error.includes('URL') || error.includes('Invalid'));
  }

  $: if (crawlerConfig.platform === 'telegram' && crawlerConfig.tdlibDatabaseURLs.some(u => u.trim())) {
    stepValidationErrors = stepValidationErrors.filter(error => !error.includes('TDLib database URL is required'));
  }

  // Global job monitoring
  let globalJobPollingInterval: any = null;
  let isGlobalPollingActive = false;

  // Crawl jobs loaded from state store
  let crawlJobs: UiJob[] = [];

  // Combine crawler jobs and WavePulse schedules
  $: allJobs = [
    ...crawlJobs,
    ...wavePulseStreamsToJobs(wavePulseConfig, wavePulseStatus, wavePulseProgress, wavePulseResults)
  ];

  // Sorting state
  let sortBy: string = 'date';
  let sortDirection: 'asc' | 'desc' = 'desc';
  let sortedJobs: UiJob[] = [];

  // Handle sort field changes
  function handleSort(field: string) {
    if (sortBy === field) {
      // Toggle direction if clicking the same field
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New field, default to descending
      sortBy = field;
      sortDirection = 'desc';
    }
  }

  // Reactive statement to update sorted jobs when dependencies change
  $: sortedJobs = allJobs ? sortJobs(allJobs, sortBy, sortDirection) : [];

  // User upload state
  let uploadFiles: FileList | null = null;
  let uploadProgress = 0;
  let uploadStatus = 'idle'; // idle, uploading, completed, error

  // Princeton SMART configuration state
  let princetonSmartConfig = createDefaultPrincetonSmartConfig();

  // WavePulse configuration state
  let wavePulseConfig = createDefaultWavePulseConfig();

  let wavePulseStatus = 'idle'; // idle, starting, running, stopping, error
  let wavePulseProgress = 0;
  let wavePulseResults: any = null;

  // Log viewer state
  let showLogViewer = false;
  let currentLogJob: any = null;
  let logUpdateInterval: any = null;
  let logContainer: any = null;
  let logScrollAnchor: any = null;

  // Princeton SMART functions
  function resetPrincetonSmartForm() {
    princetonSmartConfig = createDefaultPrincetonSmartConfig();
  }

  // WavePulse functions
  function resetWavePulseForm() {
    wavePulseConfig = createDefaultWavePulseConfig();
    wavePulseStatus = 'idle';
    wavePulseProgress = 0;
    wavePulseResults = null;
  }

  const addRadioStream = () => { wavePulseConfig = addStream(wavePulseConfig); };
  const removeRadioStream = (index: number) => { wavePulseConfig = removeStream(wavePulseConfig, index); };
  const addTimeSlot = (streamIndex: number) => { wavePulseConfig = addSlot(wavePulseConfig, streamIndex); };
  const removeTimeSlot = (streamIndex: number, slotIndex: number) => {
    wavePulseConfig = removeSlot(wavePulseConfig, streamIndex, slotIndex);
  };

  async function handleWavePulseStart() {
    const startError = getWavePulseStartError(wavePulseConfig);
    if (startError) {
      alert(startError);
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

      wavePulseResults = buildWavePulseResults(wavePulseConfig);

      wavePulseStatus = 'running';

    } catch (error) {
      console.error('WavePulse startup error:', error);
      errorMessage = 'Failed to start WavePulse. Please try again.';
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
      errorMessage = 'Failed to stop WavePulse. Please try again.';
      wavePulseStatus = 'error';
    }
  }

  // Edit functionality
  function editJob(job: any) {
    editingJob = job;

    // Populate form with job data if it's a crawler job
    if (job.stateData && job.stateData.jobData) {
      crawlerConfig = crawlerConfigFromJobData(job.name, job.stateData.jobData);
    }

    showEditModal = true;
    activeTab = 'crawler';
  }

  // Delete functionality
  function confirmDeleteJob(job: any) {
    jobToDelete = job;
    showDeleteConfirmation = true;
  }

  async function deleteJob() {
    if (!jobToDelete) return;

    try {
      const response = await fetch(`/api/jobs?name=${encodeURIComponent(jobToDelete.daprJobName || jobToDelete.name)}&jobId=${encodeURIComponent(jobToDelete.id)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Reload job states to reflect the deletion
        await loadJobStates();
        console.log('Job deleted successfully');
      } else {
        console.error('Failed to delete job:', response.status, response.statusText);
        errorMessage = 'Failed to delete job. Please try again.';
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      errorMessage = 'Failed to delete job. Please try again.';
    } finally {
      jobToDelete = null;
      showDeleteConfirmation = false;
    }
  }

  function cancelDelete() {
    jobToDelete = null;
    showDeleteConfirmation = false;
  }

  function nextStep() {
    // Clear previous validation errors
    stepValidationErrors = [];

    // Validate current step before proceeding
    const validation = validateCurrentStep(crawlerConfigStep, crawlerConfig, allJobs);
    if (!validation.isValid) {
      stepValidationErrors = validation.errors;
      return; // Don't proceed if validation fails
    }

    // Proceed to next step
    const steps = ['basic', 'platform', 'advanced', 'review'];
    const currentIndex = steps.indexOf(crawlerConfigStep);
    if (currentIndex < steps.length - 1) {
      crawlerConfigStep = steps[currentIndex + 1];
    }
  }

  function previousStep() {
    // Clear validation errors when going back
    stepValidationErrors = [];

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
        // Add the new, unique URLs to the existing list
        crawlerConfig.urls = [...crawlerConfig.urls, ...parseNewUrls(content, crawlerConfig.urls)];
      }
    };

    reader.readAsText(file);
    urlUploadFiles = null;
  }

  function goToStep(step: string) {
    crawlerConfigStep = step;
  }

  async function saveCrawlerJob() {
    if (!validateForm(crawlerConfig)) {
      return;
    }

    isSchedulingJob = true;
    schedulingError = '';

    try {
      // Check URL validation errors
      const urlErrors = getUrlValidationErrors(crawlerConfig);
      if (urlErrors.length > 0) {
        schedulingError = urlErrors.join('; ');
        return;
      }

      const dueTime = computeDueTime(scheduleConfig);
      const jobName = buildCrawlerJobName(crawlerConfig.name);
      const jobRequest = buildCrawlerJobRequest(crawlerConfig, jobName, dueTime);

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
      errorMessage = 'Failed to schedule crawler job. Please check your configuration and try again.';
    } finally {
      isSchedulingJob = false;
    }
  }

  function resetCrawlerForm() {
    crawlerConfig = createDefaultCrawlerConfig();

    crawlerConfigStep = 'basic';
    activeTab = 'schedule';
  }

  async function runCrawl(jobId: string) {
    // Find the job to run
    const job = crawlJobs.find(j => j.id === jobId);
    if (!job) return;

    // Update UI to show running status
    crawlJobs = crawlJobs.map(j =>
      j.id === jobId
        ? { ...j, status: 'running', progress: 0, startTime: new Date().toISOString() }
        : j
    );

    try {
      // Submit job to API for immediate execution - format matches telegram-scraper README
      const jobPayload = buildRunNowPayload(job, jobId);

      console.log('Submitting job for execution:', jobPayload);

      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jobPayload)
      });

      if (!response.ok) {
        throw new Error(await readRunError(response));
      }

      const result = await response.json();
      console.log('Job submitted successfully:', result);

      // Update job status to indicate submission succeeded
      crawlJobs = crawlJobs.map(j =>
        j.id === jobId
          ? { ...j, status: 'running', executionLog: [...(j.executionLog || []), `${new Date().toISOString()}: Job execution started via Run Now`] }
          : j
      );

    } catch (error: any) {
      console.error('Failed to run job:', error);
      errorMessage = 'Failed to run job. Please try again.';

      // Show error modal instead of alert
      errorModalMessage = error.message;
      showErrorModal = true;

      // Revert status on error
      crawlJobs = crawlJobs.map(j =>
        j.id === jobId
          ? { ...j, status: 'scheduled', executionLog: [...(j.executionLog || []), `${new Date().toISOString()}: Failed to start execution: ${error.message}`] }
          : j
      );
    }
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

  function openLogViewer(job: any) {
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

    // Reset scroll position to show logs from the top
    setTimeout(() => {
      if (logContainer) {
        logContainer.scrollTop = 0;
      }
    }, 50);
  }

  function closeLogViewer() {
    showLogViewer = false;
    currentLogJob = null;
    stopRealTimeLogUpdates();
  }

  // Real-time log update functions
  function startRealTimeLogUpdates(jobId: any) {
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
        // Running jobs, plus recently finished ones for any final updates
        const jobsToCheck = selectJobsToPoll(crawlJobs);

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

<div class="min-h-screen bg-gray-50">
  <PageHeader
    title="Data Capture &amp; Collection"
    subtitle="Web crawling, file upload and data integration"
    showProject={false}
    iconPath="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10">
    <svelte:fragment slot="actions">
      <span class="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white">
        {crawlJobs.filter(job => job.status === 'running').length} jobs running
      </span>
      <button
        on:click={() => loadJobStates(true)}
        disabled={loadingJobStates}
        class="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        <svg class="w-4 h-4 mr-2 {loadingJobStates ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        {loadingJobStates ? 'Refreshing...' : 'Refresh Jobs'}
      </button>
    </svelte:fragment>
  </PageHeader>

  <DataCaptureTabs bind:activeTab />

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if jobProblem}
      <JobProblemAlert {jobProblem} retry={() => loadJobStates(true)} />
    {/if}
    {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

    <!-- Web Crawler Tab -->
    {#if activeTab === 'crawler'}
      <CrawlerTab
        bind:crawlerConfig
        bind:crawlerConfigStep
        bind:scheduleConfig
        bind:urlUploadFiles
        bind:showCrawlLimits
        {isSchedulingJob}
        {schedulingError}
        {stepValidationErrors}
        isJobNameUnique={isNameUnique}
        validateForm={() => validateForm(crawlerConfig)}
        {goToStep}
        {nextStep}
        {previousStep}
        {handleUrlUpload}
        {saveCrawlerJob} />
    {/if}

    <!-- File Upload Tab -->
    {#if activeTab === 'upload'}
      <UploadTab bind:uploadFiles bind:activeTab {uploadProgress} {uploadStatus} {handleFileUpload} />
    {/if}

    <!-- Princeton SMART Tab -->
    {#if activeTab === 'princeton-smart'}
      <PrincetonSmartTab bind:princetonSmartConfig bind:activeTab {resetPrincetonSmartForm} />
    {/if}

    <!-- Schedule & Status Tab -->
    {#if activeTab === 'schedule'}
      <ScheduleTab
        bind:activeTab
        {allJobs}
        {sortedJobs}
        {sortBy}
        {sortDirection}
        {loadingJobStates}
        {loadJobStates}
        {handleSort}
        {handleWavePulseStart}
        {handleWavePulseStop}
        {editJob}
        {confirmDeleteJob}
        {runCrawl}
        {openLogViewer} />
    {/if}

    <!-- WavePulse Tab -->
    {#if activeTab === 'wavepulse'}
      <WavePulseTab
        bind:wavePulseConfig
        bind:activeTab
        {wavePulseStatus}
        {wavePulseProgress}
        {wavePulseResults}
        {resetWavePulseForm}
        {addRadioStream}
        {removeRadioStream}
        {addTimeSlot}
        {removeTimeSlot}
        {handleWavePulseStart}
        {handleWavePulseStop} />
    {/if}

    <!-- Analytics Dashboard -->
    {#if activeTab === 'analytics'}
      <AnalyticsTab
        bind:activeTab
        {analyticsData}
        {loadingJobStates}
        {loadJobStates}
        {editJob}
        {confirmDeleteJob}
        {openLogViewer} />
    {/if}
  </div>
</div>

<!-- Log Viewer Modal -->
{#if showLogViewer && currentLogJob}
  <LogViewerModal {currentLogJob} bind:logContainer bind:logScrollAnchor {closeLogViewer} />
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirmation && jobToDelete}
  <DeleteJobModal {jobToDelete} {deleteJob} {cancelDelete} />
{/if}

<!-- Error Modal -->
{#if showErrorModal}
  <JobErrorModal bind:showErrorModal {errorModalMessage} />
{/if}
