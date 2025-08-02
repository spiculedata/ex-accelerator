// Custom Cypress commands for Ex-Accelerator UI testing

// Command to wait for page to load completely
Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('body').should('be.visible')
  cy.wait(500) // Allow for any async operations to complete
})

// Command to navigate to a specific route and wait for load
Cypress.Commands.add('visitAndWait', (route: string) => {
  cy.visit(route)
  cy.waitForPageLoad()
})

// Command to check for loading states
Cypress.Commands.add('waitForLoading', () => {
  cy.get('[data-cy="loading"]').should('not.exist')
  cy.get('.loading').should('not.exist')
  cy.contains('Loading').should('not.exist')
})

// Command to check analytics dashboard elements
Cypress.Commands.add('checkDashboardStats', () => {
  cy.get('[data-cy="dashboard-stats"]').should('be.visible')
  cy.get('[data-cy="total-posts"]').should('contain.text', /\d+/)
  cy.get('[data-cy="total-sources"]').should('contain.text', /\d+/)
})

// Command to test chart components
Cypress.Commands.add('checkChartExists', (chartSelector: string) => {
  cy.get(chartSelector).should('be.visible')
  cy.get(chartSelector).find('canvas, svg').should('exist')
})

// Command to test form interactions
Cypress.Commands.add('fillFormField', (selector: string, value: string) => {
  cy.get(selector).clear()
  cy.get(selector).type(value)
  cy.get(selector).should('have.value', value)
})

// Command to test dropdown selections
Cypress.Commands.add('selectDropdownOption', (selector: string, value: string) => {
  cy.get(selector).select(value)
  cy.get(selector).should('have.value', value)
})

// Command to test modal interactions
Cypress.Commands.add('openModal', (triggerSelector: string, modalSelector: string) => {
  cy.get(triggerSelector).click()
  cy.get(modalSelector).should('be.visible')
})

// Command to close modal
Cypress.Commands.add('closeModal', (modalSelector: string) => {
  cy.get(modalSelector).find('[data-cy="close-modal"], .modal-close, [aria-label="Close"]').click()
  cy.get(modalSelector).should('not.exist')
})

// Command to test data table interactions
Cypress.Commands.add('checkDataTable', (tableSelector: string) => {
  cy.get(tableSelector).should('be.visible')
  cy.get(tableSelector).find('thead').should('exist')
  cy.get(tableSelector).find('tbody').should('exist')
  cy.get(tableSelector).find('tr').should('have.length.at.least', 1)
})

// Command to test filter functionality
Cypress.Commands.add('testFilter', (filterSelector: string, expectedChange: string) => {
  // Get initial state
  cy.get('body').then(($body) => {
    const initialContent = $body.text()
    
    // Apply filter
    cy.get(filterSelector).click()
    cy.waitForLoading()
    
    // Check that content changed
    cy.get('body').should(($newBody) => {
      expect($newBody.text()).to.not.equal(initialContent)
    })
  })
})

// Command to test export functionality
Cypress.Commands.add('testExport', (exportButtonSelector: string) => {
  cy.get(exportButtonSelector).click()
  // Check for download or export confirmation
  cy.get('.export-success, .download-complete').should('be.visible')
})

// Command to intercept API calls
Cypress.Commands.add('mockApiCall', (endpoint: string, fixture: string) => {
  cy.intercept('GET', `**/api/${endpoint}**`, { fixture: fixture }).as(endpoint)
})

// Command to test responsive design
Cypress.Commands.add('testResponsive', () => {
  // Test mobile view
  cy.viewport(375, 667)
  cy.wait(500)
  
  // Test tablet view
  cy.viewport(768, 1024)
  cy.wait(500)
  
  // Test desktop view
  cy.viewport(1280, 720)
  cy.wait(500)
})

// Extend Cypress interface
declare global {
  namespace Cypress {
    interface Chainable {
      waitForPageLoad(): Chainable<void>
      visitAndWait(route: string): Chainable<void>
      waitForLoading(): Chainable<void>
      checkDashboardStats(): Chainable<void>
      checkChartExists(chartSelector: string): Chainable<void>
      fillFormField(selector: string, value: string): Chainable<void>
      selectDropdownOption(selector: string, value: string): Chainable<void>
      openModal(triggerSelector: string, modalSelector: string): Chainable<void>
      closeModal(modalSelector: string): Chainable<void>
      checkDataTable(tableSelector: string): Chainable<void>
      testFilter(filterSelector: string, expectedChange: string): Chainable<void>
      testExport(exportButtonSelector: string): Chainable<void>
      mockApiCall(endpoint: string, fixture: string): Chainable<void>
      testResponsive(): Chainable<void>
    }
  }
}