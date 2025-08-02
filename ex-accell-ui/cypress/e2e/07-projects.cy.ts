describe('Projects Page', () => {
  beforeEach(() => {
    cy.visitAndWait('/projects')
  })

  describe('Page Layout', () => {
    it('should display the page title and description', () => {
      cy.get('h1').should('contain.text', 'Projects')
      cy.get('[data-cy="page-description"]').should('be.visible')
    })

    it('should display create new project button', () => {
      cy.get('[data-cy="create-project-button"]').should('be.visible')
      cy.get('[data-cy="create-project-button"]').should('contain.text', 'New Project')
    })

    it('should display projects grid', () => {
      cy.get('[data-cy="projects-grid"]').should('be.visible')
      cy.get('[data-cy="project-card"]').should('exist')
    })

    it('should display project filters and search', () => {
      cy.get('[data-cy="project-search"]').should('be.visible')
      cy.get('[data-cy="project-filters"]').should('be.visible')
    })
  })

  describe('Project Cards', () => {
    it('should display project information in cards', () => {
      cy.get('[data-cy="project-card"]').first().within(() => {
        cy.get('[data-cy="project-name"]').should('be.visible')
        cy.get('[data-cy="project-description"]').should('be.visible')
        cy.get('[data-cy="project-status"]').should('be.visible')
        cy.get('[data-cy="project-date"]').should('be.visible')
      })
    })

    it('should show project tags and categories', () => {
      cy.get('[data-cy="project-card"]').first().within(() => {
        cy.get('[data-cy="project-tags"]').should('be.visible')
        cy.get('[data-cy="project-tag"]').should('have.length.at.least', 1)
      })
    })

    it('should display project progress indicators', () => {
      cy.get('[data-cy="project-card"]').first().within(() => {
        cy.get('[data-cy="progress-indicator"]').should('be.visible')
        cy.get('[data-cy="completion-percentage"]').should('be.visible')
      })
    })

    it('should allow clicking on project cards', () => {
      cy.get('[data-cy="project-card"]').first().click()
      cy.url().should('include', '/projects/')
      cy.get('[data-cy="project-detail"]').should('be.visible')
    })
  })

  describe('Project Creation', () => {
    it('should open new project modal', () => {
      cy.openModal('[data-cy="create-project-button"]', '[data-cy="new-project-modal"]')
      
      cy.get('[data-cy="new-project-modal"]').within(() => {
        cy.get('[data-cy="project-name-input"]').should('be.visible')
        cy.get('[data-cy="project-description-input"]').should('be.visible')
        cy.get('[data-cy="project-type-select"]').should('be.visible')
      })
    })

    it('should create a new project with valid data', () => {
      cy.openModal('[data-cy="create-project-button"]', '[data-cy="new-project-modal"]')
      
      cy.get('[data-cy="new-project-modal"]').within(() => {
        cy.fillFormField('[data-cy="project-name-input"]', 'Test Analytics Project')
        cy.fillFormField('[data-cy="project-description-input"]', 'A test project for sentiment analysis')
        cy.selectDropdownOption('[data-cy="project-type-select"]', 'sentiment-analysis')
        
        cy.get('[data-cy="create-project-submit"]').click()
      })
      
      cy.get('[data-cy="success-message"]').should('be.visible')
      cy.get('[data-cy="success-message"]').should('contain.text', 'Project created successfully')
      
      // Should navigate to new project
      cy.url().should('include', '/projects/')
    })

    it('should validate required fields', () => {
      cy.openModal('[data-cy="create-project-button"]', '[data-cy="new-project-modal"]')
      
      cy.get('[data-cy="new-project-modal"]').within(() => {
        cy.get('[data-cy="create-project-submit"]').click()
        
        cy.get('[data-cy="validation-error"]').should('be.visible')
        cy.get('[data-cy="project-name-input"]').should('have.class', 'error')
      })
    })

    it('should show project template options', () => {
      cy.openModal('[data-cy="create-project-button"]', '[data-cy="new-project-modal"]')
      
      cy.get('[data-cy="project-templates"]').should('be.visible')
      cy.get('[data-cy="template-option"]').should('have.length.at.least', 3)
      
      cy.get('[data-cy="template-option"]').first().click()
      cy.get('[data-cy="project-name-input"]').should('not.have.value', '')
    })
  })

  describe('Project Filtering and Search', () => {
    it('should filter projects by search term', () => {
      cy.fillFormField('[data-cy="project-search"]', 'Analytics')
      cy.waitForLoading()
      
      cy.get('[data-cy="project-card"]').each(($card) => {
        cy.wrap($card).should('contain.text', 'Analytics')
      })
    })

    it('should filter projects by status', () => {
      cy.get('[data-cy="status-filter"]').should('be.visible')
      cy.get('[data-cy="filter-active"]').click()
      cy.waitForLoading()
      
      cy.get('[data-cy="project-card"]').each(($card) => {
        cy.wrap($card).find('[data-cy="project-status"]').should('contain.text', 'Active')
      })
    })

    it('should filter projects by type', () => {
      cy.get('[data-cy="type-filter"]').should('be.visible')
      cy.selectDropdownOption('[data-cy="type-filter"]', 'sentiment-analysis')
      cy.waitForLoading()
      
      cy.get('[data-cy="project-card"]').should('have.length.at.least', 1)
    })

    it('should sort projects by different criteria', () => {
      cy.get('[data-cy="sort-dropdown"]').should('be.visible')
      cy.selectDropdownOption('[data-cy="sort-dropdown"]', 'created-desc')
      cy.waitForLoading()
      
      // Verify sorting is applied
      cy.get('[data-cy="project-card"]').first().should('be.visible')
    })

    it('should clear all filters', () => {
      // Apply filters
      cy.fillFormField('[data-cy="project-search"]', 'test')
      cy.get('[data-cy="filter-active"]').click()
      
      // Clear filters
      cy.get('[data-cy="clear-filters"]').click()
      cy.waitForLoading()
      
      cy.get('[data-cy="project-search"]').should('have.value', '')
      cy.get('[data-cy="project-card"]').should('have.length.at.least', 1)
    })
  })

  describe('Project Management', () => {
    it('should allow editing project details', () => {
      cy.get('[data-cy="project-card"]').first().within(() => {
        cy.get('[data-cy="project-menu"]').click()
        cy.get('[data-cy="edit-project"]').click()
      })
      
      cy.get('[data-cy="edit-project-modal"]').should('be.visible')
      cy.get('[data-cy="edit-project-modal"]').within(() => {
        cy.fillFormField('[data-cy="project-name-input"]', 'Updated Project Name')
        cy.get('[data-cy="save-changes"]').click()
      })
      
      cy.get('[data-cy="success-message"]').should('contain.text', 'Project updated')
    })

    it('should allow duplicating projects', () => {
      cy.get('[data-cy="project-card"]').first().within(() => {
        cy.get('[data-cy="project-menu"]').click()
        cy.get('[data-cy="duplicate-project"]').click()
      })
      
      cy.get('[data-cy="duplicate-modal"]').should('be.visible')
      cy.get('[data-cy="duplicate-modal"]').within(() => {
        cy.fillFormField('[data-cy="new-project-name"]', 'Duplicated Project')
        cy.get('[data-cy="confirm-duplicate"]').click()
      })
      
      cy.get('[data-cy="success-message"]').should('contain.text', 'Project duplicated')
    })

    it('should allow archiving projects', () => {
      cy.get('[data-cy="project-card"]').first().within(() => {
        cy.get('[data-cy="project-menu"]').click()
        cy.get('[data-cy="archive-project"]').click()
      })
      
      cy.get('[data-cy="confirm-archive-modal"]').should('be.visible')
      cy.get('[data-cy="confirm-archive"]').click()
      
      cy.get('[data-cy="success-message"]').should('contain.text', 'Project archived')
    })

    it('should allow deleting projects', () => {
      cy.get('[data-cy="project-card"]').first().within(() => {
        cy.get('[data-cy="project-menu"]').click()
        cy.get('[data-cy="delete-project"]').click()
      })
      
      cy.get('[data-cy="confirm-delete-modal"]').should('be.visible')
      cy.get('[data-cy="confirm-delete-modal"]').within(() => {
        cy.fillFormField('[data-cy="confirm-delete-input"]', 'DELETE')
        cy.get('[data-cy="confirm-delete"]').click()
      })
      
      cy.get('[data-cy="success-message"]').should('contain.text', 'Project deleted')
    })
  })

  describe('Project Detail View', () => {
    beforeEach(() => {
      cy.get('[data-cy="project-card"]').first().click()
    })

    it('should display project overview', () => {
      cy.get('[data-cy="project-overview"]').should('be.visible')
      cy.get('[data-cy="project-title"]').should('be.visible')
      cy.get('[data-cy="project-status-badge"]').should('be.visible')
      cy.get('[data-cy="project-metadata"]').should('be.visible')
    })

    it('should display project analytics', () => {
      cy.get('[data-cy="project-analytics"]').should('be.visible')
      cy.checkChartExists('[data-cy="project-progress-chart"]')
      cy.get('[data-cy="key-metrics"]').should('be.visible')
    })

    it('should display project activities', () => {
      cy.get('[data-cy="project-activities"]').should('be.visible')
      cy.get('[data-cy="activity-timeline"]').should('be.visible')
      cy.get('[data-cy="activity-item"]').should('have.length.at.least', 1)
    })

    it('should allow running project analysis', () => {
      cy.get('[data-cy="run-analysis"]').should('be.visible')
      cy.get('[data-cy="run-analysis"]').click()
      
      cy.get('[data-cy="analysis-modal"]').should('be.visible')
      cy.get('[data-cy="analysis-modal"]').within(() => {
        cy.get('[data-cy="analysis-options"]').should('be.visible')
        cy.get('[data-cy="start-analysis"]').click()
      })
      
      cy.get('[data-cy="analysis-started"]').should('be.visible')
    })
  })

  describe('Error Handling', () => {
    it('should handle project creation errors', () => {
      cy.intercept('POST', '**/api/projects', { statusCode: 500 }).as('createError')
      
      cy.openModal('[data-cy="create-project-button"]', '[data-cy="new-project-modal"]')
      cy.get('[data-cy="new-project-modal"]').within(() => {
        cy.fillFormField('[data-cy="project-name-input"]', 'Test Project')
        cy.get('[data-cy="create-project-submit"]').click()
      })
      
      cy.wait('@createError')
      cy.get('[data-cy="error-message"]').should('be.visible')
    })

    it('should handle empty project list', () => {
      cy.intercept('GET', '**/api/projects', { success: true, data: [] }).as('emptyProjects')
      cy.reload()
      
      cy.wait('@emptyProjects')
      cy.get('[data-cy="empty-state"]').should('be.visible')
      cy.get('[data-cy="empty-state"]').should('contain.text', 'No projects found')
    })

    it('should handle project loading errors', () => {
      cy.intercept('GET', '**/api/projects', { statusCode: 500 }).as('loadError')
      cy.reload()
      
      cy.wait('@loadError')
      cy.get('[data-cy="error-message"]').should('be.visible')
      cy.get('[data-cy="retry-button"]').should('be.visible')
    })
  })

  describe('Responsive Design', () => {
    it('should adapt project grid to mobile', () => {
      cy.viewport(375, 667)
      cy.get('[data-cy="projects-grid"]').should('be.visible')
      cy.get('[data-cy="project-card"]').should('be.visible')
    })

    it('should make project cards responsive', () => {
      cy.viewport(768, 1024)
      cy.get('[data-cy="project-card"]').should('be.visible')
      cy.get('[data-cy="project-card"]').first().should('have.css', 'width')
    })

    it('should adapt filters to mobile', () => {
      cy.viewport(375, 667)
      cy.get('[data-cy="mobile-filter-toggle"]').should('be.visible')
      cy.get('[data-cy="mobile-filter-toggle"]').click()
      cy.get('[data-cy="mobile-filters"]').should('be.visible')
    })
  })

  describe('Performance', () => {
    it('should implement virtual scrolling for large project lists', () => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Project ${i}`,
        status: 'active'
      }))
      
      cy.intercept('GET', '**/api/projects', { success: true, data: largeDataset }).as('largeDataset')
      cy.reload()
      
      cy.wait('@largeDataset')
      cy.get('[data-cy="virtual-scroll"]').should('be.visible')
      cy.get('[data-cy="project-card"]').should('have.length.lessThan', 50) // Only render visible items
    })
  })
})