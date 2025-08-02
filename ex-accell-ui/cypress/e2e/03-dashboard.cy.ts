describe('Dashboard Page', () => {
  beforeEach(() => {
    // Mock API responses for dashboard data
    cy.mockApiCall('overview', 'dashboard-stats.json')
    cy.visitAndWait('/dashboards')
  })

  describe('Dashboard Layout', () => {
    it('should display the dashboard title', () => {
      cy.get('h1').should('contain.text', 'Analytics Dashboard')
    })

    it('should display key metrics cards', () => {
      cy.get('[data-cy="metrics-grid"]').should('be.visible')
      cy.get('[data-cy="metric-card"]').should('have.length.at.least', 4)
      
      // Check for specific metrics
      cy.get('[data-cy="total-posts"]').should('be.visible')
      cy.get('[data-cy="total-sources"]').should('be.visible')
      cy.get('[data-cy="active-crawlers"]').should('be.visible')
      cy.get('[data-cy="data-quality"]').should('be.visible')
    })

    it('should display data source breakdown', () => {
      cy.get('[data-cy="data-sources-section"]').should('be.visible')
      cy.get('[data-cy="data-source-item"]').should('have.length.at.least', 5)
    })

    it('should display charts and visualizations', () => {
      cy.get('[data-cy="charts-section"]').should('be.visible')
      cy.checkChartExists('[data-cy="sentiment-chart"]')
      cy.checkChartExists('[data-cy="activity-chart"]')
    })
  })

  describe('Interactive Elements', () => {
    it('should allow filtering by time range', () => {
      cy.get('[data-cy="time-range-filter"]').should('be.visible')
      cy.selectDropdownOption('[data-cy="time-range-filter"]', '7d')
      cy.waitForLoading()
      
      // Verify data updated
      cy.get('[data-cy="metrics-grid"]').should('be.visible')
    })

    it('should allow filtering by data source', () => {
      cy.get('[data-cy="source-filter"]').should('be.visible')
      cy.get('[data-cy="source-filter-twitter"]').click()
      cy.waitForLoading()
      
      // Check that filter is applied
      cy.get('[data-cy="source-filter-twitter"]').should('have.class', 'active')
    })

    it('should display real-time updates', () => {
      cy.get('[data-cy="last-updated"]').should('be.visible')
      cy.get('[data-cy="refresh-button"]').click()
      cy.waitForLoading()
    })
  })

  describe('Data Export', () => {
    it('should allow exporting dashboard data', () => {
      cy.get('[data-cy="export-button"]').should('be.visible')
      cy.testExport('[data-cy="export-button"]')
    })

    it('should show export options modal', () => {
      cy.openModal('[data-cy="export-button"]', '[data-cy="export-modal"]')
      
      cy.get('[data-cy="export-modal"]').within(() => {
        cy.contains('Export Format').should('be.visible')
        cy.get('select[name="format"]').should('be.visible')
        cy.get('button[type="submit"]').should('be.visible')
      })
      
      cy.closeModal('[data-cy="export-modal"]')
    })
  })

  describe('Responsive Design', () => {
    it('should adapt to mobile layout', () => {
      cy.viewport(375, 667)
      cy.get('[data-cy="metrics-grid"]').should('be.visible')
      cy.get('[data-cy="metric-card"]').should('be.visible')
    })

    it('should adapt to tablet layout', () => {
      cy.viewport(768, 1024)
      cy.get('[data-cy="metrics-grid"]').should('be.visible')
      cy.get('[data-cy="charts-section"]').should('be.visible')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      // Mock API error
      cy.intercept('GET', '**/api/overview**', { statusCode: 500 }).as('apiError')
      cy.reload()
      
      cy.get('[data-cy="error-message"]').should('be.visible')
      cy.get('[data-cy="error-message"]').should('contain.text', 'Database connection required')
    })

    it('should show loading states', () => {
      cy.intercept('GET', '**/api/overview**', (req) => {
        req.reply({ delay: 2000, fixture: 'dashboard-stats.json' })
      }).as('slowApi')
      
      cy.reload()
      cy.get('[data-cy="loading"]').should('be.visible')
      cy.wait('@slowApi')
      cy.get('[data-cy="loading"]').should('not.exist')
    })

    it('should handle empty data states', () => {
      cy.intercept('GET', '**/api/overview**', { 
        success: true, 
        data: { total_posts: 0, total_sources: 0 } 
      }).as('emptyData')
      
      cy.reload()
      cy.wait('@emptyData')
      cy.get('[data-cy="empty-state"]').should('be.visible')
    })
  })

  describe('Performance', () => {
    it('should load within acceptable time', () => {
      const start = Date.now()
      cy.visitAndWait('/dashboards')
      cy.then(() => {
        const loadTime = Date.now() - start
        expect(loadTime).to.be.lessThan(5000) // 5 seconds max
      })
    })

    it('should handle large datasets', () => {
      // Mock large dataset
      cy.intercept('GET', '**/api/overview**', { 
        fixture: 'dashboard-stats.json'
      }).as('largeDataset')
      
      cy.reload()
      cy.wait('@largeDataset')
      cy.get('[data-cy="metrics-grid"]').should('be.visible')
    })
  })
})