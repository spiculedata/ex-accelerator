// Projects and Workspaces Database Service
// Manages multi-tiered project hierarchy with PostgreSQL persistence

import { postgresPool } from './postgres';

export interface Project {
  id: number;
  name: string;
  description: string;
  project_type: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  settings?: any;
  workspace_count?: number;
  member_count?: number;
  total_data_sources?: number;
}

export interface Workspace {
  id: number;
  project_id: number;
  project_name?: string;
  name: string;
  description: string;
  workspace_type: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  settings?: any;
  data_source_count?: number;
  member_count?: number;
  total_records?: number;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  email: string;
  role: string;
  added_at: string;
}

export interface WorkspaceDataSource {
  id: number;
  workspace_id: number;
  source_type: string;
  source_name: string;
  connection_details?: any;
  status: string;
  last_sync?: string;
  record_count: number;
  created_at: string;
}

class ProjectsDatabase {
  // ========== Projects CRUD ==========

  async getAllProjects(): Promise<Project[]> {
    try {
      const rows = await postgresPool.query<Project>('SELECT * FROM project_overview ORDER BY created_at DESC');
      return rows;
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  }

  async getProjectById(id: number): Promise<Project | null> {
    try {
      const rows = await postgresPool.query<Project>('SELECT * FROM project_overview WHERE id = $1', [id]);
      return rows[0] || null;
    } catch (error) {
      // A failed query is not "no such project": let the route answer 500 so callers do not treat it as deleted
      console.error('Error fetching project:', error);
      throw error;
    }
  }

  async createProject(data: {
    name: string;
    description: string;
    project_type: string;
    created_by: string;
    team_members?: string[];
  }): Promise<Project | null> {
    try {
      // Create project
      const projectRows = await postgresPool.query<Project>(
        `INSERT INTO projects (name, description, project_type, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.name, data.description, data.project_type, data.created_by]
      );

      const project = projectRows[0];

      // Add team members if provided
      if (data.team_members && data.team_members.length > 0) {
        for (const email of data.team_members) {
          await this.addProjectMember(project.id, email, 'member');
        }
      }

      // Add creator as owner
      await this.addProjectMember(project.id, data.created_by, 'owner');

      return project;
    } catch (error: any) {
      // Check for unique constraint violation
      if (error.code === '23505' && error.constraint === 'unique_project_name') {
        throw new Error(`A project with the name "${data.name}" already exists. Please choose a different name.`);
      }
      console.error('Error creating project:', error);
      throw new Error('Failed to create project. Please try again.');
    }
  }

  async updateProject(id: number, data: Partial<Project>): Promise<Project | null> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description);
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }
      if (data.settings !== undefined) {
        updates.push(`settings = $${paramCount++}`);
        values.push(JSON.stringify(data.settings));
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const rows = await postgresPool.query<Project>(
        `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      return rows[0] || null;
    } catch (error) {
      console.error('Error updating project:', error);
      return null;
    }
  }

  async deleteProject(id: number): Promise<boolean> {
    try {
      await postgresPool.query('DELETE FROM projects WHERE id = $1', [id]);
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      return false;
    }
  }

  // ========== Workspaces CRUD ==========

  async getWorkspacesByProject(projectId: number): Promise<Workspace[]> {
    try {
      const rows = await postgresPool.query<Workspace>(
        'SELECT * FROM workspace_overview WHERE project_id = $1 ORDER BY created_at DESC',
        [projectId]
      );
      return rows;
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      return [];
    }
  }

  async getWorkspaceById(id: number): Promise<Workspace | null> {
    try {
      const rows = await postgresPool.query<Workspace>('SELECT * FROM workspace_overview WHERE id = $1', [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error fetching workspace:', error);
      return null;
    }
  }

  async createWorkspace(data: {
    project_id: number;
    name: string;
    description: string;
    workspace_type: string;
    created_by: string;
    data_sources?: Array<{ source_type: string; source_name: string }>;
  }): Promise<Workspace | null> {
    try {
      // Create workspace
      const workspaceRows = await postgresPool.query<Workspace>(
        `INSERT INTO workspaces (project_id, name, description, workspace_type, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [data.project_id, data.name, data.description, data.workspace_type, data.created_by]
      );

      const workspace = workspaceRows[0];

      // Add data sources if provided
      if (data.data_sources && data.data_sources.length > 0) {
        for (const ds of data.data_sources) {
          await this.addWorkspaceDataSource(workspace.id, ds.source_type, ds.source_name);
        }
      }

      return workspace;
    } catch (error) {
      console.error('Error creating workspace:', error);
      return null;
    }
  }

  async updateWorkspace(id: number, data: Partial<Workspace>): Promise<Workspace | null> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description);
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const rows = await postgresPool.query<Workspace>(
        `UPDATE workspaces SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      return rows[0] || null;
    } catch (error) {
      console.error('Error updating workspace:', error);
      return null;
    }
  }

  async deleteWorkspace(id: number): Promise<boolean> {
    try {
      await postgresPool.query('DELETE FROM workspaces WHERE id = $1', [id]);
      return true;
    } catch (error) {
      console.error('Error deleting workspace:', error);
      return false;
    }
  }

  // ========== Project Members ==========

  async addProjectMember(projectId: number, email: string, role: string = 'member'): Promise<boolean> {
    try {
      await postgresPool.query(
        'INSERT INTO project_members (project_id, email, role) VALUES ($1, $2, $3) ON CONFLICT (project_id, email) DO NOTHING',
        [projectId, email, role]
      );
      return true;
    } catch (error) {
      console.error('Error adding project member:', error);
      return false;
    }
  }

  async removeProjectMember(projectId: number, email: string): Promise<boolean> {
    try {
      await postgresPool.query('DELETE FROM project_members WHERE project_id = $1 AND email = $2', [projectId, email]);
      return true;
    } catch (error) {
      console.error('Error removing project member:', error);
      return false;
    }
  }

  async getProjectMembers(projectId: number): Promise<ProjectMember[]> {
    try {
      const rows = await postgresPool.query<ProjectMember>(
        'SELECT * FROM project_members WHERE project_id = $1 ORDER BY added_at ASC',
        [projectId]
      );
      return rows;
    } catch (error) {
      console.error('Error fetching project members:', error);
      return [];
    }
  }

  // ========== Workspace Data Sources ==========

  async addWorkspaceDataSource(
    workspaceId: number,
    sourceType: string,
    sourceName: string,
    connectionDetails: any = {}
  ): Promise<boolean> {
    try {
      await postgresPool.query(
        `INSERT INTO workspace_data_sources (workspace_id, source_type, source_name, connection_details)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, source_type, source_name) DO NOTHING`,
        [workspaceId, sourceType, sourceName, JSON.stringify(connectionDetails)]
      );
      return true;
    } catch (error) {
      console.error('Error adding data source:', error);
      return false;
    }
  }

  async getWorkspaceDataSources(workspaceId: number): Promise<WorkspaceDataSource[]> {
    try {
      const rows = await postgresPool.query<WorkspaceDataSource>(
        'SELECT * FROM workspace_data_sources WHERE workspace_id = $1 ORDER BY created_at DESC',
        [workspaceId]
      );
      return rows;
    } catch (error) {
      console.error('Error fetching data sources:', error);
      return [];
    }
  }

  async removeWorkspaceDataSource(id: number): Promise<boolean> {
    try {
      await postgresPool.query('DELETE FROM workspace_data_sources WHERE id = $1', [id]);
      return true;
    } catch (error) {
      console.error('Error removing data source:', error);
      return false;
    }
  }

  // ========== Helper Methods ==========

  async getProjectHierarchy(projectId: number): Promise<any> {
    try {
      const project = await this.getProjectById(projectId);
      if (!project) return null;

      const workspaces = await this.getWorkspacesByProject(projectId);
      const members = await this.getProjectMembers(projectId);

      // Get data sources for each workspace
      const workspacesWithSources = await Promise.all(
        workspaces.map(async (workspace) => ({
          ...workspace,
          dataSources: await this.getWorkspaceDataSources(workspace.id)
        }))
      );

      return {
        ...project,
        members,
        workspaces: workspacesWithSources
      };
    } catch (error) {
      console.error('Error fetching project hierarchy:', error);
      return null;
    }
  }
}

export const projectsDb = new ProjectsDatabase();
