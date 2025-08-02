describe('Error Handling and Edge Cases', () => {
  describe('Network and API Errors', () => {
    it('should handle complete network failure', () => {
      cy.intercept('**', { forceNetworkError: true }).as('networkFailure')
      cy.visit('/dashboards', { failOnStatusCode: false })
      
      cy.get('[data-cy="network-error"]').should('be.visible')
      cy.get('[data-cy="retry-connection"]').should('be.visible')
      cy.get('[data-cy="offline-mode"]').should('be.visible')
    })

    it('should handle 500 internal server errors', () => {
      cy.intercept('GET', '**/api/**', { statusCode: 500, body: 'Internal Server Error' }).as('serverError')
      cy.visitAndWait('/dashboards')
      
      cy.get('[data-cy="server-error"]').should('be.visible')
      cy.get('[data-cy="error-message"]').should('contain.text', 'Server error occurred')
      cy.get('[data-cy="error-code"]').should('contain.text', '500')
    })

    it('should handle 404 not found errors', () => {
      cy.intercept('GET', '**/api/**', { statusCode: 404 }).as('notFound')
      cy.visitAndWait('/dashboards')
      
      cy.get('[data-cy="not-found-error"]').should('be.visible')
      cy.get('[data-cy="error-message"]').should('contain.text', 'Resource not found')
    })

    it('should handle 403 forbidden errors', () => {
      cy.intercept('GET', '**/api/**', { statusCode: 403 }).as('forbidden')
      cy.visitAndWait('/dashboards')
      
      cy.get('[data-cy="access-denied"]').should('be.visible')
      cy.get('[data-cy="error-message"]').should('contain.text', 'Access denied')
    })

    it('should handle timeout errors', () => {
      cy.intercept('GET', '**/api/**', (req) => {
        req.reply({ delay: 15000, statusCode: 200, body: {} })
      }).as('timeout')
      
      cy.visitAndWait('/dashboards')
      cy.get('[data-cy="timeout-error"]').should('be.visible')
      cy.get('[data-cy="timeout-message"]').should('contain.text', 'Request timed out')
    })

    it('should handle malformed JSON responses', () => {
      cy.intercept('GET', '**/api/**', { body: 'invalid json response' }).as('malformedJSON')
      cy.visitAndWait('/dashboards')
      
      cy.get('[data-cy="parse-error"]').should('be.visible')
      cy.get('[data-cy="error-message"]').should('contain.text', 'Invalid response format')
    })
  })

  describe('Database Connection Errors', () => {
    it('should handle DuckDB connection failures', () => {
      cy.intercept('GET', '**/api/unified-analytics**', { 
        statusCode: 503, 
        body: { success: false, error: 'Database connection failed' }
      }).as('dbConnectionError')
      
      cy.visitAndWait('/text-analytics/sentiment-analysis')
      cy.wait('@dbConnectionError')
      
      cy.get('[data-cy="database-error"]').should('be.visible')
      cy.get('[data-cy="error-message"]').should('contain.text', 'Database connection required')
      cy.get('[data-cy="reconnect-button"]').should('be.visible')
    })

    it('should handle database query errors', () => {
      cy.intercept('GET', '**/api/unified-analytics**', { 
        statusCode: 500, 
        body: { success: false, error: 'SQL query failed' }
      }).as('queryError')
      
      cy.visitAndWait('/text-analytics/topic-modeling')
      cy.wait('@queryError')
      
      cy.get('[data-cy="query-error"]').should('be.visible')
      cy.get('[data-cy="error-details"]').should('contain.text', 'Query execution failed')
    })

    it('should handle database schema errors', () => {
      cy.intercept('GET', '**/api/unified-analytics**', { 
        statusCode: 500, 
        body: { success: false, error: 'Table does not exist' }
      }).as('schemaError')
      
      cy.visitAndWait('/dashboards')
      cy.wait('@schemaError')
      
      cy.get('[data-cy="schema-error"]').should('be.visible')
      cy.get('[data-cy="error-message"]').should('contain.text', 'Database schema error')
    })
  })

  describe('Form Validation Errors', () => {
    beforeEach(() => {
      cy.visitAndWait('/data-capture')
    })

    it('should validate required fields', () => {
      cy.get('[data-cy="start-crawl-button"]').click()
      
      cy.get('[data-cy="job-name-input"]').should('have.class', 'error')
      cy.get('[data-cy="platform-select"]').should('have.class', 'error')
      cy.get('[data-cy="validation-summary"]').should('be.visible')
      cy.get('[data-cy="validation-summary"]').should('contain.text', '2 errors found')
    })

    it('should validate field formats', () => {
      cy.fillFormField('[data-cy="job-name-input"]', '   ')  // Only whitespace
      cy.get('[data-cy="job-name-input"]').blur()
      
      cy.get('[data-cy="field-error"]').should('be.visible')
      cy.get('[data-cy="field-error"]').should('contain.text', 'Job name cannot be empty')
    })

    it('should validate numeric fields', () => {
      cy.get('[data-cy="advanced-settings"]').click()
      cy.fillFormField('[data-cy="concurrency-input"]', 'not-a-number')
      cy.get('[data-cy="concurrency-input"]').blur()
      
      cy.get('[data-cy="field-error"]').should('be.visible')
      cy.get('[data-cy="field-error"]').should('contain.text', 'Must be a valid number')
    })

    it('should validate field ranges', () => {
      cy.get('[data-cy="advanced-settings"]').click()
      cy.fillFormField('[data-cy="concurrency-input"]', '0')
      cy.get('[data-cy="concurrency-input"]').blur()
      
      cy.get('[data-cy="field-error"]').should('be.visible')
      cy.get('[data-cy="field-error"]').should('contain.text', 'Must be between 1 and 100')
    })

    it('should validate URL formats', () => {
      cy.selectDropdownOption('[data-cy="platform-select"]', 'twitter')
      cy.fillFormField('[data-cy="url-input"]', 'invalid-url-format')
      cy.get('[data-cy="add-url-button"]').click()
      
      cy.get('[data-cy="url-error"]').should('be.visible')
      cy.get('[data-cy="url-error"]').should('contain.text', 'Invalid URL format')
    })

    it('should validate file uploads', () => {
      cy.get('[data-cy="file-upload"]').selectFile('cypress/fixtures/invalid-file.txt', { force: true })
      
      cy.get('[data-cy="file-error"]').should('be.visible')
      cy.get('[data-cy="file-error"]').should('contain.text', 'Invalid file type')
    })
  })

  describe('Authentication and Authorization Errors', () => {
    it('should handle expired session', () => {
      cy.intercept('GET', '**/api/**', { statusCode: 401, body: 'Unauthorized' }).as('unauthorized')
      cy.visitAndWait('/dashboards')
      
      cy.get('[data-cy="session-expired"]').should('be.visible')
      cy.get('[data-cy="login-required"]').should('be.visible')
      cy.get('[data-cy="relogin-button"]').should('be.visible')
    })

    it('should handle insufficient permissions', () => {
      cy.intercept('GET', '**/api/admin/**', { statusCode: 403 }).as('accessDenied')
      cy.visit('/admin/settings', { failOnStatusCode: false })
      
      cy.get('[data-cy="access-denied"]').should('be.visible')
      cy.get('[data-cy="permission-error"]').should('contain.text', 'Insufficient permissions')
    })
  })

  describe('Data Validation and Edge Cases', () => {
    it('should handle empty datasets gracefully', () => {
      cy.intercept('GET', '**/api/sentiment-analysis**', { 
        success: true, 
        data: [] 
      }).as('emptyData')
      
      cy.visitAndWait('/text-analytics/sentiment-analysis')
      cy.wait('@emptyData')
      
      cy.get('[data-cy="empty-state"]').should('be.visible')
      cy.get('[data-cy="empty-message"]').should('contain.text', 'No sentiment data available')
      cy.get('[data-cy="import-data-button"]').should('be.visible')
    })

    it('should handle corrupted data gracefully', () => {
      cy.intercept('GET', '**/api/topic-modeling**', { 
        success: true, 
        data: [
          { id: null, name: '', category: undefined },  // Invalid data
          { id: 'valid', name: 'Valid Topic', category: 'Technology' }  // Valid data
        ]
      }).as('corruptedData')
      
      cy.visitAndWait('/text-analytics/topic-modeling')
      cy.wait('@corruptedData')
      
      cy.get('[data-cy="data-warning"]').should('be.visible')
      cy.get('[data-cy="topic-card"]').should('have.length', 1)  // Only valid data shown
    })

    it('should handle extremely large datasets', () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        sentiment: 'positive',
        confidence: Math.random()
      }))
      
      cy.intercept('GET', '**/api/sentiment-analysis**', { 
        success: true, 
        data: largeDataset 
      }).as('largeDataset')
      
      cy.visitAndWait('/text-analytics/sentiment-analysis')
      cy.wait('@largeDataset')
      
      // Should handle large dataset without crashing
      cy.get('[data-cy="large-dataset-warning"]').should('be.visible')
      cy.get('[data-cy="pagination"]').should('be.visible')
    })

    it('should handle special characters and encoding', () => {
      cy.intercept('GET', '**/api/topic-modeling**', { 
        success: true, 
        data: [{
          id: 'special-chars',
          name: '测试主题 🌟 Тест émojis',
          category: 'Special Characters',
          keywords: ['测试', '🌟', 'émoji', 'Тест']
        }]
      }).as('specialChars')
      
      cy.visitAndWait('/text-analytics/topic-modeling')
      cy.wait('@specialChars')
      
      cy.get('[data-cy="topic-name"]').should('contain.text', '测试主题 🌟 Тест émojis')
      cy.get('[data-cy="keyword-tag"]').should('contain.text', '🌟')
    })
  })

  describe('Browser Compatibility and Edge Cases', () => {
    it('should handle local storage unavailability', () => {
      cy.window().then((win) => {
        Object.defineProperty(win, 'localStorage', {
          value: null,
          writable: false
        })
      })
      
      cy.visitAndWait('/dashboards')
      cy.get('[data-cy="storage-warning"]').should('be.visible')
      cy.get('[data-cy="storage-warning"]').should('contain.text', 'Local storage unavailable')
    })

    it('should handle JavaScript disabled scenarios', () => {
      // This would typically be tested with a different tool
      // but we can test the noscript fallback
      cy.get('noscript').should('exist')
    })

    it('should handle memory constraints', () => {
      // Simulate memory pressure by creating large objects
      cy.window().then((win) => {
        const largeArray = new Array(1000000).fill('memory test')
        win.testMemoryPressure = largeArray
      })
      
      cy.visitAndWait('/text-analytics/sentiment-analysis')
      cy.get('[data-cy="sentiment-stats"]').should('be.visible')
    })
  })

  describe('Recovery and Retry Mechanisms', () => {
    it('should provide retry functionality for failed requests', () => {
      let callCount = 0
      cy.intercept('GET', '**/api/dashboard**', (req) => {
        callCount++
        if (callCount < 3) {
          req.reply({ statusCode: 500 })
        } else {
          req.reply({ fixture: 'dashboard-stats.json' })
        }
      }).as('retryableRequest')
      
      cy.visitAndWait('/dashboards')
      cy.get('[data-cy="retry-button"]').click()
      cy.get('[data-cy="retry-button"]').click()
      
      cy.wait('@retryableRequest')
      cy.get('[data-cy="dashboard-stats"]').should('be.visible')
    })

    it('should implement exponential backoff for retries', () => {
      const timestamps = []
      cy.intercept('GET', '**/api/**', (req) => {
        timestamps.push(Date.now())
        req.reply({ statusCode: 500 })
      }).as('backoffRequest')
      
      cy.visitAndWait('/dashboards')
      cy.get('[data-cy="auto-retry-enabled"]').should('be.visible')
      
      cy.wait(10000) // Wait for multiple retry attempts
      cy.then(() => {
        expect(timestamps.length).to.be.greaterThan(1)
        // Verify increasing delays between retries
        const delays = timestamps.slice(1).map((time, i) => time - timestamps[i])
        expect(delays[1]).to.be.greaterThan(delays[0])
      })
    })

    it('should cache responses for offline usage', () => {
      // First load with network
      cy.intercept('GET', '**/api/dashboard**', { fixture: 'dashboard-stats.json' }).as('initialLoad')
      cy.visitAndWait('/dashboards')
      cy.wait('@initialLoad')
      
      // Then simulate network failure
      cy.intercept('GET', '**/api/dashboard**', { forceNetworkError: true }).as('networkFailure')
      cy.reload()
      
      // Should show cached data
      cy.get('[data-cy="cached-data-indicator"]').should('be.visible')
      cy.get('[data-cy="dashboard-stats"]').should('be.visible')
    })
  })

  describe('Cross-Browser Compatibility', () => {
    it('should handle different viewport sizes gracefully', () => {
      const viewports = [
        { width: 320, height: 568 },   // iPhone SE
        { width: 768, height: 1024 },  // iPad
        { width: 1920, height: 1080 }  // Desktop
      ]
      
      viewports.forEach((viewport) => {
        cy.viewport(viewport.width, viewport.height)
        cy.visitAndWait('/dashboards')
        cy.get('[data-cy="dashboard-stats"]').should('be.visible')
      })
    })

    it('should handle browser feature detection', () => {
      cy.window().then((win) => {
        // Mock missing modern features
        delete win.fetch
        delete win.IntersectionObserver
      })
      
      cy.visitAndWait('/dashboards')
      cy.get('[data-cy="feature-warning"]').should('be.visible')
      cy.get('[data-cy="legacy-fallback"]').should('be.visible')
    })
  })
})