import Navigation from '../../src/lib/components/Navigation.svelte'

describe('Navigation Component', () => {
  it('should render navigation menu', () => {
    cy.mount(Navigation)
    
    cy.get('[data-cy="main-nav"]').should('be.visible')
    cy.get('[data-cy="nav-brand"]').should('contain.text', 'Ex-Accelerator')
  })

  it('should display main navigation items', () => {
    cy.mount(Navigation)
    
    cy.get('[data-cy="nav-item"]').should('have.length.at.least', 5)
    cy.get('[data-cy="nav-item"]').contains('Dashboard').should('be.visible')
    cy.get('[data-cy="nav-item"]').contains('Text Analytics').should('be.visible')
    cy.get('[data-cy="nav-item"]').contains('Data Capture').should('be.visible')
    cy.get('[data-cy="nav-item"]').contains('Projects').should('be.visible')
  })

  it('should show submenu on hover', () => {
    cy.mount(Navigation)
    
    cy.get('[data-cy="nav-item"]').contains('Text Analytics').trigger('mouseenter')
    cy.get('[data-cy="submenu"]').should('be.visible')
    cy.get('[data-cy="submenu-item"]').should('have.length.at.least', 4)
  })

  it('should hide submenu on mouse leave', () => {
    cy.mount(Navigation)
    
    cy.get('[data-cy="nav-item"]').contains('Text Analytics').trigger('mouseenter')
    cy.get('[data-cy="submenu"]').should('be.visible')
    
    cy.get('[data-cy="nav-item"]').contains('Text Analytics').trigger('mouseleave')
    cy.get('[data-cy="submenu"]').should('not.be.visible')
  })

  describe('Mobile Navigation', () => {
    beforeEach(() => {
      cy.viewport(375, 667)
    })

    it('should show mobile menu toggle on small screens', () => {
      cy.mount(Navigation)
      
      cy.get('[data-cy="mobile-menu-toggle"]').should('be.visible')
      cy.get('[data-cy="desktop-nav"]').should('not.be.visible')
    })

    it('should open mobile menu when toggle is clicked', () => {
      cy.mount(Navigation)
      
      cy.get('[data-cy="mobile-menu-toggle"]').click()
      cy.get('[data-cy="mobile-menu"]').should('be.visible')
      cy.get('[data-cy="mobile-nav-item"]').should('have.length.at.least', 5)
    })

    it('should close mobile menu when toggle is clicked again', () => {
      cy.mount(Navigation)
      
      cy.get('[data-cy="mobile-menu-toggle"]').click()
      cy.get('[data-cy="mobile-menu"]').should('be.visible')
      
      cy.get('[data-cy="mobile-menu-toggle"]').click()
      cy.get('[data-cy="mobile-menu"]').should('not.be.visible')
    })
  })

  describe('Active State Management', () => {
    it('should highlight active navigation item', () => {
      cy.mount(Navigation, {
        props: {
          currentPath: '/dashboards'
        }
      })
      
      cy.get('[data-cy="nav-item"]').contains('Dashboard').should('have.class', 'active')
    })

    it('should highlight active submenu item', () => {
      cy.mount(Navigation, {
        props: {
          currentPath: '/text-analytics/sentiment-analysis'
        }
      })
      
      cy.get('[data-cy="nav-item"]').contains('Text Analytics').should('have.class', 'active')
      cy.get('[data-cy="nav-item"]').contains('Text Analytics').trigger('mouseenter')
      cy.get('[data-cy="submenu-item"]').contains('Sentiment Analysis').should('have.class', 'active')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      cy.mount(Navigation)
      
      cy.get('[data-cy="main-nav"]').should('have.attr', 'role', 'navigation')
      cy.get('[data-cy="mobile-menu-toggle"]').should('have.attr', 'aria-label')
      cy.get('[data-cy="submenu"]').should('have.attr', 'role', 'menu')
    })

    it('should support keyboard navigation', () => {
      cy.mount(Navigation)
      
      cy.get('[data-cy="nav-item"]').first().focus()
      cy.focused().should('be.visible')
      
      cy.focused().type('{rightarrow}')
      cy.focused().should('not.be', cy.get('[data-cy="nav-item"]').first())
    })

    it('should have proper focus management for mobile menu', () => {
      cy.viewport(375, 667)
      cy.mount(Navigation)
      
      cy.get('[data-cy="mobile-menu-toggle"]').click()
      cy.get('[data-cy="mobile-nav-item"]').first().should('be.focused')
    })
  })

  describe('Visual States', () => {
    it('should apply hover styles', () => {
      cy.mount(Navigation)
      
      cy.get('[data-cy="nav-item"]').first().trigger('mouseenter')
      cy.get('[data-cy="nav-item"]').first().should('have.class', 'hover')
    })

    it('should show loading state when navigating', () => {
      cy.mount(Navigation, {
        props: {
          isNavigating: true
        }
      })
      
      cy.get('[data-cy="nav-loading"]').should('be.visible')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing navigation data gracefully', () => {
      cy.mount(Navigation, {
        props: {
          navigationItems: null
        }
      })
      
      cy.get('[data-cy="nav-error"]').should('be.visible')
      cy.get('[data-cy="nav-error"]').should('contain.text', 'Navigation unavailable')
    })

    it('should handle broken links gracefully', () => {
      cy.mount(Navigation, {
        props: {
          navigationItems: [
            { name: 'Broken Link', href: null }
          ]
        }
      })
      
      cy.get('[data-cy="nav-item"]').contains('Broken Link').should('have.attr', 'aria-disabled', 'true')
    })
  })
})