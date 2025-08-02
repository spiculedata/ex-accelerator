describe('Navigation Component', () => {
  beforeEach(() => {
    cy.visitAndWait('/')
  })

  describe('Main Navigation', () => {
    it('should display all main navigation items', () => {
      cy.get('[data-cy="nav-menu"]').within(() => {
        cy.contains('Dashboard').should('be.visible')
        cy.contains('Text Analytics').should('be.visible')
        cy.contains('Data Capture').should('be.visible')
        cy.contains('Data Management').should('be.visible')
        cy.contains('Projects').should('be.visible')
      })
    })

    it('should navigate to dashboard page', () => {
      cy.get('[data-cy="nav-menu"]').contains('Dashboard').click()
      cy.url().should('include', '/dashboards')
      cy.waitForPageLoad()
    })

    it('should navigate to text analytics page', () => {
      cy.get('[data-cy="nav-menu"]').contains('Text Analytics').click()
      cy.url().should('include', '/text-analytics')
      cy.waitForPageLoad()
    })

    it('should navigate to data capture page', () => {
      cy.get('[data-cy="nav-menu"]').contains('Data Capture').click()
      cy.url().should('include', '/data-capture')
      cy.waitForPageLoad()
    })

    it('should navigate to projects page', () => {
      cy.get('[data-cy="nav-menu"]').contains('Projects').click()
      cy.url().should('include', '/projects')
      cy.waitForPageLoad()
    })
  })

  describe('Submenu Navigation', () => {
    it('should show text analytics submenu on hover/click', () => {
      cy.get('[data-cy="nav-menu"]').contains('Text Analytics').trigger('mouseenter')
      cy.get('[data-cy="submenu-text-analytics"]').should('be.visible')
      
      cy.get('[data-cy="submenu-text-analytics"]').within(() => {
        cy.contains('Sentiment Analysis').should('be.visible')
        cy.contains('Topic Modeling').should('be.visible')
        cy.contains('Language Detection').should('be.visible')
        cy.contains('Engagement Analysis').should('be.visible')
      })
    })

    it('should navigate to sentiment analysis page', () => {
      cy.get('[data-cy="nav-menu"]').contains('Text Analytics').trigger('mouseenter')
      cy.get('[data-cy="submenu-text-analytics"]').contains('Sentiment Analysis').click()
      cy.url().should('include', '/text-analytics/sentiment-analysis')
      cy.waitForPageLoad()
    })

    it('should navigate to topic modeling page', () => {
      cy.get('[data-cy="nav-menu"]').contains('Text Analytics').trigger('mouseenter')
      cy.get('[data-cy="submenu-text-analytics"]').contains('Topic Modeling').click()
      cy.url().should('include', '/text-analytics/topic-modeling')
      cy.waitForPageLoad()
    })

    it('should navigate to language detection page', () => {
      cy.get('[data-cy="nav-menu"]').contains('Text Analytics').trigger('mouseenter')
      cy.get('[data-cy="submenu-text-analytics"]').contains('Language Detection').click()
      cy.url().should('include', '/text-analytics/language-detection')
      cy.waitForPageLoad()
    })
  })

  describe('Mobile Navigation', () => {
    beforeEach(() => {
      cy.viewport(375, 667)
    })

    it('should show mobile menu toggle', () => {
      cy.get('[data-cy="mobile-menu-toggle"]').should('be.visible')
    })

    it('should open mobile menu when toggle is clicked', () => {
      cy.get('[data-cy="mobile-menu-toggle"]').click()
      cy.get('[data-cy="mobile-menu"]').should('be.visible')
    })

    it('should navigate in mobile menu', () => {
      cy.get('[data-cy="mobile-menu-toggle"]').click()
      cy.get('[data-cy="mobile-menu"]').contains('Dashboard').click()
      cy.url().should('include', '/dashboards')
    })
  })

  describe('Active State Management', () => {
    it('should highlight current page in navigation', () => {
      cy.visitAndWait('/dashboards')
      cy.get('[data-cy="nav-menu"]').contains('Dashboard').should('have.class', 'active')
    })

    it('should update active state when navigating', () => {
      cy.get('[data-cy="nav-menu"]').contains('Text Analytics').click()
      cy.get('[data-cy="nav-menu"]').contains('Text Analytics').should('have.class', 'active')
    })
  })

  describe('Error Handling', () => {
    it('should handle broken navigation links gracefully', () => {
      // Mock a navigation error
      cy.window().then((win) => {
        win.history.pushState({}, '', '/broken-link')
      })
      
      cy.get('[data-cy="nav-menu"]').contains('Dashboard').click()
      cy.url().should('include', '/dashboards')
    })
  })
})