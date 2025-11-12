// Component Tests for Project Creation

import { mount } from 'cypress/svelte';

describe('Project Creation Form', () => {
  it('should render project creation form', () => {
    cy.visit('/projects/new');
    cy.get('h1').should('contain', 'Create New Project');
    cy.get('input[type="text"]').should('be.visible');
    cy.get('textarea').should('be.visible');
    cy.get('select').should('be.visible');
  });

  it('should display all project type options', () => {
    cy.visit('/projects/new');
    cy.get('select').first().find('option').should('have.length', 4);
    cy.get('select').first().should('contain', 'Social Media Analysis');
    cy.get('select').first().should('contain', 'Market Research');
    cy.get('select').first().should('contain', 'Customer Feedback');
    cy.get('select').first().should('contain', 'Content Analysis');
  });

  it('should toggle data sources on click', () => {
    cy.visit('/projects/new');

    // Initially no sources selected
    cy.get('[data-selected="true"]').should('not.exist');

    // Click Twitter
    cy.contains('Twitter/X').click();
    cy.contains('Twitter/X').parent().should('have.class', 'ring-2');

    // Click again to deselect
    cy.contains('Twitter/X').click();
    cy.contains('Twitter/X').parent().should('not.have.class', 'ring-2');
  });

  it('should add and remove team members', () => {
    cy.visit('/projects/new');

    // Add member
    cy.get('input[type="email"]').type('member1@example.com');
    cy.contains('Add Member').click();
    cy.contains('member1@example.com').should('be.visible');

    // Add another
    cy.get('input[type="email"]').type('member2@example.com');
    cy.contains('Add Member').click();
    cy.contains('member2@example.com').should('be.visible');

    // Remove first member
    cy.contains('member1@example.com').parent().find('button').click();
    cy.contains('member1@example.com').should('not.exist');
    cy.contains('member2@example.com').should('still.exist');
  });

  it('should show loading state when creating', () => {
    cy.visit('/projects/new');

    cy.get('input[type="text"]').first().type('Loading Test');
    cy.contains('Twitter/X').click();

    // Intercept API call to delay it
    cy.intercept('POST', '/api/projects', (req) => {
      req.reply((res) => {
        res.delay = 2000;
        res.send({ success: true, project: { id: 999, name: 'Loading Test' } });
      });
    }).as('createProject');

    cy.contains('Create Project').click();

    // Should show loading state
    cy.contains('Creating').should('be.visible');
    cy.contains('Create Project').should('be.disabled');

    // Wait for completion
    cy.wait('@createProject');
  });
});

describe('Workspace Creation Form', () => {
  beforeEach(() => {
    cy.visit('/projects/1');
  });

  it('should show create workspace form when button clicked', () => {
    cy.contains('+ New Workspace').click();
    cy.get('input[placeholder*="Twitter Analysis"]').should('be.visible');
    cy.contains('Create New Workspace').should('be.visible');
  });

  it('should create workspace and update list', () => {
    const workspaceName = `Test Workspace ${Date.now()}`;

    cy.contains('+ New Workspace').click();
    cy.get('input[placeholder*="Twitter Analysis"]').type(workspaceName);
    cy.get('select').select('exploration');
    cy.get('textarea').type('Test description');

    // Intercept API call
    cy.intercept('POST', '/api/workspaces').as('createWorkspace');

    cy.contains('Create Workspace').click();

    // Wait for API call
    cy.wait('@createWorkspace').its('response.statusCode').should('eq', 200);

    // Should appear in grid
    cy.contains(workspaceName).should('be.visible');
    cy.contains('exploration').should('be.visible');
  });

  it('should validate required fields', () => {
    cy.contains('+ New Workspace').click();

    // Submit button should be disabled without name
    cy.contains('Create Workspace').should('be.disabled');

    // Type name
    cy.get('input[placeholder*="Twitter Analysis"]').type('Valid Name');

    // Should be enabled now
    cy.contains('Create Workspace').should('not.be.disabled');
  });

  it('should cancel workspace creation', () => {
    cy.contains('+ New Workspace').click();
    cy.get('input[placeholder*="Twitter Analysis"]').type('Canceled Workspace');

    // Click cancel
    cy.contains('Cancel').click();

    // Form should disappear
    cy.get('input[placeholder*="Twitter Analysis"]').should('not.exist');
    cy.contains('Canceled Workspace').should('not.exist');
  });
});
