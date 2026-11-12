<script lang="ts">
  export let activeTab: string;

  const tabs = [
    { id: 'schedule', label: 'Schedule & Status' },
    { id: 'crawler', label: 'Web Crawler' },
    { id: 'upload', label: 'File Upload' },
    { id: 'princeton-smart', label: 'Princeton SMART' },
    { id: 'wavepulse', label: 'WavePulse' },
    { id: 'analytics', label: 'Analytics' }
  ];
</script>

<div class="bg-white border-b border-gray-200">
  <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Data capture sections">
    <div class="flex space-x-8 overflow-x-auto whitespace-nowrap px-1 pt-1">
      {#each tabs as tab}
        <button
          class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = tab.id}>
          {tab.label}
        </button>
      {/each}
    </div>
  </nav>
</div>
