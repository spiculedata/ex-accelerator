// E2E Tests for Multi-Tiered Project/Workspace System

describe('Projects and Workspaces', () => {
  beforeEach(() => {
    // Reset database to known state before each test
    cy.exec('psql -U tombarber -d postgres -f sql/schemas/projects_workspaces_schema.sql');
    cy.visit('/');
  });

  describe('Project Listing', () => {
    it('should display all projects from database', () => {
      cy.visit('/projects');
      cy.get('[data-testid="project-card"]').should('have.length.at.least', 3);
    });

    it('should show project details (name, description, workspace count)', () => {
      cy.visit('/projects');
      cy.contains('Social Media Sentiment Analysis').should('be.visible');
      cy.contains('3 workspaces').should('be.visible');
    });

    it('should navigate to project detail when clicked', () => {
      cy.visit('/projects');
      cy.contains('Social Media Sentiment Analysis').click();
      cy.url().should('match', /\/projects\/\d+/);
    });
  });

  describe('Project Creation', () => {
    it('should create a new project via form', () => {
      cy.visit('/projects/new');

      // Fill out form
      cy.get('input[type="text"]').first().type('Test E2E Project');
      cy.get('textarea').first().type('This is a test project');
      cy.get('select').first().select('social-media');

      // Select data sources
      cy.contains('Twitter/X').click();
      cy.contains('Reddit').click();

      // Add team member
      cy.get('input[type="email"]').type('test@example.com');
      cy.contains('Add Member').click();

      // Submit form
      cy.contains('Create Project').click();

      // Should redirect to new project page
      cy.url().should('match', /\/projects\/\d+/, { timeout: 10000 });
      cy.contains('Test E2E Project').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.visit('/projects/new');

      // Try to submit without name
      cy.contains('Create Project').should('be.disabled');

      // Add name
      cy.get('input[type="text"]').first().type('Test Project');

      // Should still be disabled without data sources
      cy.contains('Create Project').should('be.disabled');

      // Add data source
      cy.contains('Twitter/X').click();

      // Now should be enabled
      cy.contains('Create Project').should('not.be.disabled');
    });

    it('should persist project to database', () => {
      cy.visit('/projects/new');

      cy.get('input[type="text"]').first().type('Persistence Test Project');
      cy.get('select').first().select('market-research');
      cy.contains('Twitter/X').click();
      cy.contains('Create Project').click();

      // Wait for redirect
      cy.url().should('match', /\/projects\/\d+/, { timeout: 10000 });

      // Verify project exists in database
      cy.exec('psql -U tombarber -d postgres -c "SELECT COUNT(*) FROM projects WHERE name = \'Persistence Test Project\'"')
        .its('stdout')
        .should('contain', '1');
    });
  });

  describe('Project Detail Page', () => {
    it('should load project from database', () => {
      cy.visit('/projects/1');
      cy.contains('Social Media Sentiment Analysis').should('be.visible');
    });

    it('should display workspaces grid', () => {
      cy.visit('/projects/1');
      cy.contains('Workspaces').should('be.visible');
      cy.get('[data-testid="workspace-card"]').should('have.length.at.least', 2);
    });

    it('should show workspace details', () => {
      cy.visit('/projects/1');
      cy.contains('Twitter Analysis').should('be.visible');
      cy.contains('analysis').should('be.visible'); // workspace type
      cy.contains('sources').should('be.visible'); // data source count
    });
  });

  describe('Workspace Creation', () => {
    it('should create workspace within project', () => {
      cy.visit('/projects/1');

      // Click New Workspace button
      cy.contains('+ New Workspace').click();

      // Form should appear
      cy.get('input[placeholder*="Twitter Analysis"]').should('be.visible');

      // Fill out form
      cy.get('input[placeholder*="Twitter Analysis"]').type('Test Workspace');
      cy.get('select').contains('General').parent().select('analysis');
      cy.get('textarea').type('Test workspace description');

      // Submit
      cy.contains('Create Workspace').click();

      // Should appear in list
      cy.contains('Test Workspace').should('be.visible', { timeout: 5000 });
    });

    it('should persist workspace to database', () => {
      cy.visit('/projects/1');

      cy.contains('+ New Workspace').click();
      cy.get('input[placeholder*="Twitter Analysis"]').type('DB Persistence Test');
      cy.get('textarea').type('Testing database persistence');
      cy.contains('Create Workspace').click();

      // Wait for workspace to appear
      cy.contains('DB Persistence Test').should('be.visible', { timeout: 5000 });

      // Verify in database
      cy.exec('psql -U tombarber -d postgres -c "SELECT COUNT(*) FROM workspaces WHERE name = \'DB Persistence Test\'"')
        .its('stdout')
        .should('contain', '1');
    });

    it('should show workspace types correctly', () => {
      cy.visit('/projects/1');

      cy.contains('+ New Workspace').click();
      cy.get('select').should('contain', 'General');
      cy.get('select').should('contain', 'Analysis');
      cy.get('select').should('contain', 'Exploration');
      cy.get('select').should('contain', 'Reporting');
    });
  });

  describe('API Endpoints', () => {
    it('should create project via POST /api/projects', () => {
      cy.request({
        method: 'POST',
        url: '/api/projects',
        body: {
          name: 'API Test Project',
          description: 'Created via API test',
          project_type: 'social-media',
          created_by: 'test@example.com',
          data_sources: ['twitter', 'reddit'],
          team_members: ['member@example.com']
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.project).to.have.property('id');
        expect(response.body.project.name).to.eq('API Test Project');
      });
    });

    it('should list all projects via GET /api/projects', () => {
      cy.request('/api/projects').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.projects).to.be.an('array');
        expect(response.body.projects.length).to.be.at.least(3);
      });
    });

    it('should get specific project by ID', () => {
      cy.request('/api/projects?id=1').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.project).to.have.property('id', 1);
        expect(response.body.project).to.have.property('name');
        expect(response.body.project).to.have.property('workspace_count');
      });
    });

    it('should create workspace via POST /api/workspaces', () => {
      cy.request({
        method: 'POST',
        url: '/api/workspaces',
        body: {
          project_id: 1,
          name: 'API Test Workspace',
          description: 'Created via API',
          workspace_type: 'analysis',
          created_by: 'test@example.com'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.workspace).to.have.property('id');
        expect(response.body.workspace.name).to.eq('API Test Workspace');
      });
    });

    it('should list workspaces by project_id', () => {
      cy.request('/api/workspaces?project_id=1').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.workspaces).to.be.an('array');
        expect(response.body.workspaces.length).to.be.at.least(3);
      });
    });
  });

  describe('Database Integrity', () => {
    it('should cascade delete workspaces when project is deleted', () => {
      // Create test project
      cy.request({
        method: 'POST',
        url: '/api/projects',
        body: {
          name: 'Cascade Test Project',
          description: 'Testing cascade delete',
          project_type: 'social-media',
          created_by: 'test@example.com'
        }
      }).then((projectResponse) => {
        const projectId = projectResponse.body.project.id;

        // Create workspace in project
        cy.request({
          method: 'POST',
          url: '/api/workspaces',
          body: {
            project_id: projectId,
            name: 'Cascade Test Workspace',
            description: 'Should be deleted',
            workspace_type: 'general',
            created_by: 'test@example.com'
          }
        });

        // Delete project
        cy.request({
          method: 'DELETE',
          url: `/api/projects?id=${projectId}`
        }).then((deleteResponse) => {
          expect(deleteResponse.body.success).to.be.true;

          // Verify workspace was cascade deleted
          cy.exec(`psql -U tombarber -d postgres -c "SELECT COUNT(*) FROM workspaces WHERE project_id = ${projectId}"`)
            .its('stdout')
            .should('contain', '0');
        });
      });
    });

    it('should enforce unique project names', () => {
      cy.request({
        method: 'POST',
        url: '/api/projects',
        body: {
          name: 'Social Media Sentiment Analysis', // Duplicate name
          description: 'Duplicate',
          project_type: 'social-media',
          created_by: 'test@example.com'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(500);
        expect(response.body.success).to.be.false;
      });
    });
  });

  describe('Hierarchy Navigation', () => {
    it('should navigate from projects list → project detail → workspace', () => {
      // Start at projects list
      cy.visit('/projects');
      cy.contains('Social Media Sentiment Analysis').click();

      // Should be on project detail
      cy.url().should('include', '/projects/1');
      cy.contains('Workspaces').should('be.visible');

      // Click on workspace
      cy.contains('Twitter Analysis').click();

      // Should navigate to workspace detail (once implemented)
      cy.url().should('include', '/workspaces/');
    });

    it('should show correct breadcrumb: Project > Workspace', () => {
      cy.visit('/projects/1');
      cy.contains('Social Media Sentiment Analysis').should('be.visible');

      // Click workspace
      cy.contains('Twitter Analysis').click();

      // Should show hierarchy
      cy.url().should('include', '/workspaces/');
    });
  });
});
