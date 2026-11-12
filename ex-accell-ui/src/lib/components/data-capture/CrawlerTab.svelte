<script lang="ts">
import type { CrawlerConfig, ScheduleConfig } from '$lib/utils/dataCapture/types';
  import CrawlerBasicStep from './CrawlerBasicStep.svelte';
  import CrawlerPlatformStep from './CrawlerPlatformStep.svelte';
  import CrawlerAdvancedStep from './CrawlerAdvancedStep.svelte';
  import CrawlerReviewStep from './CrawlerReviewStep.svelte';

  export let crawlerConfig: CrawlerConfig;
  export let crawlerConfigStep: string;
  export let scheduleConfig: ScheduleConfig;
  export let urlUploadFiles: FileList | null;
  export let showCrawlLimits: boolean;
  export let isSchedulingJob: boolean;
  export let schedulingError: string;
  export let stepValidationErrors: string[];
  export let isJobNameUnique: (name: string) => boolean;
  export let validateForm: () => boolean;
  export let goToStep: (step: string) => void;
  export let nextStep: () => void;
  export let previousStep: () => void;
  export let handleUrlUpload: () => void;
  export let saveCrawlerJob: () => void;
</script>

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
    
          {#if crawlerConfigStep === 'basic'}
            <CrawlerBasicStep bind:crawlerConfig {isJobNameUnique} />
          {/if}

          {#if crawlerConfigStep === 'platform'}
            <CrawlerPlatformStep bind:crawlerConfig bind:urlUploadFiles {handleUrlUpload} />
          {/if}

          {#if crawlerConfigStep === 'advanced'}
            <CrawlerAdvancedStep bind:crawlerConfig bind:showCrawlLimits />
          {/if}

          {#if crawlerConfigStep === 'review'}
            <CrawlerReviewStep bind:crawlerConfig bind:scheduleConfig {schedulingError} />
          {/if}

    <!-- Step Validation Errors -->
    {#if stepValidationErrors.length > 0}
      <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
        <div class="flex">
          <svg class="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 15.5C3.462 16.333 4.422 18 5.982 18z" />
          </svg>
          <div>
            <h4 class="text-sm font-medium text-red-800">Please fix the following errors before proceeding:</h4>
            <ul class="text-sm text-red-700 mt-1 list-disc list-inside">
              {#each stepValidationErrors as error}
                <li>{error}</li>
              {/each}
            </ul>
          </div>
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
