-- Published workflows and their executions, used by the workflow builder and
-- src/lib/services/serverWorkflowService.ts. IF NOT EXISTS keeps this safe on databases where
-- these tables were created by hand earlier. If publishing later fails with a missing-column error,
-- the database has an older, differently shaped copy: rename or drop it and re-run this file.

CREATE TABLE IF NOT EXISTS published_workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0',
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    workflow_definition JSONB NOT NULL,
    generated_code JSONB NOT NULL, -- snapshot of the generated script for display; runs regenerate from workflow_definition
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES published_workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    current_step TEXT,
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB,
    error TEXT,
    logs JSONB NOT NULL DEFAULT '[]',
    duration INTEGER, -- milliseconds
    triggered_by TEXT NOT NULL DEFAULT 'manual',
    priority TEXT NOT NULL DEFAULT 'medium',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions (workflow_id, started_at DESC);
