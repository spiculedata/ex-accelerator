// Dataset Management Service
// Provides database operations for managing datasets, permissions, and workspace associations

import { postgresPool } from './postgres';

export interface Dataset {
  id: number;
  name: string;
  description: string | null;
  dataset_type: string;
  source_platform: string | null;
  source_database: string;
  schema_name: string | null;
  table_name: string;
  record_count: number;
  date_range_start: Date | null;
  date_range_end: Date | null;
  last_updated: Date;
  crawl_id: string | null;
  ingestion_method: string;
  metadata: Record<string, any>;
  status: string;
  visibility: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  // From views/joins
  permission_count?: number;
  workspace_count?: number;
  tags?: string[];
  has_access?: boolean;
}

export interface DatasetPermission {
  id: number;
  dataset_id: number;
  permission_type: string;
  user_email: string | null;
  role_name: string | null;
  access_level: string;
  granted_by: string | null;
  granted_at: Date;
  expires_at: Date | null;
}

export interface WorkspaceDataset {
  id: number;
  workspace_id: number;
  dataset_id: number;
  added_by: string | null;
  added_at: Date;
  settings: Record<string, any>;
  status: string;
  // From joins
  dataset_name?: string;
  description?: string;
  dataset_type?: string;
  source_platform?: string;
  record_count?: number;
  date_range_start?: Date | null;
  date_range_end?: Date | null;
  metadata?: Record<string, any>;
}

export interface DatasetFilters {
  dataset_type?: string;
  source_platform?: string;
  status?: string;
  visibility?: string;
  tags?: string[];
  user_email?: string; // Filter by user access
  date_range_start?: Date;
  date_range_end?: Date;
}

class DatasetsDatabase {
  private initialized = false;

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    if (this.initialized) return;
    await postgresPool.connect();
    this.initialized = true;
  }

  /**
   * List all available datasets with optional filters
   */
  async getDatasets(filters: DatasetFilters = {}): Promise<Dataset[]> {
    if (!this.initialized) await this.connect();

    let query = 'SELECT * FROM dataset_overview WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.dataset_type) {
      query += ` AND dataset_type = $${paramIndex++}`;
      params.push(filters.dataset_type);
    }

    if (filters.source_platform) {
      query += ` AND source_platform = $${paramIndex++}`;
      params.push(filters.source_platform);
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters.visibility) {
      query += ` AND visibility = $${paramIndex++}`;
      params.push(filters.visibility);
    }

    if (filters.tags && filters.tags.length > 0) {
      query += ` AND tags && $${paramIndex++}`; // PostgreSQL array overlap operator
      params.push(filters.tags);
    }

    query += ' ORDER BY created_at DESC';

    const rows = await postgresPool.query<Dataset>(query, params);
    return rows;
  }

  /**
   * Get datasets accessible by a specific user (respecting permissions)
   */
  async getAccessibleDatasets(userEmail: string, filters: DatasetFilters = {}): Promise<Dataset[]> {
    if (!this.initialized) await this.connect();

    let query = `
      SELECT DISTINCT d.*
      FROM datasets d
      LEFT JOIN dataset_permissions dp ON d.id = dp.dataset_id
      WHERE d.status = 'available'
        AND (
          d.visibility = 'public'
          OR dp.user_email = $1
          OR dp.role_name IN (SELECT role_name FROM user_roles WHERE user_email = $1)
          OR (dp.expires_at IS NULL OR dp.expires_at > CURRENT_TIMESTAMP)
        )
    `;

    const params: any[] = [userEmail];
    let paramIndex = 2;

    if (filters.dataset_type) {
      query += ` AND d.dataset_type = $${paramIndex++}`;
      params.push(filters.dataset_type);
    }

    if (filters.source_platform) {
      query += ` AND d.source_platform = $${paramIndex++}`;
      params.push(filters.source_platform);
    }

    query += ' ORDER BY d.created_at DESC';

    const rows = await postgresPool.query<Dataset>(query, params);
    return rows;
  }

  /**
   * Get a specific dataset by ID
   */
  async getDatasetById(datasetId: number): Promise<Dataset | null> {
    if (!this.initialized) await this.connect();

    const rows = await postgresPool.query<Dataset>(
      'SELECT * FROM dataset_overview WHERE id = $1',
      [datasetId]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get a specific dataset by name
   */
  async getDatasetByName(name: string): Promise<Dataset | null> {
    if (!this.initialized) await this.connect();

    const rows = await postgresPool.query<Dataset>(
      'SELECT * FROM dataset_overview WHERE name = $1',
      [name]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Check if a user has access to a dataset
   */
  async checkUserAccess(
    datasetId: number,
    userEmail: string
  ): Promise<{ hasAccess: boolean; accessLevel: string | null }> {
    if (!this.initialized) await this.connect();

    const rows = await postgresPool.query(
      `
      SELECT
        d.visibility,
        dp.access_level,
        dp.expires_at
      FROM datasets d
      LEFT JOIN dataset_permissions dp ON d.id = dp.dataset_id AND dp.user_email = $2
      WHERE d.id = $1
      `,
      [datasetId, userEmail]
    );

    if (rows.length === 0) {
      return { hasAccess: false, accessLevel: null };
    }

    const { visibility, access_level, expires_at } = rows[0];

    // Public datasets are accessible to everyone
    if (visibility === 'public') {
      return { hasAccess: true, accessLevel: 'read' };
    }

    // Check if user has explicit permission
    if (access_level) {
      // Check if permission has expired
      if (expires_at && new Date(expires_at) < new Date()) {
        return { hasAccess: false, accessLevel: null };
      }
      return { hasAccess: true, accessLevel: access_level };
    }

    return { hasAccess: false, accessLevel: null };
  }

  /**
   * Link a dataset to a workspace
   */
  async linkDatasetToWorkspace(
    workspaceId: number,
    datasetId: number,
    addedBy: string,
    settings: Record<string, any> = {}
  ): Promise<WorkspaceDataset> {
    if (!this.initialized) await this.connect();

    const rows = await postgresPool.query<WorkspaceDataset>(
      `
      INSERT INTO workspace_datasets (workspace_id, dataset_id, added_by, settings, status)
      VALUES ($1, $2, $3, $4, 'active')
      ON CONFLICT (workspace_id, dataset_id)
      DO UPDATE SET
        settings = EXCLUDED.settings,
        status = 'active',
        added_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [workspaceId, datasetId, addedBy, JSON.stringify(settings)]
    );

    return rows[0];
  }

  /**
   * Unlink a dataset from a workspace
   */
  async unlinkDatasetFromWorkspace(workspaceId: number, datasetId: number): Promise<boolean> {
    if (!this.initialized) await this.connect();

    await postgresPool.query(
      'DELETE FROM workspace_datasets WHERE workspace_id = $1 AND dataset_id = $2',
      [workspaceId, datasetId]
    );

    return true;
  }

  /**
   * Get all datasets linked to a workspace
   */
  async getWorkspaceDatasets(workspaceId: number): Promise<WorkspaceDataset[]> {
    if (!this.initialized) await this.connect();

    const rows = await postgresPool.query<WorkspaceDataset>(
      'SELECT * FROM workspace_dataset_overview WHERE workspace_id = $1 ORDER BY added_at DESC',
      [workspaceId]
    );

    return rows;
  }

  /**
   * Get all workspaces that use a specific dataset
   */
  async getDatasetWorkspaces(datasetId: number): Promise<number[]> {
    if (!this.initialized) await this.connect();

    const rows = await postgresPool.query<{ workspace_id: number }>(
      'SELECT workspace_id FROM workspace_datasets WHERE dataset_id = $1 AND status = $2',
      [datasetId, 'active']
    );

    return rows.map((row) => row.workspace_id);
  }

  /**
   * Grant permission to a user for a dataset
   */
  async grantDatasetPermission(
    datasetId: number,
    userEmail: string,
    accessLevel: string = 'read',
    grantedBy: string,
    expiresAt: Date | null = null
  ): Promise<DatasetPermission> {
    if (!this.initialized) await this.connect();

    const rows = await postgresPool.query<DatasetPermission>(
      `
      INSERT INTO dataset_permissions (dataset_id, permission_type, user_email, access_level, granted_by, expires_at)
      VALUES ($1, 'user', $2, $3, $4, $5)
      ON CONFLICT (dataset_id, permission_type, user_email, role_name)
      DO UPDATE SET
        access_level = EXCLUDED.access_level,
        granted_by = EXCLUDED.granted_by,
        expires_at = EXCLUDED.expires_at,
        granted_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [datasetId, userEmail, accessLevel, grantedBy, expiresAt]
    );

    return rows[0];
  }

  /**
   * Revoke permission from a user for a dataset
   */
  async revokeDatasetPermission(datasetId: number, userEmail: string): Promise<boolean> {
    if (!this.initialized) await this.connect();

    await postgresPool.query(
      'DELETE FROM dataset_permissions WHERE dataset_id = $1 AND user_email = $2',
      [datasetId, userEmail]
    );

    return true;
  }

  /**
   * Get all permissions for a dataset
   */
  async getDatasetPermissions(datasetId: number): Promise<DatasetPermission[]> {
    if (!this.initialized) await this.connect();

    const rows = await postgresPool.query<DatasetPermission>(
      'SELECT * FROM dataset_permissions WHERE dataset_id = $1 ORDER BY granted_at DESC',
      [datasetId]
    );

    return rows;
  }

  /**
   * Get statistics about datasets
   */
  async getDatasetStats(): Promise<{
    total: number;
    by_type: Record<string, number>;
    by_platform: Record<string, number>;
    by_status: Record<string, number>;
    total_records: number;
  }> {
    if (!this.initialized) await this.connect();

    const [totalResult, typeResult, platformResult, statusResult, recordsResult] =
      await Promise.all([
        postgresPool.query<{ count: number }>('SELECT COUNT(*) as count FROM datasets'),
        postgresPool.query<{ dataset_type: string; count: number }>(
          'SELECT dataset_type, COUNT(*) as count FROM datasets GROUP BY dataset_type'
        ),
        postgresPool.query<{ source_platform: string; count: number }>(
          'SELECT source_platform, COUNT(*) as count FROM datasets WHERE source_platform IS NOT NULL GROUP BY source_platform'
        ),
        postgresPool.query<{ status: string; count: number }>(
          'SELECT status, COUNT(*) as count FROM datasets GROUP BY status'
        ),
        postgresPool.query<{ total: number }>(
          'SELECT SUM(record_count) as total FROM datasets'
        )
      ]);

    return {
      total: totalResult[0].count,
      by_type: Object.fromEntries(typeResult.map((r) => [r.dataset_type, Number(r.count)])),
      by_platform: Object.fromEntries(
        platformResult.map((r) => [r.source_platform, Number(r.count)])
      ),
      by_status: Object.fromEntries(statusResult.map((r) => [r.status, Number(r.count)])),
      total_records: Number(recordsResult[0].total || 0)
    };
  }

  /**
   * Search datasets by name or description
   */
  async searchDatasets(searchTerm: string, filters: DatasetFilters = {}): Promise<Dataset[]> {
    if (!this.initialized) await this.connect();

    let query = `
      SELECT * FROM dataset_overview
      WHERE (
        name ILIKE $1
        OR description ILIKE $1
        OR $1 = ANY(tags)
      )
    `;

    const params: any[] = [`%${searchTerm}%`];
    let paramIndex = 2;

    if (filters.dataset_type) {
      query += ` AND dataset_type = $${paramIndex++}`;
      params.push(filters.dataset_type);
    }

    if (filters.source_platform) {
      query += ` AND source_platform = $${paramIndex++}`;
      params.push(filters.source_platform);
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const rows = await postgresPool.query<Dataset>(query, params);
    return rows;
  }
}

// Export singleton instance
export const datasetsDb = new DatasetsDatabase();
