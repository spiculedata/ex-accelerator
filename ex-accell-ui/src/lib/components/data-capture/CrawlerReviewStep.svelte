<script lang="ts">
import type { CrawlerConfig, ScheduleConfig } from '$lib/utils/dataCapture/types';

  export let crawlerConfig: CrawlerConfig;
  export let scheduleConfig: ScheduleConfig;
  export let schedulingError: string;
</script>

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
