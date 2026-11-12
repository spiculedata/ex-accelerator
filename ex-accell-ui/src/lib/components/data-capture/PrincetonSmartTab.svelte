<script lang="ts">
import type { PrincetonSmartConfig } from '$lib/utils/dataCapture/types';

  export let princetonSmartConfig: PrincetonSmartConfig;
  export let activeTab: string;
  export let resetPrincetonSmartForm: () => void;
</script>

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

    <div class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
      Importing from Princeton SMART is not available yet. This form previews the planned configuration.
    </div>

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
          type="button"
          disabled
          title="Importing from Princeton SMART is not available yet"
          class="px-6 py-2 bg-gray-400 text-white rounded-md text-sm font-medium cursor-not-allowed">
          Import Data
        </button>
      </div>
    </div>
  </div>
</div>
