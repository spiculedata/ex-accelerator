// API Integration Tests for Projects/Workspaces

describe('Projects API', () => {
  beforeEach(() => {
    // Reset to known state
    cy.exec('psql -U tombarber -d postgres -f sql/schemas/projects_workspaces_schema.sql');
  });

  describe('GET /api/projects', () => {
    it('should return all projects', () => {
      cy.request('/api/projects').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.projects).to.be.an('array');
        expect(response.body.projects).to.have.length.at.least(3);
      });
    });

    it('should return project by ID', () => {
      cy.request('/api/projects?id=1').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.project).to.have.property('name');
        expect(response.body.project).to.have.property('workspace_count');
        expect(response.body.project).to.have.property('member_count');
      });
    });

    it('should return proper structure with counts', () => {
      cy.request('/api/projects?id=1').then((response) => {
        const project = response.body.project;
        expect(project).to.include.keys([
          'id',
          'name',
          'description',
          'project_type',
          'status',
          'created_by',
          'created_at',
          'updated_at',
          'workspace_count',
          'member_count'
        ]);
      });
    });
  });

  describe('POST /api/projects', () => {
    it('should create project with all fields', () => {
      cy.request({
        method: 'POST',
        url: '/api/projects',
        body: {
          name: 'Complete Test Project',
          description: 'Full test with all fields',
          project_type: 'market-research',
          created_by: 'owner@example.com',
          data_sources: ['twitter', 'reddit', 'telegram'],
          team_members: ['member1@example.com', 'member2@example.com']
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.project).to.have.property('id');

        // Verify project was created
        const projectId = response.body.project.id;
        cy.request(`/api/projects?id=${projectId}`).then((getResponse) => {
          expect(getResponse.body.project.name).to.eq('Complete Test Project');
          expect(getResponse.body.project.member_count).to.be.at.least(2); // owner + 2 members
        });
      });
    });

    it('should handle missing optional fields', () => {
      cy.request({
        method: 'POST',
        url: '/api/projects',
        body: {
          name: 'Minimal Project',
          project_type: 'social-media',
          created_by: 'user@example.com'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.project.description).to.eq('');
      });
    });

    it('should reject duplicate project names', () => {
      cy.request({
        method: 'POST',
        url: '/api/projects',
        body: {
          name: 'Social Media Sentiment Analysis', // Existing name
          project_type: 'social-media',
          created_by: 'user@example.com'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(500);
        expect(response.body.success).to.be.false;
      });
    });
  });

  describe('PUT /api/projects', () => {
    it('should update project fields', () => {
      cy.request({
        method: 'PUT',
        url: '/api/projects',
        body: {
          id: 1,
          name: 'Updated Project Name',
          description: 'Updated description',
          status: 'archived'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.project.name).to.eq('Updated Project Name');
        expect(response.body.project.status).to.eq('archived');
      });
    });

    it('should require project ID', () => {
      cy.request({
        method: 'PUT',
        url: '/api/projects',
        body: {
          name: 'No ID'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.error).to.contain('ID required');
      });
    });
  });

  describe('DELETE /api/projects', () => {
    it('should delete project successfully', () => {
      // Create test project
      cy.request({
        method: 'POST',
        url: '/api/projects',
        body: {
          name: 'Delete Test Project',
          project_type: 'social-media',
          created_by: 'user@example.com'
        }
      }).then((createResponse) => {
        const projectId = createResponse.body.project.id;

        // Delete it
        cy.request({
          method: 'DELETE',
          url: `/api/projects?id=${projectId}`
        }).then((deleteResponse) => {
          expect(deleteResponse.status).to.eq(200);
          expect(deleteResponse.body.success).to.be.true;

          // Verify it's gone
          cy.request(`/api/projects?id=${projectId}`).then((getResponse) => {
            expect(getResponse.body.project).to.be.null;
          });
        });
      });
    });
  });
});

describe('Workspaces API', () => {
  beforeEach(() => {
    cy.exec('psql -U tombarber -d postgres -f sql/schemas/projects_workspaces_schema.sql');
  });

  describe('POST /api/workspaces', () => {
    it('should create workspace in project', () => {
      cy.request({
        method: 'POST',
        url: '/api/workspaces',
        body: {
          project_id: 1,
          name: 'New Test Workspace',
          description: 'Testing workspace creation',
          workspace_type: 'analysis',
          created_by: 'user@example.com'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.workspace.name).to.eq('New Test Workspace');
        expect(response.body.workspace.project_id).to.eq(1);
      });
    });

    it('should require project_id', () => {
      cy.request({
        method: 'POST',
        url: '/api/workspaces',
        body: {
          name: 'No Project',
          workspace_type: 'general',
          created_by: 'user@example.com'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.error).to.contain('project_id required');
      });
    });
  });

  describe('GET /api/workspaces', () => {
    it('should return workspaces for a project', () => {
      cy.request('/api/workspaces?project_id=1').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.workspaces).to.be.an('array');
        expect(response.body.workspaces).to.have.length(3);
      });
    });

    it('should return workspace by ID with data sources', () => {
      cy.request('/api/workspaces?id=1').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.workspace).to.have.property('name');
        expect(response.body.workspace).to.have.property('dataSources');
        expect(response.body.workspace.dataSources).to.be.an('array');
      });
    });

    it('should require either workspace_id or project_id', () => {
      cy.request({
        url: '/api/workspaces',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
      });
    });
  });

  describe('Workspace Data Sources', () => {
    it('should include data source count in workspace overview', () => {
      cy.request('/api/workspaces?project_id=1').then((response) => {
        const workspace = response.body.workspaces[0];
        expect(workspace).to.have.property('data_source_count');
        expect(workspace.data_source_count).to.be.a('number');
      });
    });

    it('should show total records from data sources', () => {
      cy.request('/api/workspaces?project_id=1').then((response) => {
        const workspace = response.body.workspaces[0];
        expect(workspace).to.have.property('total_records');
      });
    });
  });
});
