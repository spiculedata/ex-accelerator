describe('Job Scheduler - Dapr Integration', () => {
  beforeEach(() => {
    // Visit the data capture page
    cy.visit('/data-capture?tab=crawler');
    
    // Wait for page to load
    cy.get('[data-testid="crawler-step-basic"], .bg-white').should('exist');
  });

  describe('Crawler Job Configuration', () => {
    it('should allow user to create a basic crawler job configuration', () => {
      // Step 1: Basic Settings
      cy.get('input[placeholder*="Telegram Sentiment Analysis"]').type('Test Telegram Crawler');
      cy.get('input[placeholder*="test-crawl-123"]').type('test-crawl-001');
      
      // Proceed to next step
      cy.contains('button', 'Next').click();
      
      // Step 2: Platform & URLs
      cy.get('input[value="telegram"]').should('be.checked');
      
      // Add URLs
      cy.get('textarea[placeholder*="@channel1"]').type('@testchannel1\n@testchannel2\n@testchannel3');
      
      // Proceed to next step
      cy.contains('button', 'Next').click();
      
      // Step 3: Advanced settings (skip for basic test)
      cy.contains('button', 'Next').click();
      
      // Step 4: Review & Schedule
      cy.contains('h2', 'Review & Schedule').should('be.visible');
      cy.contains('Test Telegram Crawler').should('be.visible');
      cy.contains('telegram').should('be.visible');
    });

    it('should validate required fields', () => {
      // Try to proceed without filling required fields
      cy.contains('button', 'Next').click();
      
      // Should stay on the same step if validation fails
      cy.contains('h2', 'Basic Settings').should('be.visible');
      
      // Fill in required job name
      cy.get('input[placeholder*="Telegram Sentiment Analysis"]').type('Test Job');
      
      // Now should be able to proceed
      cy.contains('button', 'Next').click();
      cy.contains('h2', 'Platform & URLs').should('be.visible');
    });
  });

  describe('Job Scheduling Options', () => {
    beforeEach(() => {
      // Navigate to review step with valid configuration
      cy.get('input[placeholder*="Telegram Sentiment Analysis"]').type('Scheduled Test Job');
      cy.contains('button', 'Next').click();
      
      cy.get('textarea[placeholder*="@channel1"]').type('@testchannel');
      cy.contains('button', 'Next').click();
      
      cy.contains('button', 'Next').click();
      
      // Now at review step
      cy.contains('h2', 'Review & Schedule').should('be.visible');
    });

    it('should display immediate execution option by default', () => {
      cy.get('input[value="immediate"]').should('be.checked');
      cy.contains('Run immediately').should('be.visible');
      cy.contains('Execute as soon as job is created').should('be.visible');
    });

    it('should allow selecting delayed execution', () => {
      cy.get('input[value="delayed"]').click();
      cy.get('input[value="delayed"]').should('be.checked');
      
      // Should show delay time selector
      cy.get('select').contains('1 minute').should('be.visible');
      cy.get('select').contains('1 hour').should('be.visible');
      
      // Select a specific delay
      cy.get('select').select('5m');
      cy.contains('Job will be executed after the specified delay').should('be.visible');
    });

    it('should allow selecting scheduled execution', () => {
      cy.get('input[value="scheduled"]').click();
      cy.get('input[value="scheduled"]').should('be.checked');
      
      // Should show time and timezone selectors
      cy.get('input[type="time"]').should('be.visible');
      cy.get('select').contains('UTC').should('be.visible');
      
      // Set a specific time
      cy.get('input[type="time"]').type('14:30');
      cy.get('select').select('America/New_York');
      cy.contains('Job will be executed at the specified time').should('be.visible');
    });
  });

  describe('Job Creation and API Integration', () => {
    beforeEach(() => {
      // Mock the job scheduling API
      cy.intercept('POST', '/api/jobs', {
        statusCode: 200,
        body: {
          success: true,
          job: {
            name: 'telegram-crawl-2024-01-01T12-00-00-000Z',
            dueTime: 'now',
            data: {
              platform: 'telegram',
              urls: ['@testchannel']
            }
          }
        }
      }).as('scheduleJob');
      
      // Configure a complete job
      cy.get('input[placeholder*="Telegram Sentiment Analysis"]').type('API Test Job');
      cy.contains('button', 'Next').click();
      
      cy.get('textarea[placeholder*="@channel1"]').type('@testchannel');
      cy.contains('button', 'Next').click();
      
      cy.contains('button', 'Next').click();
    });

    it('should successfully schedule an immediate job', () => {
      // Ensure immediate execution is selected
      cy.get('input[value="immediate"]').should('be.checked');
      
      // Schedule the job
      cy.contains('button', 'Schedule Crawler Job').click();
      
      // Should show loading state
      cy.contains('Scheduling Job...').should('be.visible');
      
      // Wait for API call
      cy.wait('@scheduleJob');
      
      // Should redirect to schedule tab
      cy.url().should('include', 'tab=schedule');
      cy.contains('API Test Job').should('be.visible');
    });

    it('should successfully schedule a delayed job', () => {
      // Select delayed execution
      cy.get('input[value="delayed"]').click();
      cy.get('select').select('30m');
      
      // Schedule the job
      cy.contains('button', 'Schedule Crawler Job').click();
      
      cy.wait('@scheduleJob');
      
      // Should redirect to schedule tab
      cy.url().should('include', 'tab=schedule');
      cy.contains('API Test Job').should('be.visible');
    });

    it('should handle API errors gracefully', () => {
      // Mock API error
      cy.intercept('POST', '/api/jobs', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('scheduleJobError');
      
      // Try to schedule job
      cy.contains('button', 'Schedule Crawler Job').click();
      
      cy.wait('@scheduleJobError');
      
      // Should show error message
      cy.contains('Scheduling Error').should('be.visible');
      cy.contains('Failed to schedule job').should('be.visible');
      
      // Should stay on review page
      cy.contains('h2', 'Review & Schedule').should('be.visible');
    });
  });

  describe('Platform-Specific Configuration', () => {
    it('should configure YouTube platform correctly', () => {
      cy.get('input[placeholder*="Telegram Sentiment Analysis"]').type('YouTube Test Job');
      cy.contains('button', 'Next').click();
      
      // Select YouTube platform
      cy.get('input[value="youtube"]').click();
      
      // Should show YouTube-specific fields
      cy.get('input[placeholder*="YouTube API Key"]').should('be.visible');
      
      // Fill in YouTube configuration
      cy.get('input[placeholder*="YouTube API Key"]').type('test-api-key-123');
      cy.get('textarea[placeholder*="Channel URLs"]').type('UCtest1\nUCtest2');
      
      cy.contains('button', 'Next').click();
      cy.contains('button', 'Next').click();
      
      // At review step, should show YouTube configuration
      cy.contains('youtube').should('be.visible');
    });

    it('should validate YouTube API key requirement', () => {
      cy.get('input[placeholder*="Telegram Sentiment Analysis"]').type('YouTube Validation Test');
      cy.contains('button', 'Next').click();
      
      // Select YouTube platform without API key
      cy.get('input[value="youtube"]').click();
      cy.get('textarea[placeholder*="Channel URLs"]').type('UCtest1');
      
      cy.contains('button', 'Next').click();
      cy.contains('button', 'Next').click();
      
      // Mock API validation error
      cy.intercept('POST', '/api/jobs', {
        statusCode: 400,
        body: { error: 'YouTube API key is required for YouTube platform' }
      }).as('validateJob');
      
      cy.contains('button', 'Schedule Crawler Job').click();
      
      cy.wait('@validateJob');
      
      // Should show validation error
      cy.contains('YouTube API key is required').should('be.visible');
    });
  });
});

describe('Job Management Integration', () => {
  beforeEach(() => {
    // Mock existing jobs
    cy.intercept('GET', '/api/jobs', {
      statusCode: 200,
      body: [
        {
          name: 'telegram-test-job-1',
          dueTime: '2024-01-01T15:00:00Z',
          data: {
            platform: 'telegram',
            urls: ['@channel1', '@channel2']
          },
          status: 'scheduled'
        },
        {
          name: 'youtube-test-job-1',
          dueTime: 'now',
          data: {
            platform: 'youtube',
            urls: ['UCtest1']
          },
          status: 'running'
        }
      ]
    }).as('getJobs');
    
    cy.visit('/data-capture?tab=schedule');
  });

  it('should display scheduled jobs correctly', () => {
    cy.wait('@getJobs');
    
    // Should show job cards
    cy.contains('telegram-test-job-1').should('be.visible');
    cy.contains('youtube-test-job-1').should('be.visible');
    
    // Should show correct status
    cy.contains('scheduled').should('be.visible');
    cy.contains('running').should('be.visible');
  });

  it('should allow deleting scheduled jobs', () => {
    cy.intercept('DELETE', '/api/jobs?name=telegram-test-job-1', {
      statusCode: 200,
      body: { success: true, message: 'Job deleted successfully' }
    }).as('deleteJob');
    
    cy.wait('@getJobs');
    
    // Find and click delete button (assuming there's a delete action)
    cy.get('[data-testid="job-telegram-test-job-1"]').within(() => {
      cy.get('button').contains('Delete').click();
    });
    
    cy.wait('@deleteJob');
    
    // Job should be removed from list
    cy.contains('telegram-test-job-1').should('not.exist');
  });
});

describe('Accessibility and User Experience', () => {
  beforeEach(() => {
    cy.visit('/data-capture?tab=crawler');
  });

  it('should be keyboard navigable', () => {
    // Tab through form elements
    cy.get('body').tab();
    cy.focused().should('have.attr', 'placeholder').and('include', 'Telegram Sentiment Analysis');
    
    cy.focused().tab();
    cy.focused().should('have.attr', 'placeholder').and('include', 'test-crawl');
  });

  it('should have proper ARIA labels and roles', () => {
    // Check for proper labeling
    cy.get('input[placeholder*="Telegram Sentiment Analysis"]')
      .should('have.attr', 'aria-label')
      .or('have.attr', 'aria-labelledby');
    
    // Check for form validation messages
    cy.contains('button', 'Next').click();
    // Should have accessible error messages
    cy.get('[role="alert"], .text-red-600').should('exist');
  });

  it('should provide clear feedback during job scheduling', () => {
    // Configure minimal job
    cy.get('input[placeholder*="Telegram Sentiment Analysis"]').type('UX Test');
    cy.contains('button', 'Next').click();
    cy.get('textarea[placeholder*="@channel1"]').type('@test');
    cy.contains('button', 'Next').click();
    cy.contains('button', 'Next').click();
    
    // Mock slow API response
    cy.intercept('POST', '/api/jobs', (req) => {
      // Delay response by 2 seconds
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            statusCode: 200,
            body: { success: true, job: { name: 'test-job' } }
          });
        }, 2000);
      });
    }).as('slowSchedule');
    
    // Click schedule button
    cy.contains('button', 'Schedule Crawler Job').click();
    
    // Should show loading state immediately
    cy.contains('Scheduling Job...').should('be.visible');
    cy.get('.animate-spin').should('be.visible');
    
    // Button should be disabled during loading
    cy.contains('button', 'Scheduling Job...').should('be.disabled');
    
    cy.wait('@slowSchedule');
    
    // Should return to normal state after completion
    cy.url().should('include', 'tab=schedule');
  });
});