/// <reference types="cypress" />

/**
 * Cypress E2E Tests - Dataset & Workspace Integration
 *
 * Tests the complete workflow of:
 * 1. Creating datasets via API
 * 2. Selecting datasets during workspace creation
 * 3. Linking/unlinking datasets to/from workspaces
 * 4. Managing dataset permissions
 */

describe('Dataset & Workspace Integration', () => {
  let testProject: any;
  let testDatasets: any[] = [];

  before(() => {
    // Setup: Create test project
    cy.request('POST', '/api/projects', {
      name: 'Dataset Integration Test Project',
      description: 'Project for testing dataset integration',
      project_type: 'research',
      created_by: 'test@example.com'
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
      testProject = response.body.project;
    });

    // Setup: Create test datasets directly in database
    const datasets = [
      {
        name: 'Test Twitter Dataset',
        description: 'Twitter posts for testing',
        dataset_type: 'social_media',
        source_platform: 'twitter',
        source_database: 'etl_postgres',
        schema_name: 'silver',
        table_name: 'posts',
        record_count: 1000,
        status: 'available',
        visibility: 'private',
        created_by: 'test_system'
      },
      {
        name: 'Test Telegram Dataset',
        description: 'Telegram messages for testing',
        dataset_type: 'social_media',
        source_platform: 'telegram',
        source_database: 'etl_postgres',
        schema_name: 'silver',
        table_name: 'posts',
        record_count: 500,
        status: 'available',
        visibility: 'public',
        created_by: 'test_system'
      },
      {
        name: 'Test GDELT Dataset',
        description: 'GDELT events for testing',
        dataset_type: 'gdelt_events',
        source_platform: 'gdelt',
        source_database: 'etl_postgres',
        schema_name: 'public',
        table_name: 'gdelt_events',
        record_count: 10000,
        status: 'available',
        visibility: 'public',
        created_by: 'test_system'
      }
    ];

    // Insert datasets via SQL (using PostgreSQL directly)
    datasets.forEach((dataset) => {
      cy.task('queryDatabase', {
        query: `
          INSERT INTO datasets (
            name, description, dataset_type, source_platform,
            source_database, schema_name, table_name, record_count,
            status, visibility, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (name) DO UPDATE SET
            record_count = EXCLUDED.record_count,
            status = EXCLUDED.status
          RETURNING id, name, dataset_type, source_platform, record_count
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
    // Cleanup: Delete test project and datasets
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

  describe('Dataset API Endpoints', () => {
    it('should list all available datasets', () => {
      cy.request('/api/datasets?status=available').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.datasets).to.be.an('array');
        expect(response.body.datasets.length).to.be.greaterThan(0);

        // Verify our test datasets are included
        const datasetNames = response.body.datasets.map((d: any) => d.name);
        expect(datasetNames).to.include('Test Twitter Dataset');
        expect(datasetNames).to.include('Test Telegram Dataset');
      });
    });

    it('should filter datasets by type', () => {
      cy.request('/api/datasets?dataset_type=social_media').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;

        // All returned datasets should be social_media type
        response.body.datasets.forEach((dataset: any) => {
          expect(dataset.dataset_type).to.eq('social_media');
        });
      });
    });

    it('should filter datasets by platform', () => {
      cy.request('/api/datasets?source_platform=twitter').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;

        // All returned datasets should be from twitter
        response.body.datasets.forEach((dataset: any) => {
          expect(dataset.source_platform).to.eq('twitter');
        });
      });
    });

    it('should search datasets by name', () => {
      cy.request('/api/datasets?search=Twitter').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.datasets.length).to.be.greaterThan(0);

        // At least one dataset should contain "Twitter" in name
        const hasTwitter = response.body.datasets.some(
          (d: any) => d.name.toLowerCase().includes('twitter')
        );
        expect(hasTwitter).to.be.true;
      });
    });
  });

  describe('Workspace Creation with Dataset Selection', () => {
    let testWorkspace: any;

    beforeEach(() => {
      // Visit project page
      cy.visit(`/projects/${testProject.id}`);
      cy.contains('h1', testProject.name).should('be.visible');
    });

    afterEach(() => {
      // Cleanup: Delete test workspace
      if (testWorkspace) {
        cy.request('DELETE', `/api/workspaces?id=${testWorkspace.id}`);
        testWorkspace = null;
      }
    });

    it('should open workspace creation form', () => {
      cy.contains('button', 'New Workspace').click();
      cy.contains('h3', 'Create New Workspace').should('be.visible');
      cy.get('input[placeholder*="Twitter Analysis"]').should('be.visible');
    });

    it('should load and display available datasets', () => {
      cy.contains('button', 'New Workspace').click();

      // Wait for datasets to load
      cy.contains('Loading datasets...', { timeout: 10000 }).should('not.exist');

      // Should display dataset selection section
      cy.contains('Select Datasets').should('be.visible');

      // Should show our test datasets
      cy.contains('Test Twitter Dataset').should('be.visible');
      cy.contains('Test Telegram Dataset').should('be.visible');
    });

    it('should create workspace without datasets', () => {
      cy.contains('button', 'New Workspace').click();

      // Fill in workspace details
      cy.get('input[placeholder*="Twitter Analysis"]').type('Test Workspace No Data');
      cy.get('textarea[placeholder*="Describe the purpose"]').type('Testing workspace creation without datasets');

      // Create workspace
      cy.contains('button', 'Create Workspace').click();

      // Verify workspace appears in list
      cy.contains('.bg-white', 'Test Workspace No Data', { timeout: 10000 }).should('be.visible');
      cy.contains('0 sources').should('be.visible');
    });

    it('should create workspace with one dataset selected', () => {
      cy.contains('button', 'New Workspace').click();

      // Fill in workspace details
      cy.get('input[placeholder*="Twitter Analysis"]').type('Test Workspace Single Dataset');
      cy.get('textarea[placeholder*="Describe the purpose"]').type('Testing with one dataset');

      // Wait for datasets to load
      cy.contains('Loading datasets...', { timeout: 10000 }).should('not.exist');

      // Select Twitter dataset
      cy.contains('Test Twitter Dataset').parent().parent().find('input[type="checkbox"]').check();
      cy.contains('1 dataset selected').should('be.visible');

      // Create workspace
      cy.contains('button', 'Create Workspace').click();

      // Verify workspace appears with dataset
      cy.contains('.bg-white', 'Test Workspace Single Dataset', { timeout: 10000 }).should('be.visible');

      // Store workspace for API verification
      cy.request(`/api/workspaces?project_id=${testProject.id}`).then((response) => {
        const workspace = response.body.workspaces.find(
          (w: any) => w.name === 'Test Workspace Single Dataset'
        );
        testWorkspace = workspace;

        // Verify dataset is linked
        cy.request(`/api/datasets?workspace_id=${workspace.id}`).then((dsResponse) => {
          expect(dsResponse.body.datasets.length).to.eq(1);
          expect(dsResponse.body.datasets[0].dataset_name).to.include('Twitter');
        });
      });
    });

    it('should create workspace with multiple datasets selected', () => {
      cy.contains('button', 'New Workspace').click();

      // Fill in workspace details
      cy.get('input[placeholder*="Twitter Analysis"]').type('Test Workspace Multi Dataset');

      // Wait for datasets to load
      cy.contains('Loading datasets...', { timeout: 10000 }).should('not.exist');

      // Select multiple datasets
      cy.contains('Test Twitter Dataset').parent().parent().find('input[type="checkbox"]').check();
      cy.contains('Test Telegram Dataset').parent().parent().find('input[type="checkbox"]').check();
      cy.contains('2 datasets selected').should('be.visible');

      // Create workspace
      cy.contains('button', 'Create Workspace').click();

      // Verify workspace appears
      cy.contains('.bg-white', 'Test Workspace Multi Dataset', { timeout: 10000 }).should('be.visible');

      // Store workspace for API verification
      cy.request(`/api/workspaces?project_id=${testProject.id}`).then((response) => {
        const workspace = response.body.workspaces.find(
          (w: any) => w.name === 'Test Workspace Multi Dataset'
        );
        testWorkspace = workspace;

        // Verify both datasets are linked
        cy.request(`/api/datasets?workspace_id=${workspace.id}`).then((dsResponse) => {
          expect(dsResponse.body.datasets.length).to.eq(2);
          const names = dsResponse.body.datasets.map((d: any) => d.dataset_name);
          expect(names).to.include.members(['Test Twitter Dataset', 'Test Telegram Dataset']);
        });
      });
    });

    it('should toggle dataset selection on/off', () => {
      cy.contains('button', 'New Workspace').click();

      // Wait for datasets to load
      cy.contains('Loading datasets...', { timeout: 10000 }).should('not.exist');

      // Select Twitter dataset
      cy.contains('Test Twitter Dataset').parent().parent().find('input[type="checkbox"]').check();
      cy.contains('1 dataset selected').should('be.visible');

      // Unselect Twitter dataset
      cy.contains('Test Twitter Dataset').parent().parent().find('input[type="checkbox"]').uncheck();
      cy.contains('dataset selected').should('not.exist');

      // Select again
      cy.contains('Test Twitter Dataset').parent().parent().find('input[type="checkbox"]').check();
      cy.contains('1 dataset selected').should('be.visible');
    });

    it('should display dataset metadata correctly', () => {
      cy.contains('button', 'New Workspace').click();

      // Wait for datasets to load
      cy.contains('Loading datasets...', { timeout: 10000 }).should('not.exist');

      // Verify Twitter dataset metadata
      cy.contains('Test Twitter Dataset').parent().parent().within(() => {
        cy.contains('social_media').should('be.visible');
        cy.contains('twitter').should('be.visible');
        cy.contains('1,000 records').should('be.visible');
        cy.contains('Twitter posts for testing').should('be.visible');
      });

      // Verify GDELT dataset metadata
      cy.contains('Test GDELT Dataset').parent().parent().within(() => {
        cy.contains('gdelt_events').should('be.visible');
        cy.contains('gdelt').should('be.visible');
        cy.contains('10,000 records').should('be.visible');
      });
    });

    it('should cancel workspace creation', () => {
      cy.contains('button', 'New Workspace').click();
      cy.contains('h3', 'Create New Workspace').should('be.visible');

      // Fill in some details
      cy.get('input[placeholder*="Twitter Analysis"]').type('Cancelled Workspace');

      // Click cancel
      cy.contains('button', 'Cancel').click();

      // Form should close
      cy.contains('h3', 'Create New Workspace').should('not.exist');

      // Workspace should not be created
      cy.contains('Cancelled Workspace').should('not.exist');
    });
  });

  describe('Dataset Linking API', () => {
    let testWorkspace: any;

    before(() => {
      // Create a test workspace
      cy.request('POST', '/api/workspaces', {
        project_id: testProject.id,
        name: 'API Test Workspace',
        description: 'For testing API operations',
        workspace_type: 'general',
        created_by: 'test@example.com'
      }).then((response) => {
        testWorkspace = response.body.workspace;
      });
    });

    after(() => {
      // Cleanup workspace
      if (testWorkspace) {
        cy.request('DELETE', `/api/workspaces?id=${testWorkspace.id}`);
      }
    });

    it('should link dataset to workspace via API', () => {
      cy.request('POST', '/api/datasets', {
        action: 'link',
        workspace_id: testWorkspace.id,
        dataset_id: testDatasets[0].id,
        added_by: 'test@example.com'
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('linked');
      });

      // Verify link was created
      cy.request(`/api/datasets?workspace_id=${testWorkspace.id}`).then((response) => {
        expect(response.body.datasets.length).to.eq(1);
        expect(response.body.datasets[0].dataset_id).to.eq(testDatasets[0].id);
      });
    });

    it('should unlink dataset from workspace via API', () => {
      // First, link a dataset
      cy.request('POST', '/api/datasets', {
        action: 'link',
        workspace_id: testWorkspace.id,
        dataset_id: testDatasets[1].id,
        added_by: 'test@example.com'
      });

      // Then unlink it
      cy.request(
        'DELETE',
        `/api/datasets?action=unlink&workspace_id=${testWorkspace.id}&dataset_id=${testDatasets[1].id}`
      ).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('unlinked');
      });

      // Verify link was removed
      cy.request(`/api/datasets?workspace_id=${testWorkspace.id}`).then((response) => {
        const hasDataset = response.body.datasets.some(
          (d: any) => d.dataset_id === testDatasets[1].id
        );
        expect(hasDataset).to.be.false;
      });
    });

    it('should handle duplicate link attempts gracefully', () => {
      // Link dataset
      cy.request('POST', '/api/datasets', {
        action: 'link',
        workspace_id: testWorkspace.id,
        dataset_id: testDatasets[2].id,
        added_by: 'test@example.com'
      }).then((response) => {
        expect(response.status).to.eq(200);
      });

      // Try to link same dataset again
      cy.request('POST', '/api/datasets', {
        action: 'link',
        workspace_id: testWorkspace.id,
        dataset_id: testDatasets[2].id,
        added_by: 'test@example.com'
      }).then((response) => {
        // Should succeed (updates existing link)
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });

    it('should reject linking with missing parameters', () => {
      cy.request({
        method: 'POST',
        url: '/api/datasets',
        body: {
          action: 'link',
          workspace_id: testWorkspace.id
          // Missing dataset_id and added_by
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Missing required fields');
      });
    });
  });

  describe('Dataset Permissions', () => {
    it('should grant permission to a user', () => {
      cy.request('POST', '/api/datasets', {
        action: 'grant_permission',
        dataset_id: testDatasets[0].id,
        user_email: 'researcher@example.com',
        access_level: 'read',
        granted_by: 'admin@example.com'
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('granted');
      });
    });

    it('should revoke permission from a user', () => {
      // First grant permission
      cy.request('POST', '/api/datasets', {
        action: 'grant_permission',
        dataset_id: testDatasets[0].id,
        user_email: 'temp@example.com',
        access_level: 'read',
        granted_by: 'admin@example.com'
      });

      // Then revoke it
      cy.request(
        'DELETE',
        `/api/datasets?action=revoke_permission&dataset_id=${testDatasets[0].id}&user_email=temp@example.com`
      ).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('revoked');
      });
    });
  });
});
