describe('Sentiment Analysis Page', () => {
  beforeEach(() => {
    // Mock API responses
    cy.mockApiCall('sentiment-analysis', 'sentiment-data.json')
    cy.visitAndWait('/text-analytics/sentiment-analysis')
  })

  describe('Page Layout', () => {
    it('should display the page title and description', () => {
      cy.get('h1').should('contain.text', 'Sentiment Analysis')
      cy.get('[data-cy="page-description"]').should('be.visible')
    })

    it('should display sentiment overview statistics', () => {
      cy.get('[data-cy="sentiment-stats"]').should('be.visible')
      cy.get('[data-cy="positive-count"]').should('be.visible')
      cy.get('[data-cy="negative-count"]').should('be.visible')
      cy.get('[data-cy="neutral-count"]').should('be.visible')
      cy.get('[data-cy="total-posts"]').should('be.visible')
    })

    it('should display sentiment distribution chart', () => {
      cy.checkChartExists('[data-cy="sentiment-pie-chart"]')
    })

    it('should display detailed sentiment breakdown', () => {
      cy.get('[data-cy="detailed-sentiments"]').should('be.visible')
      cy.get('[data-cy="sentiment-item"]').should('have.length', 5)
      
      // Check for all sentiment categories
      cy.contains('Very Positive').should('be.visible')
      cy.contains('Positive').should('be.visible')
      cy.contains('Neutral').should('be.visible')
      cy.contains('Negative').should('be.visible')
      cy.contains('Very Negative').should('be.visible')
    })
  })

  describe('Filtering and Interaction', () => {
    it('should allow filtering by platform', () => {
      cy.get('[data-cy="platform-filter"]').should('be.visible')
      cy.selectDropdownOption('[data-cy="platform-filter"]', 'twitter')
      cy.waitForLoading()
      
      // Verify filter is applied
      cy.url().should('include', 'platform=twitter')
    })

    it('should allow filtering by time range', () => {
      cy.get('[data-cy="time-range-filter"]').should('be.visible')
      cy.selectDropdownOption('[data-cy="time-range-filter"]', '30d')
      cy.waitForLoading()
    })

    it('should allow filtering by confidence threshold', () => {
      cy.get('[data-cy="confidence-filter"]').should('be.visible')
      cy.get('[data-cy="confidence-slider"]').invoke('val', 0.8).trigger('input')
      cy.waitForLoading()
    })

    it('should update charts when filters change', () => {
      // Apply filter and check chart updates
      cy.selectDropdownOption('[data-cy="platform-filter"]', 'facebook')
      cy.waitForLoading()
      
      // Chart should re-render
      cy.checkChartExists('[data-cy="sentiment-pie-chart"]')
      cy.get('[data-cy="sentiment-stats"]').should('be.visible')
    })
  })

  describe('Sample Posts Section', () => {
    it('should display sample posts table', () => {
      cy.get('[data-cy="sample-posts"]').should('be.visible')
      cy.checkDataTable('[data-cy="posts-table"]')
    })

    it('should show post details in table', () => {
      cy.get('[data-cy="posts-table"]').within(() => {
        cy.get('th').should('contain.text', 'Content')
        cy.get('th').should('contain.text', 'Sentiment')
        cy.get('th').should('contain.text', 'Confidence')
        cy.get('th').should('contain.text', 'Platform')
      })
    })

    it('should allow sorting posts by different columns', () => {
      cy.get('[data-cy="posts-table"] th').contains('Confidence').click()
      cy.wait(500)
      
      // Check that sorting is applied
      cy.get('[data-cy="posts-table"] th').contains('Confidence').should('have.class', 'sorted')
    })

    it('should paginate through posts', () => {
      cy.get('[data-cy="pagination"]').should('be.visible')
      cy.get('[data-cy="next-page"]').click()
      cy.waitForLoading()
      
      // Should show page 2
      cy.get('[data-cy="current-page"]').should('contain.text', '2')
    })
  })

  describe('Trends and Charts', () => {
    it('should display sentiment trends over time', () => {
      cy.get('[data-cy="sentiment-trends"]').should('be.visible')
      cy.checkChartExists('[data-cy="trends-chart"]')
    })

    it('should display emotion analysis chart', () => {
      cy.get('[data-cy="emotion-analysis"]').should('be.visible')
      cy.checkChartExists('[data-cy="emotion-chart"]')
    })

    it('should show platform comparison', () => {
      cy.get('[data-cy="platform-comparison"]').should('be.visible')
      cy.checkChartExists('[data-cy="platform-chart"]')
    })
  })

  describe('Export Functionality', () => {
    it('should allow exporting sentiment data', () => {
      cy.get('[data-cy="export-sentiment"]').should('be.visible')
      cy.testExport('[data-cy="export-sentiment"]')
    })

    it('should show export options', () => {
      cy.openModal('[data-cy="export-sentiment"]', '[data-cy="export-modal"]')
      
      cy.get('[data-cy="export-modal"]').within(() => {
        cy.get('select[name="format"]').should('be.visible')
        cy.get('input[name="includeFilters"]').should('be.visible')
        cy.get('button[type="submit"]').should('contain.text', 'Export')
      })
      
      cy.closeModal('[data-cy="export-modal"]')
    })

    it('should export with applied filters', () => {
      // Apply filters first
      cy.selectDropdownOption('[data-cy="platform-filter"]', 'twitter')
      cy.selectDropdownOption('[data-cy="time-range-filter"]', '7d')
      
      // Then export
      cy.get('[data-cy="export-sentiment"]').click()
      cy.get('[data-cy="export-modal"]').within(() => {
        cy.get('input[name="includeFilters"]').check()
        cy.get('button[type="submit"]').click()
      })
      
      cy.get('.export-success').should('be.visible')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      cy.intercept('GET', '**/api/sentiment-analysis**', { statusCode: 500 }).as('apiError')
      cy.reload()
      
      cy.get('[data-cy="error-message"]').should('be.visible')
      cy.get('[data-cy="error-message"]').should('contain.text', 'Database connection required')
    })

    it('should handle empty sentiment data', () => {
      cy.intercept('GET', '**/api/sentiment-analysis**', { 
        success: true, 
        data: [] 
      }).as('emptyData')
      
      cy.reload()
      cy.wait('@emptyData')
      cy.get('[data-cy="empty-state"]').should('be.visible')
      cy.get('[data-cy="empty-state"]').should('contain.text', 'No sentiment data available')
    })

    it('should handle invalid filter values', () => {
      // Try to set invalid confidence threshold
      cy.get('[data-cy="confidence-slider"]').invoke('val', 2).trigger('input')
      cy.get('[data-cy="validation-error"]').should('be.visible')
    })
  })

  describe('Responsive Design', () => {
    it('should adapt sentiment cards to mobile layout', () => {
      cy.viewport(375, 667)
      cy.get('[data-cy="sentiment-stats"]').should('be.visible')
      cy.get('[data-cy="sentiment-item"]').should('be.visible')
    })

    it('should make charts responsive', () => {
      cy.viewport(768, 1024)
      cy.checkChartExists('[data-cy="sentiment-pie-chart"]')
      cy.checkChartExists('[data-cy="trends-chart"]')
    })

    it('should adapt table to mobile', () => {
      cy.viewport(375, 667)
      cy.get('[data-cy="posts-table"]').should('be.visible')
      // Table should be scrollable or stacked on mobile
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for charts', () => {
      cy.get('[data-cy="sentiment-pie-chart"]').should('have.attr', 'aria-label')
      cy.get('[data-cy="trends-chart"]').should('have.attr', 'aria-label')
    })

    it('should support keyboard navigation', () => {
      cy.get('[data-cy="platform-filter"]').focus()
      cy.focused().should('have.attr', 'data-cy', 'platform-filter')
      
      cy.get('body').tab()
      cy.focused().should('be.visible')
    })

    it('should have proper color contrast for sentiment indicators', () => {
      cy.get('[data-cy="sentiment-item"]').each(($item) => {
        cy.wrap($item).should('be.visible')
        // Could add color contrast validation here
      })
    })
  })
})