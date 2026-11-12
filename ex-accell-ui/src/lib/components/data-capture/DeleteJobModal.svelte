<script lang="ts">
import type { UiJob } from '$lib/utils/dataCapture/types';

  export let jobToDelete: UiJob;
  export let deleteJob: () => void;
  export let cancelDelete: () => void;
</script>

<div class="fixed inset-0 bg-gray-500/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
    <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
      <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 15.5C3.462 16.333 4.422 18 5.982 18z"></path>
      </svg>
    </div>
    
    <div class="text-center mb-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Delete Job</h3>
      <p class="text-sm text-gray-600">
        Are you sure you want to delete the job "<span class="font-medium text-gray-900">{jobToDelete.name}</span>"?
      </p>
      <p class="text-sm text-red-600 mt-2">
        This action cannot be undone. All job data and logs will be permanently removed.
      </p>
    </div>
    
    <div class="flex space-x-3">
      <button 
        on:click={cancelDelete}
        class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
        Cancel
      </button>
      <button 
        on:click={deleteJob}
        class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
        Delete Job
      </button>
    </div>
  </div>
</div>
