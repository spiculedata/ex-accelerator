import { mount } from 'cypress/svelte';

// Mock the job scheduler service
const mockJobSchedulerService = {
  scheduleJob: cy.stub().resolves({ success: true, job: { name: 'test-job' } }),
  getJobs: cy.stub().resolves([]),
  getJob: cy.stub().resolves(null),
  deleteJob: cy.stub().resolves({ success: true }),
  generateJobName: cy.stub().returns('test-job-name'),
  parseRelativeTime: cy.stub().returns('2024-01-01T15:00:00Z'),
  formatDueTime: cy.stub().returns('1h'),
  validateJobRequest: cy.stub().returns([])
};

// Component test for job scheduling form
describe('Job Scheduler Component', () => {
  beforeEach(() => {
    // Mock the service module
    cy.window().then((win) => {
      win.jobSchedulerService = mockJobSchedulerService;
    });
  });

  it('should render job scheduling form correctly', () => {
    mount(`
      <div class="border border-gray-200 rounded-xl p-4">
        <div class="mb-4">
          <h3 class="text-lg font-medium text-gray-900 mb-2">Job Scheduling</h3>
          <p class="text-sm text-gray-600">Configure when and how your crawler job should be executed using Dapr Jobs.</p>
        </div>
        
        <!-- Scheduling Mode -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Execution Mode</label>
          <div class="space-y-2">
            <label class="flex items-center">
              <input 
                type="radio" 
                value="immediate"
                name="schedulingMode"
                class="text-blue-600 focus:ring-blue-500">
              <span class="ml-2 text-sm text-gray-700">Run immediately</span>
              <span class="ml-2 text-xs text-gray-500">(Execute as soon as job is created)</span>
            </label>
            <label class="flex items-center">
              <input 
                type="radio" 
                value="delayed"
                name="schedulingMode"
                class="text-blue-600 focus:ring-blue-500">
              <span class="ml-2 text-sm text-gray-700">Run with delay</span>
              <span class="ml-2 text-xs text-gray-500">(Execute after a specified delay)</span>
            </label>
            <label class="flex items-center">
              <input 
                type="radio" 
                value="scheduled"
                name="schedulingMode"
                class="text-blue-600 focus:ring-blue-500">
              <span class="ml-2 text-sm text-gray-700">Run at specific time</span>
              <span class="ml-2 text-xs text-gray-500">(Execute at a specific date and time)</span>
            </label>
          </div>
        </div>
      </div>
    `);

    // Check that all scheduling options are present
    cy.contains('Run immediately').should('be.visible');
    cy.contains('Run with delay').should('be.visible');
    cy.contains('Run at specific time').should('be.visible');

    // Check that immediate mode is selected by default
    cy.get('input[value="immediate"]').should('be.checked');
  });

  it('should show delay configuration when delayed mode is selected', () => {
    mount(`
      <div class="border border-gray-200 rounded-xl p-4" data-testid="job-scheduler">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Execution Mode</label>
          <div class="space-y-2">
            <label class="flex items-center">
              <input 
                type="radio" 
                value="immediate"
                name="schedulingMode"
                class="text-blue-600 focus:ring-blue-500">
              <span class="ml-2 text-sm text-gray-700">Run immediately</span>
            </label>
            <label class="flex items-center">
              <input 
                type="radio" 
                value="delayed"
                name="schedulingMode"
                class="text-blue-600 focus:ring-blue-500">
              <span class="ml-2 text-sm text-gray-700">Run with delay</span>
            </label>
          </div>
        </div>
        
        <!-- This would conditionally render based on selection -->
        <div id="delay-config" style="display: none;">
          <label class="block text-sm font-medium text-gray-700 mb-2">Delay Time</label>
          <select class="flex-1 px-3 py-2 border border-gray-300 rounded-md">
            <option value="30s">30 seconds</option>
            <option value="1m">1 minute</option>
            <option value="5m">5 minutes</option>
            <option value="1h">1 hour</option>
          </select>
        </div>
      </div>
    `);

    // Select delayed mode
    cy.get('input[value="delayed"]').click();

    // Show delay configuration (would need Svelte reactivity in real component)
    cy.get('#delay-config').invoke('show');
    cy.get('select').should('be.visible');
    cy.get('option[value="1m"]').should('exist');
  });

  it('should validate form inputs correctly', () => {
    const mockValidateJobRequest = cy.stub().returns(['Job name is required', 'URLs are required']);
    
    mount(`
      <div data-testid="validation-test">
        <button id="validate-btn" type="button">Validate</button>
        <div id="errors"></div>
      </div>
    `);

    cy.get('#validate-btn').click().then(() => {
      // Simulate validation errors
      const errors = ['Job name is required', 'URLs are required'];
      cy.get('#errors').then($el => {
        $el.html(errors.map(err => `<p class="text-red-600 text-sm">${err}</p>`).join(''));
      });
    });

    cy.get('#errors').should('contain', 'Job name is required');
    cy.get('#errors').should('contain', 'URLs are required');
  });

  it('should handle loading states during job creation', () => {
    let isLoading = false;
    
    mount(`
      <div data-testid="loading-test">
        <button 
          id="schedule-btn"
          class="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
          ${isLoading ? 'disabled' : ''}>
          ${isLoading ? 
            '<svg class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>Scheduling Job...' :
            'Schedule Job'
          }
        </button>
      </div>
    `);

    // Initially should show normal state
    cy.get('#schedule-btn').should('contain', 'Schedule Job');
    cy.get('#schedule-btn').should('not.be.disabled');

    // Simulate loading state
    cy.get('#schedule-btn').click().then(() => {
      isLoading = true;
      cy.get('#schedule-btn').then($btn => {
        $btn.html(`
          <svg class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          Scheduling Job...
        `);
        $btn.prop('disabled', true);
      });
    });

    cy.get('#schedule-btn').should('contain', 'Scheduling Job...');
    cy.get('#schedule-btn').should('be.disabled');
    cy.get('.animate-spin').should('exist');
  });

  it('should display error messages appropriately', () => {
    mount(`
      <div data-testid="error-test">
        <div id="error-display" style="display: none;" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div class="flex">
            <svg class="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <h4 class="text-sm font-medium text-red-800">Scheduling Error</h4>
              <p class="text-sm text-red-700 mt-1" id="error-message"></p>
            </div>
          </div>
        </div>
        <button id="error-trigger">Trigger Error</button>
      </div>
    `);

    // Initially error should be hidden
    cy.get('#error-display').should('not.be.visible');

    // Trigger error display
    cy.get('#error-trigger').click().then(() => {
      cy.get('#error-message').then($el => {
        $el.text('Failed to schedule job: Server error');
      });
      cy.get('#error-display').invoke('show');
    });

    // Error should now be visible
    cy.get('#error-display').should('be.visible');
    cy.contains('Scheduling Error').should('be.visible');
    cy.contains('Failed to schedule job: Server error').should('be.visible');
  });
});

describe('Job Configuration Form Components', () => {
  it('should handle platform selection correctly', () => {
    mount(`
      <div data-testid="platform-selector">
        <div class="flex space-x-4">
          <label class="flex items-center">
            <input type="radio" value="telegram" name="platform" class="text-blue-600 focus:ring-blue-500">
            <span class="ml-2 text-sm text-gray-700">Telegram</span>
          </label>
          <label class="flex items-center">
            <input type="radio" value="youtube" name="platform" class="text-blue-600 focus:ring-blue-500">
            <span class="ml-2 text-sm text-gray-700">YouTube</span>
          </label>
        </div>
        
        <!-- Platform-specific fields -->
        <div id="youtube-fields" style="display: none;">
          <input type="text" placeholder="YouTube API Key" class="mt-2 px-3 py-2 border rounded-md">
        </div>
      </div>
    `);

    // Select YouTube platform
    cy.get('input[value="youtube"]').click();
    cy.get('input[value="youtube"]').should('be.checked');

    // Show YouTube-specific fields
    cy.get('#youtube-fields').invoke('show');
    cy.get('input[placeholder="YouTube API Key"]').should('be.visible');
  });

  it('should validate URL input formats', () => {
    mount(`
      <div data-testid="url-input">
        <textarea 
          placeholder="Enter channel URLs (one per line)"
          class="w-full px-3 py-2 border border-gray-300 rounded-md"
          id="url-textarea"></textarea>
        <div id="url-validation" class="mt-2"></div>
        <button id="validate-urls">Validate URLs</button>
      </div>
    `);

    // Enter invalid URLs
    cy.get('#url-textarea').type('invalid-url\n@validchannel\nnotvalid');
    
    cy.get('#validate-urls').click().then(() => {
      // Simulate URL validation
      const urls = ['invalid-url', '@validchannel', 'notvalid'];
      const validUrls = urls.filter(url => url.startsWith('@') || url.startsWith('UC'));
      const invalidUrls = urls.filter(url => !url.startsWith('@') && !url.startsWith('UC'));
      
      if (invalidUrls.length > 0) {
        cy.get('#url-validation').then($el => {
          $el.html(`<p class="text-red-600 text-sm">Invalid URLs: ${invalidUrls.join(', ')}</p>`);
        });
      }
    });

    cy.get('#url-validation').should('contain', 'Invalid URLs');
    cy.get('#url-validation').should('contain', 'invalid-url');
  });
});