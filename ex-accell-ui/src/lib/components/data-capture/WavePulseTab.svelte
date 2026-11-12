<script lang="ts">
import type { WavePulseConfig } from '$lib/utils/dataCapture/types';

  export let wavePulseConfig: WavePulseConfig;
  export let wavePulseStatus: string;
  export let wavePulseProgress: number;
  export let wavePulseResults: any;
  export let activeTab: string;
  export let resetWavePulseForm: () => void;
  export let addRadioStream: () => void;
  export let removeRadioStream: (index: number) => void;
  export let addTimeSlot: (streamIndex: number) => void;
  export let removeTimeSlot: (streamIndex: number, slotIndex: number) => void;
  export let handleWavePulseStart: () => void;
  export let handleWavePulseStop: () => void;
</script>

<div class="max-w-6xl mx-auto">
  <div class="mb-8">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-semibold text-gray-900">WavePulse Radio Stream Analytics</h2>
        <p class="text-gray-600">Real-time content analytics of radio livestreams with transcription and AI analysis</p>
      </div>
      <div class="flex space-x-3">
        {#if wavePulseStatus === 'idle'}
          <button 
            on:click={handleWavePulseStart}
            class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            Start WavePulse
          </button>
        {:else if wavePulseStatus === 'running'}
          <button 
            on:click={handleWavePulseStop}
            class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            Stop WavePulse
          </button>
        {/if}
        <button 
          on:click={resetWavePulseForm}
          class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          Reset
        </button>
      </div>
    </div>

    <!-- Status Display -->
    {#if wavePulseStatus !== 'idle'}
      <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-blue-800">Status: {wavePulseStatus}</span>
          {#if wavePulseStatus === 'starting'}
            <span class="text-sm text-blue-600">{wavePulseProgress}%</span>
          {/if}
        </div>
        {#if wavePulseStatus === 'starting'}
          <div class="w-full bg-blue-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {wavePulseProgress}%"></div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Configuration Form -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      <!-- Left Column: API Configuration & Components -->
      <div class="space-y-6">
        
        <!-- API Configuration -->
        <div class="bg-white border border-gray-200 rounded-xl p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg class="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2h3m-3 0l-1-1m1 1l-1 1m-1-1v4"></path>
            </svg>
            API Configuration
          </h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Hugging Face Token
                <span class="text-gray-500">(Required for speaker diarization)</span>
              </label>
              <input 
                bind:value={wavePulseConfig.huggingFaceToken}
                type="password" 
                placeholder="hf_..."
                class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              <p class="text-xs text-gray-500 mt-1">Get your token at <a href="https://huggingface.co/settings/tokens" target="_blank" class="text-blue-600 hover:underline">huggingface.co/settings/tokens</a></p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Google Gemini API Key
                <span class="text-gray-500">(Required for content classification)</span>
              </label>
              <input 
                bind:value={wavePulseConfig.geminiApiKey}
                type="password" 
                placeholder="AIza..."
                class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              <p class="text-xs text-gray-500 mt-1">Get your key at <a href="https://ai.google.dev/aistudio" target="_blank" class="text-blue-600 hover:underline">ai.google.dev/aistudio</a></p>
            </div>
          </div>
        </div>

        <!-- Component Control -->
        <div class="bg-white border border-gray-200 rounded-xl p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg class="w-5 h-5 text-emerald-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Pipeline Components
          </h3>
          
          <div class="space-y-3">
            <label class="flex items-center">
              <input type="checkbox" bind:checked={wavePulseConfig.enableRecording} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
              <span class="ml-2 text-sm text-gray-700">Enable Recording</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" bind:checked={wavePulseConfig.enableTranscription} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
              <span class="ml-2 text-sm text-gray-700">Enable Transcription</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" bind:checked={wavePulseConfig.enableClassification} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
              <span class="ml-2 text-sm text-gray-700">Enable Content Classification</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" bind:checked={wavePulseConfig.enableDiarization} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
              <span class="ml-2 text-sm text-gray-700">Enable Speaker Diarization</span>
            </label>
          </div>
        </div>

        <!-- Transcription Settings -->
        <div class="bg-white border border-gray-200 rounded-xl p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg class="w-5 h-5 text-signal-700 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4"></path>
            </svg>
            Transcription Settings
          </h3>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Whisper Model</label>
              <select bind:value={wavePulseConfig.whisperModel} class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="large-v3">Large V3 (Best Quality)</option>
                <option value="large-v2">Large V2</option>
                <option value="medium">Medium (Faster)</option>
                <option value="small">Small (Fastest)</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Device</label>
              <select bind:value={wavePulseConfig.device} class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="cuda">CUDA (GPU)</option>
                <option value="cpu">CPU</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Batch Size</label>
              <input 
                bind:value={wavePulseConfig.batchSize}
                type="number" 
                min="1" 
                max="32"
                class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Compute Type</label>
              <select bind:value={wavePulseConfig.computeType} class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="float16">Float16 (Faster)</option>
                <option value="float32">Float32 (More Accurate)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Radio Streams Configuration -->
      <div class="space-y-6">
        
        <!-- Radio Streams -->
        <div class="bg-white border border-gray-200 rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center">
              <svg class="w-5 h-5 text-rose-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828a2 2 0 01-1.414-.586l5-5A2 2 0 009 12.172V5L8 4z"></path>
              </svg>
              Radio Streams ({wavePulseConfig.radioStreams.length})
            </h3>
            <button 
              on:click={addRadioStream}
              class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-sm font-medium transition-colors">
              Add Stream
            </button>
          </div>
          
          <div class="space-y-4 max-h-96 overflow-y-auto">
            {#each wavePulseConfig.radioStreams as stream, streamIndex}
              <div class="border border-gray-200 rounded-xl p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-700">Stream {streamIndex + 1}</span>
                  <button 
                    on:click={() => removeRadioStream(streamIndex)}
                    class="text-rose-600 hover:text-rose-800 text-sm">
                    Remove
                  </button>
                </div>
                
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Radio Name</label>
                    <input 
                      bind:value={stream.radioName}
                      placeholder="WXYZ"
                      class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">State</label>
                    <input 
                      bind:value={stream.state}
                      placeholder="NY"
                      class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
                  </div>
                </div>
                
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">Stream URL</label>
                  <input 
                    bind:value={stream.url}
                    placeholder="https://example.com/stream"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
                </div>
                
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="block text-xs font-medium text-gray-600">Time Slots</label>
                    <button 
                      on:click={() => addTimeSlot(streamIndex)}
                      class="text-blue-600 hover:text-blue-800 text-xs">
                      Add Slot
                    </button>
                  </div>
                  <div class="space-y-2">
                    {#each stream.timeSlots as slot, slotIndex}
                      <div class="flex items-center space-x-2">
                        <input 
                          bind:value={slot.start}
                          type="time"
                          class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <span class="text-xs text-gray-500">to</span>
                        <input 
                          bind:value={slot.end}
                          type="time"
                          class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <button 
                          on:click={() => removeTimeSlot(streamIndex, slotIndex)}
                          class="text-rose-600 hover:text-rose-800 text-xs">
                          ×
                        </button>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Advanced Settings -->
        <div class="bg-white border border-gray-200 rounded-xl p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg class="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            Advanced Settings
          </h3>
          
          <div class="space-y-4">
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Segment Duration (sec)</label>
                <input 
                  bind:value={wavePulseConfig.segmentDuration}
                  type="number" 
                  min="300"
                  class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Retries</label>
                <input 
                  bind:value={wavePulseConfig.retries}
                  type="number" 
                  min="1"
                  class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Wait Time (sec)</label>
                <input 
                  bind:value={wavePulseConfig.waitTime}
                  type="number" 
                  min="10"
                  class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                <select bind:value={wavePulseConfig.timezone} class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="US/Eastern">US/Eastern</option>
                  <option value="US/Central">US/Central</option>
                  <option value="US/Mountain">US/Mountain</option>
                  <option value="US/Pacific">US/Pacific</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Assets Directory</label>
                <input 
                  bind:value={wavePulseConfig.assetsDir}
                  placeholder="assets"
                  class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
            </div>

            <!-- Analytics Options -->
            <div class="border-t pt-4 mt-4">
              <h4 class="text-sm font-medium text-gray-700 mb-3">Analytics Features</h4>
              <div class="space-y-2">
                <label class="flex items-center">
                  <input type="checkbox" bind:checked={wavePulseConfig.sentimentAnalysis} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                  <span class="ml-2 text-sm text-gray-700">Enable Sentiment Analysis</span>
                </label>
                <label class="flex items-center">
                  <input type="checkbox" bind:checked={wavePulseConfig.narrativeTracking} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                  <span class="ml-2 text-sm text-gray-700">Enable Narrative Tracking</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Results Display -->
    {#if wavePulseResults}
      <div class="mt-8 bg-emerald-50 border border-emerald-200 rounded-xl p-6">
        <h3 class="text-lg font-semibold text-emerald-800 mb-4">WavePulse Status</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white rounded-lg p-4">
            <div class="text-2xl font-bold text-emerald-600">{wavePulseResults.streamsConfigured}</div>
            <div class="text-sm text-gray-600">Radio Streams</div>
          </div>
          <div class="bg-white rounded-lg p-4">
            <div class="text-2xl font-bold text-emerald-600">
              {Object.values(wavePulseResults.componentsEnabled).filter(Boolean).length}
            </div>
            <div class="text-sm text-gray-600">Components Active</div>
          </div>
          <div class="bg-white rounded-lg p-4">
            <div class="text-2xl font-bold text-emerald-600">
              {new Date(wavePulseResults.startTime).toLocaleTimeString()}
            </div>
            <div class="text-sm text-gray-600">Started At</div>
          </div>
        </div>
        
        <div class="mt-4 text-sm text-emerald-700">
          <p><strong>Status:</strong> {wavePulseResults.status}</p>
          <p><strong>Components:</strong> 
            {Object.entries(wavePulseResults.componentsEnabled).filter(([, enabled]) => enabled).map(([name]) => name).join(', ')}
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>
