describe('Homepage', () => {
  beforeEach(() => {
    cy.visitAndWait('/')
  })

  describe('Page Structure', () => {
    it('should display the main header and branding', () => {
      cy.get('h1').should('contain.text', 'Ex-Accelerator')
      cy.get('[data-cy="main-header"]').should('be.visible')
    })

    it('should display the navigation menu', () => {
      cy.get('nav').should('be.visible')
      cy.get('[data-cy="nav-menu"]').should('be.visible')
    })

    it('should display the application modules grid', () => {
      cy.get('[data-cy="app-modules"]').should('be.visible')
      cy.get('[data-cy="app-module"]').should('have.length.at.least', 6)
    })
  })

  describe('Navigation Functionality', () => {
    it('should navigate to dashboards when clicking dashboard module', () => {
      cy.get('[data-cy="app-module"]').contains('Dashboard').click()
      cy.url().should('include', '/dashboards')
    })

    it('should navigate to text analytics when clicking text analytics module', () => {
      cy.get('[data-cy="app-module"]').contains('Text Analytics').click()
      cy.url().should('include', '/text-analytics')
    })

    it('should navigate to data capture when clicking data capture module', () => {
      cy.get('[data-cy="app-module"]').contains('Data Capture').click()
      cy.url().should('include', '/data-capture')
    })

    it('should navigate to projects when clicking projects module', () => {
      cy.get('[data-cy="app-module"]').contains('Projects').click()
      cy.url().should('include', '/projects')
    })
  })

  describe('Responsive Design', () => {
    it('should display correctly on mobile devices', () => {
      cy.viewport(375, 667)
      cy.get('[data-cy="app-modules"]').should('be.visible')
      cy.get('[data-cy="app-module"]').should('be.visible')
    })

    it('should display correctly on tablet devices', () => {
      cy.viewport(768, 1024)
      cy.get('[data-cy="app-modules"]').should('be.visible')
      cy.get('[data-cy="app-module"]').should('have.length.at.least', 6)
    })

    it('should display correctly on desktop', () => {
      cy.viewport(1280, 720)
      cy.get('[data-cy="app-modules"]').should('be.visible')
      cy.get('[data-cy="app-module"]').should('have.length.at.least', 6)
    })
  })

  describe('Error Handling', () => {
    it('should handle navigation errors gracefully', () => {
      // Try to navigate to a non-existent module
      cy.visit('/non-existent-page', { failOnStatusCode: false })
      // Should display error page or redirect to home
      cy.url().should('match', /\/(404|error|$)/)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      cy.get('[role="main"]').should('exist')
      cy.get('nav').should('have.attr', 'role', 'navigation')
    })

    it('should support keyboard navigation', () => {
      cy.get('body').tab()
      cy.focused().should('be.visible')
    })
  })
})