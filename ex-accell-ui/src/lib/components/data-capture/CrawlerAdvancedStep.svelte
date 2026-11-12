<script lang="ts">
import type { CrawlerConfig } from '$lib/utils/dataCapture/types';

  export let crawlerConfig: CrawlerConfig;
  export let showCrawlLimits: boolean;
</script>

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
            <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
