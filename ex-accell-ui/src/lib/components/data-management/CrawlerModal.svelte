<script lang="ts">
  import { crawlTargetLabels, type CrawlerConfig } from '$lib/utils/dataManagement';

  /** The form fields, so bind it */
  export let crawlerConfig: CrawlerConfig;
  /** '', 'starting' or 'scheduled' */
  export let crawlerStatus: string;
  export let onStart: () => void;
  export let onClose: () => void;

  $: targets = crawlTargetLabels(crawlerConfig.platform);
</script>

<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" on:click|self={onClose}>
  <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
    <div class="p-6 border-b border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900">Start Crawl Job</h3>
      <p class="text-sm text-gray-500 mt-1">Configure and launch a social media crawl</p>
    </div>

    <div class="p-6 space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Platform</label>
        <select bind:value={crawlerConfig.platform} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="bluesky">Bluesky</option>
          <option value="youtube">YouTube</option>
          <option value="telegram">Telegram</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {targets.label}
        </label>
        <textarea bind:value={crawlerConfig.urls} rows="3" placeholder="One per line or comma-separated"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
        <p class="text-xs text-gray-500 mt-1">
          {targets.hint}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Max Posts</label>
          <input bind:value={crawlerConfig.maxPosts} type="number" min="10" max="100000"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
          <select bind:value={crawlerConfig.timeAgo} class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last year</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Crawl ID (optional)</label>
        <input bind:value={crawlerConfig.crawlId} type="text" placeholder="auto-generated if empty"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      {#if crawlerConfig.platform === 'youtube'}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">YouTube API Key</label>
          <input bind:value={crawlerConfig.youtubeApiKey} type="password" placeholder="AIza..."
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
      {/if}

      <label class="flex items-center space-x-2">
        <input type="checkbox" bind:checked={crawlerConfig.skipMedia} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <span class="text-sm text-gray-700">Skip media downloads (faster)</span>
      </label>

      {#if crawlerStatus === 'scheduled'}
        <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Crawl job scheduled successfully
        </div>
      {/if}
    </div>

    <div class="p-6 border-t border-gray-200 flex justify-between">
      <button on:click={onClose} class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
        Cancel
      </button>
      <button on:click={onStart} disabled={crawlerStatus === 'starting'}
        class="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50">
        {crawlerStatus === 'starting' ? 'Scheduling...' : 'Start Crawl'}
      </button>
    </div>
  </div>
</div>
