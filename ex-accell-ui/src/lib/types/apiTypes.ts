/**
 * API Response Types
 *
 * Standardized type definitions for all API endpoints to ensure
 * consistent response formats across the application.
 *
 * All endpoints should return ApiResponse<T> format:
 * {
 *   success: boolean,
 *   data?: T,
 *   error?: string,
 *   meta?: { timestamp, requestId, pagination }
 * }
 */

// ===================================================================
// Base Response Types
// ===================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: ResponseMeta;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  timestamp?: string;
  requestId?: string;
  pagination?: PaginationMeta;
  [key: string]: any; // Allow additional metadata
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

/**
 * Error response (when success = false)
 */
export interface ErrorResponse {
  success: false;
  error: string;
  details?: Record<string, any>;
  code?: string;
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

// ===================================================================
// Entity Types
// ===================================================================

/**
 * Project entity
 */
export interface Project {
  id: number;
  name: string;
  description: string;
  project_type: string;
  status: 'active' | 'archived' | 'completed';
  created_by: string;
  created_at: string;
  updated_at: string;
  settings?: Record<string, any>;
  workspace_count?: number;
  member_count?: number;
  total_data_sources?: number;
}

/**
 * Workspace entity
 */
export interface Workspace {
  id: number;
  project_id: number;
  name: string;
  description: string;
  workspace_type: 'general' | 'analysis' | 'exploration' | 'reporting';
  status: 'active' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
  settings?: Record<string, any>;
  data_source_count?: number;
  member_count?: number;
  total_records?: number;
  project_name?: string;
}

/**
 * Dataset entity
 */
export interface Dataset {
  id: number;
  name: string;
  description: string;
  dataset_type: string;
  source_platform: string;
  source_database: string;
  schema_name: string;
  table_name: string;
  record_count: number;
  date_range_start: string;
  date_range_end: string;
  last_updated: string;
  crawl_id?: string;
  ingestion_method: string;
  metadata?: Record<string, any>;
  status: 'available' | 'processing' | 'archived' | 'error';
  visibility: 'private' | 'public' | 'restricted';
  created_by: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  permission_count?: number;
  workspace_count?: number;
}

/**
 * Dataset summary for workspace
 */
export interface DatasetSummary {
  total_records: number;
  dataset_types: string[];
  platforms: string[];
  date_range_start: string;
  date_range_end: string;
  last_updated: string;
}

/**
 * Job state entity
 */
export interface JobState {
  name: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  schedule?: string;
  data?: Record<string, any>;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  progress?: number;
  logs?: string[];
}

/**
 * Workflow entity
 */
export interface Workflow {
  id: number;
  name: string;
  description: string;
  workflow_type: 'python' | 'dapr' | 'hybrid';
  status: 'draft' | 'published' | 'archived';
  steps: WorkflowStep[];
  connections: WorkflowConnection[];
  created_by: string;
  created_at: string;
  updated_at: string;
  settings?: Record<string, any>;
}

/**
 * Workflow step
 */
export interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

/**
 * Workflow connection
 */
export interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
}

/**
 * Workflow execution
 */
export interface WorkflowExecution {
  id: number;
  workflow_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  error?: string;
  logs?: string[];
  result?: Record<string, any>;
}

// ===================================================================
// Specific Response Types
// ===================================================================

/**
 * Projects API responses
 */
export interface ProjectsResponse extends ApiResponse {
  data: {
    projects: Project[];
  };
}

export interface ProjectResponse extends ApiResponse {
  data: {
    project: Project;
  };
}

/**
 * Workspaces API responses
 */
export interface WorkspacesResponse extends ApiResponse {
  data: {
    workspaces: Workspace[];
  };
}

export interface WorkspaceResponse extends ApiResponse {
  data: {
    workspace: Workspace;
  };
}

export interface WorkspaceDatasetSummaryResponse extends ApiResponse {
  data: {
    summary: DatasetSummary;
  };
}

/**
 * Datasets API responses
 */
export interface DatasetsResponse extends ApiResponse {
  data: {
    datasets: Dataset[];
  };
}

export interface DatasetResponse extends ApiResponse {
  data: {
    dataset: Dataset;
  };
}

/**
 * Jobs API responses
 */
export interface JobsResponse extends ApiResponse {
  data: {
    jobs: JobState[];
  };
}

export interface JobResponse extends ApiResponse {
  data: {
    job: JobState;
  };
}

/**
 * Workflows API responses
 */
export interface WorkflowsResponse extends ApiResponse {
  data: {
    workflows: Workflow[];
  };
}

export interface WorkflowResponse extends ApiResponse {
  data: {
    workflow: Workflow;
  };
}

export interface WorkflowExecutionsResponse extends ApiResponse {
  data: {
    executions: WorkflowExecution[];
  };
}

export interface WorkflowExecutionResponse extends ApiResponse {
  data: {
    execution: WorkflowExecution;
  };
}

// ===================================================================
// Analytics Response Types
// ===================================================================

/**
 * Sentiment analysis data
 */
export interface SentimentData {
  platform: string;
  sentiment: string;
  post_count: number;
  avg_confidence: number;
  percentage: number;
}

export interface SentimentResponse extends ApiResponse {
  data: {
    sentiments: SentimentData[];
    summary?: {
      total_posts: number;
      positive_percentage: number;
      negative_percentage: number;
      neutral_percentage: number;
    };
  };
}

/**
 * Topic modeling data
 */
export interface TopicData {
  topic_id: number;
  topic_name: string;
  keywords: string[];
  document_count: number;
  coherence_score?: number;
}

export interface TopicResponse extends ApiResponse {
  data: {
    topics: TopicData[];
    summary?: {
      total_topics: number;
      total_documents: number;
    };
  };
}

/**
 * Language detection data
 */
export interface LanguageData {
  language: string;
  language_name: string;
  post_count: number;
  percentage: number;
}

export interface LanguageResponse extends ApiResponse {
  data: {
    languages: LanguageData[];
    summary?: {
      total_posts: number;
      language_count: number;
    };
  };
}

/**
 * Engagement analysis data
 */
export interface EngagementData {
  platform: string;
  content_type: string;
  avg_likes: number;
  avg_shares: number;
  avg_comments: number;
  total_posts: number;
  engagement_rate: number;
}

export interface EngagementResponse extends ApiResponse {
  data: {
    engagement: EngagementData[];
    summary?: {
      total_posts: number;
      avg_engagement_rate: number;
    };
  };
}

/**
 * GDELT event data
 */
export interface GdeltEvent {
  globaleventid: number;
  event_date: string;
  actor1name: string;
  actor2name: string;
  eventcode: string;
  goldsteinscale: number;
  avgtone: number;
  actiongeo_lat: number;
  actiongeo_long: number;
  actiongeo_countrycode: string;
  sourceurl: string;
}

export interface GdeltResponse extends ApiResponse {
  data: {
    events: GdeltEvent[];
    summary?: {
      total_events: number;
      date_range: { start: string; end: string };
    };
  };
}

/**
 * Android analytics data
 */
export interface AndroidAnalyticsData {
  device_id: string;
  metric_type: string;
  metric_value: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AndroidAnalyticsResponse extends ApiResponse {
  data: {
    metrics: AndroidAnalyticsData[];
    summary?: {
      total_devices: number;
      date_range: { start: string; end: string };
    };
  };
}

// ===================================================================
// Utility Types
// ===================================================================

/**
 * Generic list response with pagination
 */
export interface ListResponse<T> extends ApiResponse {
  data: {
    items: T[];
    pagination: PaginationMeta;
  };
}

/**
 * Generic single item response
 */
export interface ItemResponse<T> extends ApiResponse {
  data: {
    item: T;
  };
}

/**
 * Success message response
 */
export interface MessageResponse extends ApiResponse {
  data: {
    message: string;
  };
}

/**
 * Health check response
 */
export interface HealthResponse extends ApiResponse {
  data: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    }>;
    timestamp: string;
  };
}
