<div class="min-h-screen bg-blue-500 flex items-center justify-center">
  <div class="bg-white p-8 rounded-xl shadow-lg max-w-md">
    <h1 class="text-2xl font-bold text-gray-900 mb-4">Tailwind v4 Test</h1>
    <p class="text-gray-600 mb-4">Testing grid layout:</p>
    
    <!-- Test grid -->
    <div class="grid grid-cols-3 gap-4 mb-4">
      <div class="bg-red-200 p-2 text-center">1</div>
      <div class="bg-green-200 p-2 text-center">2</div>
      <div class="bg-blue-200 p-2 text-center">3</div>
    </div>
    
    <!-- Test icons -->
    <div class="flex items-center space-x-2 mb-4">
      <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      <span>Icon test (should be 24px)</span>
    </div>
    
    <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors">
      Test Button
    </button>
  </div>
</div>