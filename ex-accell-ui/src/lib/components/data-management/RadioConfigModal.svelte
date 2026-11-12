<script lang="ts">
  import { blankRadioStream, type RadioConfig, type WavePulseStatus } from '$lib/utils/dataManagement';

  /** The stations and settings, which the form edits, so bind it */
  export let radioConfig: RadioConfig;
  export let wavePulseStatus: WavePulseStatus;
  export let onStart: () => void;
  export let onStop: () => void;
  export let onClose: () => void;

  function addRadioStream() {
    radioConfig.radioStreams = [...radioConfig.radioStreams, blankRadioStream()];
  }

  function removeRadioStream(index: number) {
    radioConfig.radioStreams = radioConfig.radioStreams.filter((_, i) => i !== index);
  }
</script>

<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" on:click|self={onClose}>
  <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Radio Stream Configuration</h3>
          <p class="text-sm text-gray-500 mt-1">Configure radio stations to record and transcribe</p>
        </div>
        <div class="flex items-center space-x-2">
          {#if wavePulseStatus.status === 'running'}
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Recording</span>
          {:else if wavePulseStatus.status === 'offline'}
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Service Offline</span>
          {:else}
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{wavePulseStatus.status}</span>
          {/if}
        </div>
      </div>
    </div>

    <div class="p-6 space-y-6">
      <!-- Radio Streams -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <label class="text-sm font-medium text-gray-700">Radio Stations</label>
          <button on:click={addRadioStream} class="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add Station</button>
        </div>
        {#each radioConfig.radioStreams as stream, i}
          <div class="border border-gray-200 rounded-lg p-4 mb-3">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-medium text-gray-600">Station {i + 1}</span>
              {#if radioConfig.radioStreams.length > 1}
                <button on:click={() => removeRadioStream(i)} class="text-sm text-red-500 hover:text-red-700">Remove</button>
              {/if}
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-2">
                <label class="block text-xs text-gray-500 mb-1">Stream URL</label>
                <input bind:value={stream.url} type="text" placeholder="https://..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Station Name</label>
                <input bind:value={stream.radioName} type="text" placeholder="WGSV" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3 mt-2">
              <div>
                <label class="block text-xs text-gray-500 mb-1">State</label>
                <input bind:value={stream.state} type="text" placeholder="VA" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Record From</label>
                <input bind:value={stream.timeSlots[0].start} type="time" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Record Until</label>
                <input bind:value={stream.timeSlots[0].end} type="time" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Transcription Settings -->
      <div>
        <label class="text-sm font-medium text-gray-700 mb-3 block">Transcription Settings</label>
        <div class="grid grid-cols-2 gap-4">
          <label class="flex items-center space-x-2">
            <input type="checkbox" bind:checked={radioConfig.enableTranscription} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span class="text-sm text-gray-700">Enable Transcription</span>
          </label>
          <label class="flex items-center space-x-2">
            <input type="checkbox" bind:checked={radioConfig.enableClassification} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span class="text-sm text-gray-700">Enable Classification</span>
          </label>
        </div>
      </div>

      <!-- API Keys (optional) -->
      <div>
        <label class="text-sm font-medium text-gray-700 mb-3 block">API Keys (Optional)</label>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">HuggingFace Token (for speaker diarization)</label>
            <input bind:value={radioConfig.huggingFaceToken} type="password" placeholder="hf_..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Gemini API Key (for content classification)</label>
            <input bind:value={radioConfig.geminiApiKey} type="password" placeholder="AI..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
      </div>

      <!-- Status Info -->
      {#if wavePulseStatus.status === 'running'}
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center">
            <div class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            <span class="text-sm font-medium text-green-800">Recording Active</span>
          </div>
          <div class="mt-2 text-sm text-green-700">
            <p>Streams: {wavePulseStatus.active_streams?.length || 0}</p>
            <p>Recordings: {wavePulseStatus.recordings_count || 0}</p>
            <p>Transcripts: {wavePulseStatus.transcripts_count || 0}</p>
          </div>
        </div>
      {:else if wavePulseStatus.status === 'offline'}
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          Radio service is starting up. This may take a moment on first launch.
        </div>
      {:else if wavePulseStatus.status === 'idle'}
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          Radio service is ready. Configure your stations above and click Start Recording.
        </div>
      {/if}
    </div>

    <div class="p-6 border-t border-gray-200 flex justify-between">
      <button on:click={onClose} class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
        Cancel
      </button>
      <div class="flex space-x-3">
        {#if wavePulseStatus.status === 'running'}
          <button on:click={onStop} class="px-4 py-2 text-sm text-red-700 bg-red-100 hover:bg-red-200 rounded-lg font-medium">
            Stop Recording
          </button>
        {:else}
          <button on:click={onStart}
            class="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
            {wavePulseStatus.status === 'offline' ? 'Start Recording (service starting...)' : 'Start Recording'}
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
