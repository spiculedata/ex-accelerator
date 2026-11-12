<script lang="ts">
import type { CrawlerConfig } from '$lib/utils/dataCapture/types';
  import { validateTdlibUrl, validateTelegramUrl } from '$lib/utils/dataCapture/crawlerValidation';

  export let crawlerConfig: CrawlerConfig;
  export let urlUploadFiles: FileList | null;
  export let handleUrlUpload: () => void;

  function removeUrl(index: number) {
    crawlerConfig.urls = crawlerConfig.urls.filter((_, i) => i !== index);
  }

  function removeTdlibUrl(index: number) {
    crawlerConfig.tdlibDatabaseURLs = crawlerConfig.tdlibDatabaseURLs.filter((_, i) => i !== index);
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-gray-900 mb-2">Platform & URLs</h2>
    <p class="text-gray-600">Select the platform and configure target URLs or files.</p>
  </div>

  <div>
    <div class="flex items-center mb-2">
      <label class="block text-sm font-medium text-gray-700">Platform</label>
      <div class="group relative ml-2">
        <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input 
                bind:value={crawlerConfig.urls[i]}
                type="url" 
                placeholder={crawlerConfig.platform === 'telegram' ? 'https://t.me/channel_name' : 'https://example.com'}
                class="flex-1 px-3 py-2 border {crawlerConfig.platform === 'telegram' && url.trim() && !validateTelegramUrl(url) ? 'border-red-300' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <button 
                on:click={() => removeUrl(i)}
                class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors">
                Remove
              </button>
            </div>
            {#if crawlerConfig.platform === 'telegram' && url.trim() && !validateTelegramUrl(url)}
              <p class="text-red-600 text-xs ml-1">Invalid Telegram URL. Use format: https://t.me/channel_name</p>
            {/if}
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
          <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                URLs to pre-seeded TDLib database archives required for Telegram access
              </div>
            </div>
          </div>
          <div class="space-y-2">
            {#each crawlerConfig.tdlibDatabaseURLs as url, i}
              <div class="space-y-1">
                <div class="flex items-center space-x-2">
                  <input 
                    bind:value={crawlerConfig.tdlibDatabaseURLs[i]}
                    type="url" 
                    placeholder="https://example.com/database.tar.gz"
                    class="flex-1 px-3 py-2 border {url.trim() && !validateTdlibUrl(url) ? 'border-red-300' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <button 
                    on:click={() => removeTdlibUrl(i)}
                    class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors">
                    Remove
                  </button>
                </div>
                {#if url.trim() && !validateTdlibUrl(url)}
                  <p class="text-red-600 text-xs ml-1">TDLib URL must end with .tgz or .tar.gz</p>
                {/if}
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
              <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
