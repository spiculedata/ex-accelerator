<script lang="ts">
export let showErrorModal: boolean;
  export let errorModalMessage: string;
</script>

<div class="fixed inset-0 bg-gray-500/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
    <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
      <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
    </div>
    
    <div class="text-center mb-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Job Execution Failed</h3>
      <p class="text-sm text-gray-600 text-left bg-gray-50 p-3 rounded-lg border">
        {errorModalMessage}
      </p>
    </div>
    
    <div class="flex justify-center">
      <button 
        on:click={() => showErrorModal = false}
        class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
        OK
      </button>
    </div>
  </div>
</div>
