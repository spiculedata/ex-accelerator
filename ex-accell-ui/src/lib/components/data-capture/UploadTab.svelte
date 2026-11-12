<script lang="ts">
export let uploadFiles: FileList | null;
  export let uploadProgress: number;
  export let uploadStatus: string;
  export let activeTab: string;
  export let handleFileUpload: () => void;
</script>

<div class="max-w-2xl mx-auto">
  <div class="bg-white rounded-xl shadow-sm p-8">
    <h2 class="text-xl font-semibold text-gray-900 mb-6">Upload Data Files</h2>
    
    <!-- Upload Area -->
    <div class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-6">
      <svg class="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
      </svg>
      <p class="text-lg font-medium text-gray-900 mb-2">Drop files here or click to browse</p>
      <p class="text-sm text-gray-600 mb-4">Supported formats: CSV, JSON, Excel, TSV</p>
      <input 
        bind:files={uploadFiles}
        type="file" 
        multiple 
        accept=".csv,.json,.xlsx,.xls,.tsv"
        class="hidden" 
        id="file-upload">
      <label 
        for="file-upload"
        class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md cursor-pointer transition-colors">
        Select Files
      </label>
    </div>

    <!-- File List -->
    {#if uploadFiles && uploadFiles.length > 0}
      <div class="mb-6">
        <h3 class="text-sm font-medium text-gray-900 mb-3">Selected Files</h3>
        <div class="space-y-2">
          {#each Array.from(uploadFiles) as file}
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-gray-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <div>
                  <div class="text-sm font-medium text-gray-900">{file.name}</div>
                  <div class="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Upload Progress -->
    {#if uploadStatus === 'uploading'}
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">Uploading files...</span>
          <span class="text-sm text-gray-500">{uploadProgress}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {uploadProgress}%"></div>
        </div>
      </div>
    {:else if uploadStatus === 'completed'}
      <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="text-sm font-medium text-blue-800">Files uploaded successfully!</span>
        </div>
      </div>
    {/if}

    <!-- Upload Settings -->
    <div class="border-t pt-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Upload Settings</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Data Source Name</label>
          <input 
            type="text" 
            placeholder="e.g., Customer Survey Data Q4 2024"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea 
            placeholder="Describe the data source and its purpose..."
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
        </div>
        <div class="flex items-center">
          <input type="checkbox" id="auto-parse" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
          <label for="auto-parse" class="ml-2 text-sm text-gray-700">Automatically parse and analyze data structure</label>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end space-x-3 pt-6 border-t">
      <button class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
        Cancel
      </button>
      <button 
        on:click={handleFileUpload}
        disabled={!uploadFiles || uploadFiles.length === 0 || uploadStatus === 'uploading'}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors">
        Upload Files
      </button>
    </div>
  </div>
</div>
