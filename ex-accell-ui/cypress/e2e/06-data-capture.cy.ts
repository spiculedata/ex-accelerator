describe('Data Capture Page', () => {
  beforeEach(() => {
    cy.visitAndWait('/data-capture')
  })

  describe('Page Layout', () => {
    it('should display the page title and description', () => {
      cy.get('h1').should('contain.text', 'Data Capture')
      cy.get('[data-cy="page-description"]').should('be.visible')
    })

    it('should display crawl configuration form', () => {
      cy.get('[data-cy="crawl-config-form"]').should('be.visible')
      cy.get('[data-cy="job-name-input"]').should('be.visible')
      cy.get('[data-cy="platform-select"]').should('be.visible')
    })

    it('should display crawl status dashboard', () => {
      cy.get('[data-cy="crawl-status"]').should('be.visible')
      cy.get('[data-cy="active-crawls"]').should('be.visible')
      cy.get('[data-cy="crawl-history"]').should('be.visible')
    })
  })

  describe('Crawl Configuration', () => {
    it('should allow setting basic crawl parameters', () => {
      cy.fillFormField('[data-cy="job-name-input"]', 'Test Crawl Job')
      cy.selectDropdownOption('[data-cy="platform-select"]', 'twitter')
      cy.fillFormField('[data-cy="crawl-id-input"]', 'test-crawl-001')
      
      // Verify values are set
      cy.get('[data-cy="job-name-input"]').should('have.value', 'Test Crawl Job')
      cy.get('[data-cy="platform-select"]').should('have.value', 'twitter')
    })

    it('should show platform-specific configuration options', () => {
      cy.selectDropdownOption('[data-cy="platform-select"]', 'twitter')
      cy.get('[data-cy="twitter-config"]').should('be.visible')
      cy.get('[data-cy="direct-urls-section"]').should('be.visible')
      
      cy.selectDropdownOption('[data-cy="platform-select"]', 'youtube')
      cy.get('[data-cy="youtube-config"]').should('be.visible')
      cy.get('[data-cy="youtube-api-key"]').should('be.visible')
    })

    it('should allow setting advanced parameters', () => {
      cy.get('[data-cy="advanced-settings"]').click()
      
      cy.get('[data-cy="concurrency-input"]').clear().type('5')
      cy.get('[data-cy="timeout-input"]').clear().type('30')
      cy.selectDropdownOption('[data-cy="log-level-select"]', 'DEBUG')
      
      // Verify advanced settings
      cy.get('[data-cy="concurrency-input"]').should('have.value', '5')
      cy.get('[data-cy="timeout-input"]').should('have.value', '30')
    })

    it('should validate required fields', () => {
      cy.get('[data-cy="start-crawl-button"]').click()
      
      cy.get('[data-cy="validation-error"]').should('be.visible')
      cy.get('[data-cy="job-name-input"]').should('have.class', 'error')
    })

    it('should allow adding multiple URLs', () => {
      cy.selectDropdownOption('[data-cy="platform-select"]', 'twitter')
      cy.get('[data-cy="url-input"]').type('https://twitter.com/example1')
      cy.get('[data-cy="add-url-button"]').click()
      
      cy.get('[data-cy="url-input"]').clear().type('https://twitter.com/example2')
      cy.get('[data-cy="add-url-button"]').click()
      
      cy.get('[data-cy="url-list-item"]').should('have.length', 2)
    })

    it('should allow removing URLs from list', () => {
      cy.selectDropdownOption('[data-cy="platform-select"]', 'twitter')
      cy.get('[data-cy="url-input"]').type('https://twitter.com/example')
      cy.get('[data-cy="add-url-button"]').click()
      
      cy.get('[data-cy="remove-url-button"]').first().click()
      cy.get('[data-cy="url-list-item"]').should('have.length', 0)
    })
  })

  describe('Crawl Management', () => {
    it('should start a crawl job', () => {
      // Fill required fields
      cy.fillFormField('[data-cy="job-name-input"]', 'Test Crawl')
      cy.selectDropdownOption('[data-cy="platform-select"]', 'twitter')
      cy.get('[data-cy="url-input"]').type('https://twitter.com/example')
      cy.get('[data-cy="add-url-button"]').click()
      
      cy.get('[data-cy="start-crawl-button"]').click()
      
      cy.get('[data-cy="success-message"]').should('be.visible')
      cy.get('[data-cy="success-message"]').should('contain.text', 'Crawl job started')
    })

    it('should display active crawl status', () => {
      cy.get('[data-cy="active-crawls"]').should('be.visible')
      cy.get('[data-cy="crawl-status-item"]').should('exist')
      
      cy.get('[data-cy="crawl-status-item"]').first().within(() => {
        cy.get('[data-cy="job-name"]').should('be.visible')
        cy.get('[data-cy="status-badge"]').should('be.visible')
        cy.get('[data-cy="progress-bar"]').should('be.visible')
      })
    })

    it('should allow stopping active crawls', () => {
      cy.get('[data-cy="crawl-status-item"]').first().within(() => {
        cy.get('[data-cy="stop-crawl-button"]').click()
      })
      
      cy.get('[data-cy="confirm-stop-modal"]').should('be.visible')
      cy.get('[data-cy="confirm-stop-button"]').click()
      
      cy.get('[data-cy="success-message"]').should('contain.text', 'Crawl stopped')
    })

    it('should show crawl logs', () => {
      cy.get('[data-cy="crawl-status-item"]').first().within(() => {
        cy.get('[data-cy="view-logs-button"]').click()
      })
      
      cy.get('[data-cy="logs-modal"]').should('be.visible')
      cy.get('[data-cy="log-entries"]').should('be.visible')
      cy.get('[data-cy="log-entry"]').should('have.length.at.least', 1)
      
      cy.closeModal('[data-cy="logs-modal"]')
    })
  })

  describe('Scheduling', () => {
    it('should allow scheduling recurring crawls', () => {
      cy.get('[data-cy="schedule-section"]').should('be.visible')
      cy.get('[data-cy="enable-schedule"]').check()
      
      cy.selectDropdownOption('[data-cy="frequency-select"]', 'daily')
      cy.fillFormField('[data-cy="schedule-time"]', '09:00')
      
      cy.get('[data-cy="schedule-preview"]').should('be.visible')
      cy.get('[data-cy="schedule-preview"]').should('contain.text', 'Daily at 09:00')
    })

    it('should validate schedule parameters', () => {
      cy.get('[data-cy="enable-schedule"]').check()
      cy.get('[data-cy="save-schedule-button"]').click()
      
      cy.get('[data-cy="validation-error"]').should('be.visible')
      cy.get('[data-cy="frequency-select"]').should('have.class', 'error')
    })

    it('should show scheduled crawl history', () => {
      cy.get('[data-cy="crawl-history"]').should('be.visible')
      cy.checkDataTable('[data-cy="history-table"]')
      
      cy.get('[data-cy="history-table"]').within(() => {
        cy.get('th').should('contain.text', 'Job Name')
        cy.get('th').should('contain.text', 'Status')
        cy.get('th').should('contain.text', 'Started')
        cy.get('th').should('contain.text', 'Duration')
      })
    })
  })

  describe('Data Output and Results', () => {
    it('should show crawl results summary', () => {
      cy.get('[data-cy="results-section"]').should('be.visible')
      cy.get('[data-cy="crawled-items"]').should('be.visible')
      cy.get('[data-cy="success-rate"]').should('be.visible')
    })

    it('should allow downloading crawl results', () => {
      cy.get('[data-cy="download-results"]').should('be.visible')
      cy.testExport('[data-cy="download-results"]')
    })

    it('should show sample crawled data', () => {
      cy.get('[data-cy="sample-data"]').should('be.visible')
      cy.checkDataTable('[data-cy="sample-data-table"]')
    })
  })

  describe('Error Handling', () => {
    it('should handle crawl startup failures', () => {
      // Mock API error
      cy.intercept('POST', '**/api/crawl/start', { statusCode: 500 }).as('startError')
      
      cy.fillFormField('[data-cy="job-name-input"]', 'Test Crawl')
      cy.selectDropdownOption('[data-cy="platform-select"]', 'twitter')
      cy.get('[data-cy="start-crawl-button"]').click()
      
      cy.wait('@startError')
      cy.get('[data-cy="error-message"]').should('be.visible')
      cy.get('[data-cy="error-message"]').should('contain.text', 'Failed to start crawl')
    })

    it('should handle invalid URL formats', () => {
      cy.selectDropdownOption('[data-cy="platform-select"]', 'twitter')
      cy.get('[data-cy="url-input"]').type('invalid-url')
      cy.get('[data-cy="add-url-button"]').click()
      
      cy.get('[data-cy="url-validation-error"]').should('be.visible')
      cy.get('[data-cy="url-validation-error"]').should('contain.text', 'Invalid URL format')
    })

    it('should handle platform API key errors', () => {
      cy.selectDropdownOption('[data-cy="platform-select"]', 'youtube')
      cy.fillFormField('[data-cy="youtube-api-key"]', 'invalid-key')
      cy.get('[data-cy="validate-key-button"]').click()
      
      cy.get('[data-cy="key-validation-error"]').should('be.visible')
    })

    it('should handle network connectivity issues', () => {
      cy.intercept('GET', '**/api/crawl/status', { forceNetworkError: true }).as('networkError')
      cy.reload()
      
      cy.get('[data-cy="connectivity-error"]').should('be.visible')
      cy.get('[data-cy="retry-connection"]').should('be.visible')
    })
  })

  describe('Responsive Design', () => {
    it('should adapt form layout to mobile', () => {
      cy.viewport(375, 667)
      cy.get('[data-cy="crawl-config-form"]').should('be.visible')
      cy.get('[data-cy="form-fields"]').should('have.class', 'mobile-layout')
    })

    it('should make status dashboard responsive', () => {
      cy.viewport(768, 1024)
      cy.get('[data-cy="crawl-status"]').should('be.visible')
      cy.get('[data-cy="status-cards"]').should('be.visible')
    })

    it('should adapt data tables to mobile', () => {
      cy.viewport(375, 667)
      cy.get('[data-cy="history-table"]').should('be.visible')
      // Table should be horizontally scrollable on mobile
      cy.get('[data-cy="table-container"]').should('have.css', 'overflow-x', 'auto')
    })
  })

  describe('Performance and Loading', () => {
    it('should show loading states during crawl operations', () => {
      cy.intercept('POST', '**/api/crawl/start', (req) => {
        req.reply({ delay: 2000, statusCode: 200, body: { success: true } })
      }).as('slowStart')
      
      cy.fillFormField('[data-cy="job-name-input"]', 'Test Crawl')
      cy.selectDropdownOption('[data-cy="platform-select"]', 'twitter')
      cy.get('[data-cy="start-crawl-button"]').click()
      
      cy.get('[data-cy="start-crawl-button"]').should('contain.text', 'Starting...')
      cy.get('[data-cy="start-crawl-button"]').should('be.disabled')
      
      cy.wait('@slowStart')
      cy.get('[data-cy="start-crawl-button"]').should('not.be.disabled')
    })

    it('should update crawl status in real-time', () => {
      // Mock real-time updates
      cy.intercept('GET', '**/api/crawl/status', { fixture: 'crawl-status.json' }).as('statusUpdate')
      
      cy.wait('@statusUpdate')
      cy.get('[data-cy="progress-bar"]').should('be.visible')
      cy.get('[data-cy="items-crawled"]').should('contain.text', /\d+/)
    })
  })
})