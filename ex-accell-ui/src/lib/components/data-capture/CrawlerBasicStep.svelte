<script lang="ts">
import type { CrawlerConfig } from '$lib/utils/dataCapture/types';

  export let crawlerConfig: CrawlerConfig;
  export let isJobNameUnique: (name: string) => boolean;
</script>

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
          <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        class="w-full px-3 py-2 border {crawlerConfig.name.trim() && isJobNameUnique(crawlerConfig.name) ? 'border-gray-300' : 'border-red-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
      {#if crawlerConfig.name.trim() && !isJobNameUnique(crawlerConfig.name)}
        <p class="text-red-600 text-xs mt-1">Job name already exists. Please choose a unique name.</p>
      {/if}
    </div>
    <div>
      <div class="flex items-center mb-2">
        <label class="block text-sm font-medium text-gray-700">Crawl ID</label>
        <div class="group relative ml-2">
          <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
