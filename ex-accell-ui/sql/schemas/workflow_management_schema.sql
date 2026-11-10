-- SUPERSEDED by db/migrations/0006_workflows.sql. This DuckDB-dialect file does not match the columns
-- the application uses; it is kept only as design history.

-- Workflow Management Schema
-- Tables for publishing, executing, and managing workflows within the webapp
-- Integrates with the unified social analytics database

-- Published Workflows Table
-- Stores workflows that have been published and are available for execution
CREATE TABLE IF NOT EXISTS published_workflows (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    version VARCHAR DEFAULT '1.0.0',
    status VARCHAR DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    pattern VARCHAR NOT NULL, -- activity-sequence, fan-out-fan-in, monitor, human-interaction
    definition TEXT NOT NULL, -- JSON workflow definition
    generated_code TEXT NOT NULL, -- JSON generated Dapr code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR NOT NULL,
    tags TEXT, -- JSON array of tags
    metadata TEXT -- JSON metadata (stepCount, estimatedDuration, datasetRequirements)
);

-- Workflow Executions Table
-- Tracks individual workflow execution instances
CREATE TABLE IF NOT EXISTS workflow_executions (
    id VARCHAR PRIMARY KEY,
    workflow_id VARCHAR NOT NULL,
    workflow_name VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    current_step VARCHAR,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration INTEGER, -- Duration in milliseconds
    input TEXT, -- JSON input data
    output TEXT, -- JSON output data
    error TEXT, -- Error message if failed
    logs TEXT, -- JSON array of log entries
    metadata TEXT, -- JSON execution metadata
    FOREIGN KEY (workflow_id) REFERENCES published_workflows(id)
);

-- Workflow Schedules Table
-- Manages scheduled workflow executions
CREATE TABLE IF NOT EXISTS workflow_schedules (
    id VARCHAR PRIMARY KEY,
    workflow_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    schedule VARCHAR NOT NULL, -- Cron expression
    enabled BOOLEAN DEFAULT true,
    next_run TIMESTAMP,
    last_run TIMESTAMP,
    timezone VARCHAR DEFAULT 'UTC',
    input TEXT, -- JSON input data for scheduled runs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES published_workflows(id)
);

-- Workflow Templates Table
-- Pre-built workflow templates for common use cases
CREATE TABLE IF NOT EXISTS workflow_templates (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    category VARCHAR NOT NULL, -- data-cleaning, analytics, nlp, etc.
    difficulty VARCHAR DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    definition TEXT NOT NULL, -- JSON workflow definition
    thumbnail VARCHAR, -- URL to template thumbnail
    tags TEXT, -- JSON array of tags
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow Execution Steps Table
-- Detailed tracking of individual step executions within workflows
CREATE TABLE IF NOT EXISTS workflow_execution_steps (
    id VARCHAR PRIMARY KEY,
    execution_id VARCHAR NOT NULL,
    step_id VARCHAR NOT NULL,
    step_name VARCHAR NOT NULL,
    step_type VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration INTEGER, -- Duration in milliseconds
    input_data TEXT, -- JSON input data for this step
    output_data TEXT, -- JSON output data from this step
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    FOREIGN KEY (execution_id) REFERENCES workflow_executions(id)
);

-- Workflow Results Table
-- Stores final results and artifacts from workflow executions
CREATE TABLE IF NOT EXISTS workflow_results (
    id VARCHAR PRIMARY KEY,
    execution_id VARCHAR NOT NULL,
    workflow_id VARCHAR NOT NULL,
    result_type VARCHAR NOT NULL, -- dataset, report, model, analysis
    result_name VARCHAR NOT NULL,
    result_path VARCHAR, -- File path or database table name
    result_size INTEGER, -- Size in bytes
    result_format VARCHAR, -- csv, json, parquet, etc.
    result_metadata TEXT, -- JSON metadata about the result
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Optional expiration date
    FOREIGN KEY (execution_id) REFERENCES workflow_executions(id),
    FOREIGN KEY (workflow_id) REFERENCES published_workflows(id)
);

-- Workflow Permissions Table
-- Manages access control for workflows (future enhancement)
CREATE TABLE IF NOT EXISTS workflow_permissions (
    id VARCHAR PRIMARY KEY,
    workflow_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    permission VARCHAR NOT NULL CHECK (permission IN ('read', 'write', 'execute', 'admin')),
    granted_by VARCHAR NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES published_workflows(id)
);

-- Workflow Usage Analytics Table
-- Tracks workflow usage patterns and performance metrics
CREATE TABLE IF NOT EXISTS workflow_analytics (
    id VARCHAR PRIMARY KEY,
    workflow_id VARCHAR NOT NULL,
    execution_id VARCHAR,
    event_type VARCHAR NOT NULL, -- published, executed, failed, cancelled, viewed
    event_data TEXT, -- JSON event data
    user_id VARCHAR,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES published_workflows(id),
    FOREIGN KEY (execution_id) REFERENCES workflow_executions(id)
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_published_workflows_status ON published_workflows(status);
CREATE INDEX IF NOT EXISTS idx_published_workflows_pattern ON published_workflows(pattern);
CREATE INDEX IF NOT EXISTS idx_published_workflows_created_by ON published_workflows(created_by);
CREATE INDEX IF NOT EXISTS idx_published_workflows_created_at ON published_workflows(created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workflow_id ON workflow_schedules(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_enabled ON workflow_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_next_run ON workflow_schedules(next_run);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_steps_execution_id ON workflow_execution_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_steps_status ON workflow_execution_steps(status);

CREATE INDEX IF NOT EXISTS idx_workflow_results_execution_id ON workflow_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_results_workflow_id ON workflow_results(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_results_result_type ON workflow_results(result_type);

CREATE INDEX IF NOT EXISTS idx_workflow_analytics_workflow_id ON workflow_analytics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_event_type ON workflow_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_timestamp ON workflow_analytics(timestamp);

-- Create Views for Common Queries

-- Active Workflows View
-- Shows currently running workflows with their progress
CREATE VIEW IF NOT EXISTS active_workflows AS
SELECT 
    we.id as execution_id,
    we.workflow_id,
    we.workflow_name,
    we.status,
    we.progress,
    we.current_step,
    we.started_at,
    pw.pattern,
    pw.created_by as workflow_author,
    (julianday('now') - julianday(we.started_at)) * 24 * 60 * 60 as running_duration_seconds
FROM workflow_executions we
JOIN published_workflows pw ON we.workflow_id = pw.id
WHERE we.status IN ('queued', 'running')
ORDER BY we.started_at DESC;

-- Workflow Performance View
-- Shows performance metrics for published workflows
CREATE VIEW IF NOT EXISTS workflow_performance AS
SELECT 
    pw.id as workflow_id,
    pw.name as workflow_name,
    pw.pattern,
    pw.created_by,
    COUNT(we.id) as total_executions,
    COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
    ROUND(
        COUNT(CASE WHEN we.status = 'completed' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(we.id), 0), 2
    ) as success_rate,
    AVG(we.duration) as avg_duration_ms,
    MIN(we.duration) as min_duration_ms,
    MAX(we.duration) as max_duration_ms,
    MAX(we.started_at) as last_executed_at
FROM published_workflows pw
LEFT JOIN workflow_executions we ON pw.id = we.workflow_id
GROUP BY pw.id, pw.name, pw.pattern, pw.created_by;

-- Workflow Usage Trends View
-- Shows daily workflow execution trends
CREATE VIEW IF NOT EXISTS workflow_usage_trends AS
SELECT 
    DATE(we.started_at) as execution_date,
    COUNT(*) as total_executions,
    COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
    COUNT(DISTINCT we.workflow_id) as unique_workflows_executed,
    AVG(we.duration) as avg_duration_ms
FROM workflow_executions we
WHERE we.started_at >= datetime('now', '-30 days')
GROUP BY DATE(we.started_at)
ORDER BY execution_date DESC;

-- Insert Sample Workflow Templates
INSERT OR IGNORE INTO workflow_templates (id, name, description, category, difficulty, definition, tags) VALUES
('tpl_text_analysis', 'Text Analysis Pipeline', 'Complete text analysis including preprocessing, sentiment analysis, and topic modeling', 'nlp', 'intermediate', 
'{"name":"Text Analysis Pipeline","description":"Analyze text data with preprocessing, sentiment analysis, and topic modeling","steps":[{"id":"input","type":"dataset_input","name":"Load Text Dataset","description":"Load dataset containing text data","icon":"📊","color":"blue","inputs":[],"outputs":["dataset"],"config":{"dataset_id":"","columns":[]}},{"id":"preprocess","type":"text_preprocessing","name":"Text Preprocessing","description":"Clean and normalize text data","icon":"📝","color":"indigo","inputs":["dataset"],"outputs":["dataset"],"config":{"columns":["text"],"lowercase":true,"remove_punctuation":true,"remove_stopwords":true,"stem":false,"lemmatize":false}},{"id":"sentiment","type":"sentiment_analysis","name":"Sentiment Analysis","description":"Analyze sentiment of text content","icon":"😊","color":"emerald","inputs":["dataset"],"outputs":["dataset"],"config":{"text_column":"text","model":"vader","output_columns":["sentiment","confidence"]}},{"id":"topics","type":"topic_modeling","name":"Topic Modeling","description":"Discover topics in text data","icon":"🏷️","color":"cyan","inputs":["dataset"],"outputs":["dataset"],"config":{"text_column":"text","num_topics":10,"method":"lda","output_columns":["topics","topic_weights"]}},{"id":"output","type":"dataset_output","name":"Save Results","description":"Save analyzed data","icon":"💾","color":"gray","inputs":["dataset"],"outputs":[],"config":{"name":"text_analysis_results","format":"csv","description":"Text analysis results with sentiment and topics"}}],"connections":[{"id":"conn1","from":"input","fromPort":0,"to":"preprocess","toPort":0},{"id":"conn2","from":"preprocess","fromPort":0,"to":"sentiment","toPort":0},{"id":"conn3","from":"sentiment","fromPort":0,"to":"topics","toPort":0},{"id":"conn4","from":"topics","fromPort":0,"to":"output","toPort":0}]}',
'["nlp", "sentiment", "topics", "preprocessing"]'),

('tpl_data_cleaning', 'Data Cleaning Pipeline', 'Standard data cleaning workflow with duplicate removal and missing value handling', 'data-cleaning', 'beginner',
'{"name":"Data Cleaning Pipeline","description":"Clean dataset by removing duplicates and handling missing values","steps":[{"id":"input","type":"dataset_input","name":"Load Dataset","description":"Load dataset for cleaning","icon":"📊","color":"blue","inputs":[],"outputs":["dataset"],"config":{"dataset_id":"","columns":[]}},{"id":"duplicates","type":"remove_duplicates","name":"Remove Duplicates","description":"Remove duplicate records","icon":"🧹","color":"green","inputs":["dataset"],"outputs":["dataset"],"config":{"columns":[],"keep":"first"}},{"id":"missing","type":"handle_missing","name":"Handle Missing Values","description":"Fill or drop missing values","icon":"🔧","color":"yellow","inputs":["dataset"],"outputs":["dataset"],"config":{"strategy":"drop","columns":[],"fill_value":""}},{"id":"output","type":"dataset_output","name":"Save Clean Data","description":"Save cleaned dataset","icon":"💾","color":"gray","inputs":["dataset"],"outputs":[],"config":{"name":"cleaned_data","format":"csv","description":"Cleaned dataset"}}],"connections":[{"id":"conn1","from":"input","fromPort":0,"to":"duplicates","toPort":0},{"id":"conn2","from":"duplicates","fromPort":0,"to":"missing","toPort":0},{"id":"conn3","from":"missing","fromPort":0,"to":"output","toPort":0}]}',
'["data-cleaning", "preprocessing", "duplicates", "missing-values"]'),

('tpl_engagement_analysis', 'Social Media Engagement Analysis', 'Analyze social media engagement patterns and content performance', 'analytics', 'intermediate',
'{"name":"Social Media Engagement Analysis","description":"Analyze engagement patterns and content performance across social platforms","steps":[{"id":"input","type":"dataset_input","name":"Load Social Data","description":"Load social media posts dataset","icon":"📊","color":"blue","inputs":[],"outputs":["dataset"],"config":{"dataset_id":"social_posts","columns":[]}},{"id":"engagement","type":"engagement_analysis","name":"Calculate Engagement","description":"Calculate engagement metrics","icon":"📈","color":"emerald","inputs":["dataset"],"outputs":["dataset"],"config":{"metrics":["likes","shares","comments","reach"],"time_windows":["daily","weekly"]}},{"id":"clustering","type":"clustering","name":"Content Clustering","description":"Group similar content","icon":"🎯","color":"rose","inputs":["dataset"],"outputs":["dataset"],"config":{"features":["engagement_rate","content_type"],"algorithm":"kmeans","n_clusters":5,"output_column":"content_cluster"}},{"id":"output","type":"dataset_output","name":"Save Analysis","description":"Save engagement analysis results","icon":"💾","color":"gray","inputs":["dataset"],"outputs":[],"config":{"name":"engagement_analysis","format":"csv","description":"Social media engagement analysis results"}}],"connections":[{"id":"conn1","from":"input","fromPort":0,"to":"engagement","toPort":0},{"id":"conn2","from":"engagement","fromPort":0,"to":"clustering","toPort":0},{"id":"conn3","from":"clustering","fromPort":0,"to":"output","toPort":0}]}',
'["social-media", "engagement", "analytics", "clustering"]');

-- Insert Sample Usage Analytics
INSERT OR IGNORE INTO workflow_analytics (id, workflow_id, event_type, event_data, timestamp) VALUES
('analytics_1', 'tpl_text_analysis', 'template_viewed', '{"source": "template_gallery"}', datetime('now', '-5 days')),
('analytics_2', 'tpl_data_cleaning', 'template_viewed', '{"source": "template_gallery"}', datetime('now', '-3 days')),
('analytics_3', 'tpl_engagement_analysis', 'template_viewed', '{"source": "template_gallery"}', datetime('now', '-1 day'));