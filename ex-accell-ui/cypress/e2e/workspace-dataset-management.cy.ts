/// <reference types="cypress" />

/**
 * Cypress E2E Tests - Workspace Dataset Management
 *
 * Tests for managing datasets on existing workspaces:
 * 1. Viewing linked datasets
 * 2. Adding datasets to workspace
 * 3. Removing datasets from workspace
 * 4. Dataset attachment UI interactions
 */

describe('Workspace Dataset Management', () => {
  let testProject: any;
  let testWorkspace: any;
  let testDatasets: any[] = [];

  before(() => {
    // Setup: Create test project
    cy.request('POST', '/api/projects', {
      name: 'Workspace Dataset Management Test',
      description: 'Project for testing workspace dataset management',
      project_type: 'research',
      created_by: 'test@example.com'
    }).then((response) => {
      testProject = response.body.project;
    });

    // Setup: Create test workspace
    cy.request('POST', '/api/workspaces', {
      project_id: testProject.id,
      name: 'Test Workspace for Dataset Management',
      description: 'Testing dataset attachment',
      workspace_type: 'analysis',
      created_by: 'test@example.com'
    }).then((response) => {
      testWorkspace = response.body.workspace;
    });

    // Setup: Create test datasets
    const datasets = [
      {
        name: 'Management Test Dataset 1',
        description: 'First test dataset',
        dataset_type: 'social_media',
        source_platform: 'twitter',
        source_database: 'etl_postgres',
        schema_name: 'silver',
        table_name: 'posts',
        record_count: 2000,
        status: 'available',
        visibility: 'private',
        created_by: 'test_system'
      },
      {
        name: 'Management Test Dataset 2',
        description: 'Second test dataset',
        dataset_type: 'social_media',
        source_platform: 'telegram',
        source_database: 'etl_postgres',
        schema_name: 'silver',
        table_name: 'posts',
        record_count: 1500,
        status: 'available',
        visibility: 'public',
        created_by: 'test_system'
      },
      {
        name: 'Management Test Dataset 3',
        description: 'Third test dataset',
        dataset_type: 'analytics',
        source_platform: 'facebook',
        source_database: 'etl_postgres',
        schema_name: 'gold',
        table_name: 'engagement_metrics',
        record_count: 500,
        status: 'available',
        visibility: 'public',
        created_by: 'test_system'
      }
    ];

    datasets.forEach((dataset) => {
      cy.task('queryDatabase', {
        query: `
          INSERT INTO datasets (
            name, description, dataset_type, source_platform,
            source_database, schema_name, table_name, record_count,
            status, visibility, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (name) DO UPDATE SET
            record_count = EXCLUDED.record_count
          RETURNING id, name, dataset_type, source_platform
        `,
        params: [
          dataset.name,
          dataset.description,
          dataset.dataset_type,
          dataset.source_platform,
          dataset.source_database,
          dataset.schema_name,
          dataset.table_name,
          dataset.record_count,
          dataset.status,
          dataset.visibility,
          dataset.created_by
        ]
      }).then((result: any) => {
        testDatasets.push(result.rows[0]);
      });
    });
  });

  after(() => {
    // Cleanup
    if (testWorkspace) {
      cy.request('DELETE', `/api/workspaces?id=${testWorkspace.id}`);
    }
    if (testProject) {
      cy.request('DELETE', `/api/projects?id=${testProject.id}`);
    }
    testDatasets.forEach((dataset) => {
      cy.task('queryDatabase', {
        query: 'DELETE FROM datasets WHERE id = $1',
        params: [dataset.id]
      });
    });
  });

  describe('Workspace Detail Page', () => {
    beforeEach(() => {
      // Navigate to workspace detail page
      cy.visit(`/workspaces/${testWorkspace.id}`);
    });

    it('should display workspace details', () => {
      cy.contains('h1', testWorkspace.name).should('be.visible');
      cy.contains(testWorkspace.description).should('be.visible');
      cy.contains('analysis').should('be.visible');
      cy.contains('active').should('be.visible');
    });

    it('should show breadcrumb navigation', () => {
      cy.contains('nav', 'Projects').should('be.visible');
      cy.contains('nav', testProject.name).should('be.visible');
      cy.contains('nav', testWorkspace.name).should('be.visible');
    });

    it('should display datasets section', () => {
      cy.contains('h2', 'Datasets').should('be.visible');
      cy.contains('button', 'Add Datasets').should('be.visible');
    });

    it('should show empty state when no datasets are linked', () => {
      cy.contains('No datasets linked').should('be.visible');
      cy.contains('Add datasets to start analyzing').should('be.visible');
    });
  });

  describe('Adding Datasets to Workspace', () => {
    beforeEach(() => {
      cy.visit(`/workspaces/${testWorkspace.id}`);
    });

    afterEach(() => {
      // Cleanup: Unlink all datasets after each test
      testDatasets.forEach((dataset) => {
        cy.request({
          method: 'DELETE',
          url: `/api/datasets?action=unlink&workspace_id=${testWorkspace.id}&dataset_id=${dataset.id}`,
          failOnStatusCode: false
        });
      });
    });

    it('should open add datasets form', () => {
      cy.contains('button', 'Add Datasets').click();
      cy.contains('h3', 'Add Datasets to Workspace').should('be.visible');
    });

    it('should load available datasets', () => {
      cy.contains('button', 'Add Datasets').click();

      // Wait for loading to complete
      cy.contains('Loading available datasets...', { timeout: 10000 }).should('not.exist');

      // Should show our test datasets
      cy.contains('Management Test Dataset 1').should('be.visible');
      cy.contains('Management Test Dataset 2').should('be.visible');
      cy.contains('Management Test Dataset 3').should('be.visible');
    });

    it('should display dataset metadata in add form', () => {
      cy.contains('button', 'Add Datasets').click();
      cy.contains('Loading available datasets...', { timeout: 10000 }).should('not.exist');

      // Check first dataset metadata
      cy.contains('Management Test Dataset 1').parent().parent().within(() => {
        cy.contains('social_media').should('be.visible');
        cy.contains('twitter').should('be.visible');
        cy.contains('2,000 records').should('be.visible');
        cy.contains('First test dataset').should('be.visible');
        cy.contains('silver.posts').should('be.visible');
      });
    });

    it('should select and add single dataset', () => {
      cy.contains('button', 'Add Datasets').click();
      cy.contains('Loading available datasets...', { timeout: 10000 }).should('not.exist');

      // Select first dataset
      cy.contains('Management Test Dataset 1')
        .parent()
        .parent()
        .find('input[type="checkbox"]')
        .check();

      cy.contains('1 dataset selected').should('be.visible');

      // Add dataset
      cy.contains('button', 'Add 1 Dataset').click();

      // Verify dataset appears in linked list
      cy.contains('Management Test Dataset 1', { timeout: 10000 }).should('be.visible');
      cy.contains('No datasets linked').should('not.exist');
    });

    it('should select and add multiple datasets', () => {
      cy.contains('button', 'Add Datasets').click();
      cy.contains('Loading available datasets...', { timeout: 10000 }).should('not.exist');

      // Select multiple datasets
      cy.contains('Management Test Dataset 1')
        .parent()
        .parent()
        .find('input[type="checkbox"]')
        .check();
      cy.contains('Management Test Dataset 2')
        .parent()
        .parent()
        .find('input[type="checkbox"]')
        .check();

      cy.contains('2 datasets selected').should('be.visible');

      // Add datasets
      cy.contains('button', 'Add 2 Datasets').click();

      // Verify both datasets appear
      cy.contains('Management Test Dataset 1', { timeout: 10000 }).should('be.visible');
      cy.contains('Management Test Dataset 2').should('be.visible');
    });

    it('should toggle dataset selection', () => {
      cy.contains('button', 'Add Datasets').click();
      cy.contains('Loading available datasets...', { timeout: 10000 }).should('not.exist');

      const checkbox = cy.contains('Management Test Dataset 1')
        .parent()
        .parent()
        .find('input[type="checkbox"]');

      // Select
      checkbox.check();
      cy.contains('1 dataset selected').should('be.visible');

      // Unselect
      checkbox.uncheck();
      cy.contains('dataset selected').should('not.exist');

      // Select again
      checkbox.check();
      cy.contains('1 dataset selected').should('be.visible');
    });

    it('should cancel adding datasets', () => {
      cy.contains('button', 'Add Datasets').click();
      cy.contains('Loading available datasets...', { timeout: 10000 }).should('not.exist');

      // Select a dataset
      cy.contains('Management Test Dataset 1')
        .parent()
        .parent()
        .find('input[type="checkbox"]')
        .check();

      // Cancel
      cy.contains('button', 'Cancel').click();

      // Form should close
      cy.contains('h3', 'Add Datasets to Workspace').should('not.exist');

      // Dataset should not be linked
      cy.contains('No datasets linked').should('be.visible');
    });

    it('should disable add button when no datasets selected', () => {
      cy.contains('button', 'Add Datasets').click();
      cy.contains('Loading available datasets...', { timeout: 10000 }).should('not.exist');

      // Add button should be disabled
      cy.contains('button', 'Add  Datasets').should('be.disabled');
    });
  });

  describe('Removing Datasets from Workspace', () => {
    beforeEach(() => {
      // Link a dataset before each test
      cy.request('POST', '/api/datasets', {
        action: 'link',
        workspace_id: testWorkspace.id,
        dataset_id: testDatasets[0].id,
        added_by: 'test@example.com'
      });

      cy.visit(`/workspaces/${testWorkspace.id}`);
    });

    afterEach(() => {
      // Cleanup
      testDatasets.forEach((dataset) => {
        cy.request({
          method: 'DELETE',
          url: `/api/datasets?action=unlink&workspace_id=${testWorkspace.id}&dataset_id=${dataset.id}`,
          failOnStatusCode: false
        });
      });
    });

    it('should display linked dataset', () => {
      cy.contains('Management Test Dataset 1').should('be.visible');
      cy.contains('No datasets linked').should('not.exist');
    });

    it('should show dataset details in card', () => {
      cy.contains('Management Test Dataset 1').parent().parent().within(() => {
        cy.contains('social_media').should('be.visible');
        cy.contains('twitter').should('be.visible');
        cy.contains('active').should('be.visible');
        cy.contains('2,000').should('be.visible');
        cy.contains('First test dataset').should('be.visible');
      });
    });

    it('should show remove button for each dataset', () => {
      cy.contains('Management Test Dataset 1')
        .parent()
        .parent()
        .find('button[title="Remove dataset"]')
        .should('be.visible');
    });

    it('should remove dataset with confirmation', () => {
      // Stub window.confirm to return true
      cy.window().then((win) => {
        cy.stub(win, 'confirm').returns(true);
      });

      // Click remove button
      cy.contains('Management Test Dataset 1')
        .parent()
        .parent()
        .find('button[title="Remove dataset"]')
        .click();

      // Dataset should be removed
      cy.contains('Management Test Dataset 1', { timeout: 10000 }).should('not.exist');
      cy.contains('No datasets linked').should('be.visible');
    });

    it('should cancel dataset removal if confirmation declined', () => {
      // Stub window.confirm to return false
      cy.window().then((win) => {
        cy.stub(win, 'confirm').returns(false);
      });

      // Click remove button
      cy.contains('Management Test Dataset 1')
        .parent()
        .parent()
        .find('button[title="Remove dataset"]')
        .click();

      // Dataset should still be visible
      cy.contains('Management Test Dataset 1').should('be.visible');
    });

    it('should show correct dataset count', () => {
      cy.contains('Manage datasets linked to this workspace (1)').should('be.visible');
    });
  });

  describe('Dataset Filtering in Add Form', () => {
    beforeEach(() => {
      // Link dataset 1
      cy.request('POST', '/api/datasets', {
        action: 'link',
        workspace_id: testWorkspace.id,
        dataset_id: testDatasets[0].id,
        added_by: 'test@example.com'
      });

      cy.visit(`/workspaces/${testWorkspace.id}`);
    });

    afterEach(() => {
      // Cleanup
      testDatasets.forEach((dataset) => {
        cy.request({
          method: 'DELETE',
          url: `/api/datasets?action=unlink&workspace_id=${testWorkspace.id}&dataset_id=${dataset.id}`,
          failOnStatusCode: false
        });
      });
    });

    it('should filter out already linked datasets', () => {
      cy.contains('button', 'Add Datasets').click();
      cy.contains('Loading available datasets...', { timeout: 10000 }).should('not.exist');

      // Dataset 1 should not appear (already linked)
      cy.contains('Management Test Dataset 1').should('not.exist');

      // Datasets 2 and 3 should appear
      cy.contains('Management Test Dataset 2').should('be.visible');
      cy.contains('Management Test Dataset 3').should('be.visible');
    });

    it('should show empty state when all datasets are linked', () => {
      // Link remaining datasets
      cy.request('POST', '/api/datasets', {
        action: 'link',
        workspace_id: testWorkspace.id,
        dataset_id: testDatasets[1].id,
        added_by: 'test@example.com'
      });
      cy.request('POST', '/api/datasets', {
        action: 'link',
        workspace_id: testWorkspace.id,
        dataset_id: testDatasets[2].id,
        added_by: 'test@example.com'
      });

      cy.reload();

      cy.contains('button', 'Add Datasets').click();
      cy.contains('Loading available datasets...', { timeout: 10000 }).should('not.exist');

      // Should show empty state
      cy.contains('No additional datasets available').should('be.visible');
      cy.contains('All available datasets are already linked').should('be.visible');
    });
  });

  describe('Multiple Dataset Operations', () => {
    beforeEach(() => {
      cy.visit(`/workspaces/${testWorkspace.id}`);
    });

    afterEach(() => {
      // Cleanup
      testDatasets.forEach((dataset) => {
        cy.request({
          method: 'DELETE',
          url: `/api/datasets?action=unlink&workspace_id=${testWorkspace.id}&dataset_id=${dataset.id}`,
          failOnStatusCode: false
        });
      });
    });

    it('should handle adding and removing datasets in sequence', () => {
      // Add dataset
      cy.contains('button', 'Add Datasets').click();
      cy.contains('Loading available datasets...', { timeout: 10000 }).should('not.exist');
      cy.contains('Management Test Dataset 1')
        .parent()
        .parent()
        .find('input[type="checkbox"]')
        .check();
      cy.contains('button', 'Add 1 Dataset').click();
      cy.contains('Management Test Dataset 1', { timeout: 10000 }).should('be.visible');

      // Remove dataset
      cy.window().then((win) => {
        cy.stub(win, 'confirm').returns(true);
      });
      cy.contains('Management Test Dataset 1')
        .parent()
        .parent()
        .find('button[title="Remove dataset"]')
        .click();
      cy.contains('No datasets linked', { timeout: 10000 }).should('be.visible');

      // Add again
      cy.contains('button', 'Add Datasets').click();
      cy.contains('Loading available datasets...', { timeout: 10000 }).should('not.exist');
      cy.contains('Management Test Dataset 1')
        .parent()
        .parent()
        .find('input[type="checkbox"]')
        .check();
      cy.contains('button', 'Add 1 Dataset').click();
      cy.contains('Management Test Dataset 1', { timeout: 10000 }).should('be.visible');
    });
  });
});
