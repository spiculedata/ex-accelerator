// Database Initialization Service
// Ensures all required tables exist for the workflow system

import { unifiedDb } from './duckdb';

export class DatabaseInitService {
  private initialized = false;

  async initializeWorkflowTables(): Promise<void> {
    if (this.initialized) return;

    try {
      await unifiedDb.connect();

      // Create workflow management tables
      await this.createWorkflowTables();
      
      this.initialized = true;
      console.log('Workflow database tables initialized successfully');
    } catch (error) {
      console.error('Failed to initialize workflow tables:', error);
      throw error;
    }
  }

  private async createWorkflowTables(): Promise<void> {
    // Published Workflows Table
    await unifiedDb.query(`
      CREATE TABLE IF NOT EXISTS published_workflows (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        description TEXT,
        version VARCHAR DEFAULT '1.0.0',
        status VARCHAR DEFAULT 'published',
        pattern VARCHAR NOT NULL,
        definition TEXT NOT NULL,
        generated_code TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR NOT NULL,
        tags TEXT,
        metadata TEXT
      )
    `);

    // Workflow Executions Table
    await unifiedDb.query(`
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id VARCHAR PRIMARY KEY,
        workflow_id VARCHAR NOT NULL,
        workflow_name VARCHAR NOT NULL,
        status VARCHAR DEFAULT 'queued',
        progress INTEGER DEFAULT 0,
        current_step VARCHAR,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        duration INTEGER,
        input TEXT,
        output TEXT,
        error TEXT,
        logs TEXT,
        metadata TEXT
      )
    `);

    // Create indexes for performance
    await unifiedDb.query(`
      CREATE INDEX IF NOT EXISTS idx_published_workflows_status 
      ON published_workflows(status)
    `);

    await unifiedDb.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id 
      ON workflow_executions(workflow_id)
    `);

    await unifiedDb.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_executions_status 
      ON workflow_executions(status)
    `);
  }

  async testConnection(): Promise<boolean> {
    try {
      await unifiedDb.connect();
      await unifiedDb.query('SELECT 1 as test');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}

export const databaseInit = new DatabaseInitService();