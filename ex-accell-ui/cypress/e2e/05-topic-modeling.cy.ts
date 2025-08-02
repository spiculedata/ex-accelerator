describe('Topic Modeling Page', () => {
  beforeEach(() => {
    cy.mockApiCall('topic-modeling', 'topics-data.json')
    cy.visitAndWait('/text-analytics/topic-modeling')
  })

  describe('Page Layout', () => {
    it('should display the page title and description', () => {
      cy.get('h1').should('contain.text', 'Topic Modeling')
      cy.get('[data-cy="page-description"]').should('be.visible')
    })

    it('should display topic overview statistics', () => {
      cy.get('[data-cy="topic-stats"]').should('be.visible')
      cy.get('[data-cy="total-topics"]').should('be.visible')
      cy.get('[data-cy="total-documents"]').should('be.visible')
      cy.get('[data-cy="avg-coherence"]').should('be.visible')
    })

    it('should display topics grid', () => {
      cy.get('[data-cy="topics-grid"]').should('be.visible')
      cy.get('[data-cy="topic-card"]').should('have.length.at.least', 3)
    })

    it('should display topic categories', () => {
      cy.get('[data-cy="category-filter"]').should('be.visible')
      cy.get('[data-cy="category-item"]').should('have.length.at.least', 3)
    })
  })

  describe('Topic Cards', () => {
    it('should display topic information in cards', () => {
      cy.get('[data-cy="topic-card"]').first().within(() => {
        cy.get('[data-cy="topic-name"]').should('be.visible')
        cy.get('[data-cy="topic-category"]').should('be.visible')
        cy.get('[data-cy="topic-size"]').should('be.visible')
        cy.get('[data-cy="topic-keywords"]').should('be.visible')
      })
    })

    it('should show topic keywords as tags', () => {
      cy.get('[data-cy="topic-card"]').first().within(() => {
        cy.get('[data-cy="keyword-tag"]').should('have.length.at.least', 3)
      })
    })

    it('should display topic weight/importance', () => {
      cy.get('[data-cy="topic-card"]').first().within(() => {
        cy.get('[data-cy="topic-weight"]').should('be.visible')
        cy.get('[data-cy="weight-bar"]').should('be.visible')
      })
    })

    it('should allow clicking on topic cards for details', () => {
      cy.get('[data-cy="topic-card"]').first().click()
      cy.get('[data-cy="topic-detail-modal"]').should('be.visible')
      
      cy.get('[data-cy="topic-detail-modal"]').within(() => {
        cy.get('[data-cy="topic-documents"]').should('be.visible')
        cy.get('[data-cy="topic-relationships"]').should('be.visible')
      })
      
      cy.closeModal('[data-cy="topic-detail-modal"]')
    })
  })

  describe('Filtering and Search', () => {
    it('should allow filtering by category', () => {
      cy.get('[data-cy="category-filter"]').within(() => {
        cy.get('[data-cy="category-technology"]').click()
      })
      cy.waitForLoading()
      
      // Should show only technology topics
      cy.get('[data-cy="topic-card"]').each(($card) => {
        cy.wrap($card).find('[data-cy="topic-category"]').should('contain.text', 'Technology')
      })
    })

    it('should allow searching topics by name', () => {
      cy.fillFormField('[data-cy="topic-search"]', 'Artificial')
      cy.waitForLoading()
      
      // Should filter to matching topics
      cy.get('[data-cy="topic-card"]').should('have.length.at.least', 1)
      cy.get('[data-cy="topic-card"]').first().should('contain.text', 'Artificial')
    })

    it('should allow filtering by topic size', () => {
      cy.get('[data-cy="size-filter"]').should('be.visible')
      cy.get('[data-cy="min-size-input"]').type('500')
      cy.waitForLoading()
      
      // Should show only topics with size >= 500
      cy.get('[data-cy="topic-card"]').each(($card) => {
        cy.wrap($card).find('[data-cy="topic-size"]').invoke('text').then((text) => {
          const size = parseInt(text)
          expect(size).to.be.at.least(500)
        })
      })
    })

    it('should clear filters', () => {
      // Apply some filters
      cy.fillFormField('[data-cy="topic-search"]', 'test')
      cy.get('[data-cy="category-technology"]').click()
      
      // Clear filters
      cy.get('[data-cy="clear-filters"]').click()
      cy.waitForLoading()
      
      // Should show all topics again
      cy.get('[data-cy="topic-search"]').should('have.value', '')
      cy.get('[data-cy="topic-card"]').should('have.length.at.least', 3)
    })
  })

  describe('Visualizations', () => {
    it('should display topic treemap visualization', () => {
      cy.get('[data-cy="treemap-section"]').should('be.visible')
      cy.checkChartExists('[data-cy="topic-treemap"]')
    })

    it('should display topic relationships network', () => {
      cy.get('[data-cy="network-section"]').should('be.visible')
      cy.checkChartExists('[data-cy="topic-network"]')
    })

    it('should display topic trends over time', () => {
      cy.get('[data-cy="trends-section"]').should('be.visible')
      cy.checkChartExists('[data-cy="topic-trends-chart"]')
    })

    it('should allow interaction with treemap', () => {
      cy.get('[data-cy="topic-treemap"]').trigger('mouseover')
      cy.get('[data-cy="treemap-tooltip"]').should('be.visible')
    })
  })

  describe('Topic Analysis', () => {
    it('should show topic coherence scores', () => {
      cy.get('[data-cy="coherence-section"]').should('be.visible')
      cy.get('[data-cy="coherence-chart"]').should('be.visible')
    })

    it('should display topic-document relationships', () => {
      cy.get('[data-cy="topic-documents-section"]').should('be.visible')
      cy.checkDataTable('[data-cy="topic-documents-table"]')
    })

    it('should show top keywords per topic', () => {
      cy.get('[data-cy="topic-card"]').first().within(() => {
        cy.get('[data-cy="keyword-tag"]').should('have.length.at.least', 3)
        cy.get('[data-cy="keyword-tag"]').first().should('contain.text', /\w+/)
      })
    })
  })

  describe('Export and Download', () => {
    it('should allow exporting topic data', () => {
      cy.get('[data-cy="export-topics"]').should('be.visible')
      cy.testExport('[data-cy="export-topics"]')
    })

    it('should show export options modal', () => {
      cy.openModal('[data-cy="export-topics"]', '[data-cy="export-modal"]')
      
      cy.get('[data-cy="export-modal"]').within(() => {
        cy.get('select[name="format"]').should('be.visible')
        cy.get('input[name="includeKeywords"]').should('be.visible')
        cy.get('input[name="includeDocuments"]').should('be.visible')
        cy.get('button[type="submit"]').should('contain.text', 'Export')
      })
      
      cy.closeModal('[data-cy="export-modal"]')
    })

    it('should export topic model data', () => {
      cy.get('[data-cy="export-model"]').should('be.visible')
      cy.get('[data-cy="export-model"]').click()
      
      cy.get('[data-cy="model-export-modal"]').should('be.visible')
      cy.get('[data-cy="model-export-modal"]').within(() => {
        cy.get('select[name="modelFormat"]').should('be.visible')
        cy.get('button[type="submit"]').click()
      })
      
      cy.get('.export-success').should('be.visible')
    })
  })

  describe('Advanced Features', () => {
    it('should show topic modeling parameters', () => {
      cy.get('[data-cy="model-info"]').should('be.visible')
      cy.get('[data-cy="model-parameters"]').click()
      
      cy.get('[data-cy="parameters-modal"]').should('be.visible')
      cy.get('[data-cy="parameters-modal"]').within(() => {
        cy.contains('Algorithm').should('be.visible')
        cy.contains('Number of Topics').should('be.visible')
        cy.contains('Coherence Score').should('be.visible')
      })
      
      cy.closeModal('[data-cy="parameters-modal"]')
    })

    it('should allow topic comparison', () => {
      // Select multiple topics
      cy.get('[data-cy="topic-card"]').first().find('[data-cy="select-topic"]').check()
      cy.get('[data-cy="topic-card"]').eq(1).find('[data-cy="select-topic"]').check()
      
      cy.get('[data-cy="compare-topics"]').should('be.visible')
      cy.get('[data-cy="compare-topics"]').click()
      
      cy.get('[data-cy="comparison-modal"]').should('be.visible')
      cy.get('[data-cy="comparison-modal"]').within(() => {
        cy.get('[data-cy="similarity-score"]').should('be.visible')
        cy.get('[data-cy="common-keywords"]').should('be.visible')
      })
      
      cy.closeModal('[data-cy="comparison-modal"]')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      cy.intercept('GET', '**/api/topic-modeling**', { statusCode: 500 }).as('apiError')
      cy.reload()
      
      cy.get('[data-cy="error-message"]').should('be.visible')
      cy.get('[data-cy="error-message"]').should('contain.text', 'Database connection required')
    })

    it('should handle empty topic data', () => {
      cy.intercept('GET', '**/api/topic-modeling**', { 
        success: true, 
        data: [] 
      }).as('emptyData')
      
      cy.reload()
      cy.wait('@emptyData')
      cy.get('[data-cy="empty-state"]').should('be.visible')
      cy.get('[data-cy="empty-state"]').should('contain.text', 'No topics found')
    })

    it('should handle search with no results', () => {
      cy.fillFormField('[data-cy="topic-search"]', 'nonexistent topic')
      cy.waitForLoading()
      
      cy.get('[data-cy="no-results"]').should('be.visible')
      cy.get('[data-cy="no-results"]').should('contain.text', 'No topics match your search')
    })
  })

  describe('Responsive Design', () => {
    it('should adapt topic grid to mobile', () => {
      cy.viewport(375, 667)
      cy.get('[data-cy="topics-grid"]').should('be.visible')
      cy.get('[data-cy="topic-card"]').should('be.visible')
    })

    it('should make charts responsive', () => {
      cy.viewport(768, 1024)
      cy.checkChartExists('[data-cy="topic-treemap"]')
      cy.checkChartExists('[data-cy="topic-network"]')
    })

    it('should adapt filters to mobile', () => {
      cy.viewport(375, 667)
      cy.get('[data-cy="mobile-filters-toggle"]').should('be.visible')
      cy.get('[data-cy="mobile-filters-toggle"]').click()
      cy.get('[data-cy="mobile-filters"]').should('be.visible')
    })
  })
})