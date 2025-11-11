// Database Type Definitions
// Common interfaces for database operations across all services

/**
 * Generic filter options for queries
 */
export interface FilterOptions {
  platform?: string;
  sentiment?: string;
  timeRange?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Sentiment Analysis Types
 */
export interface SentimentStats {
  positive: {
    count: number;
    percentage: number;
    confidence: number;
  };
  negative: {
    count: number;
    percentage: number;
    confidence: number;
  };
  neutral: {
    count: number;
    percentage: number;
    confidence: number;
  };
  total: number;
  avgConfidence: number;
}

export interface SentimentCategory {
  label: string;
  count: number;
  color: string;
  percentage: number;
}

export interface EmotionStat {
  emotion: string;
  count: number;
  percentage: number;
  color: string;
}

export interface SentimentTrend {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  total?: number;
}

export interface SentimentPost {
  id: string | number;
  text: string;
  sentiment: string;
  confidence: number;
  emotions?: string[];
  platform: string;
  timestamp: string;
  engagement?: {
    likes: number;
    shares: number;
    comments: number;
  };
  author?: string;
}

export interface PlatformPerformance {
  platform: string;
  totalPosts: number;
  avgConfidence: number;
  positiveRatio: number;
}

export interface SentimentKeyword {
  keyword: string;
  sentiment: string;
  frequency: number;
  impact: number;
}

export interface EmotionCorrelation {
  emotion1: string;
  emotion2: string;
  correlation: number;
  coOccurrence: number;
}

/**
 * Dashboard Types
 */
export interface DashboardStats {
  total_posts: number;
  processing_rate: number;
  data_quality: number;
  total_sources: number;
  active_crawlers: number;
  last_updated: string;
}

export interface DataSource {
  name: string;
  posts: number;
  percentage: number;
  status: 'active' | 'inactive' | 'error';
  last_sync: string;
  health: number;
}

export interface TopLanguage {
  language: string;
  count: number;
  percentage: number;
}

export interface TopTopic {
  topic: string;
  posts: number;
  trend: 'up' | 'down' | 'stable';
}

export interface CrawlingActivity {
  time: string;
  posts: number;
}

export interface RecentActivity {
  id: string | number;
  type: string;
  message: string;
  timestamp: string;
  status: string;
}

/**
 * Topic Modeling Types
 */
export interface Topic {
  id: string | number;
  name: string;
  description?: string;
  category?: string;
  categoryColor?: string;
  size: number;
  weight: number;
  coherenceScore: number;
  topWords: string[];
  keywords?: string[];
  color?: string;
  documentCount?: number;
  created_at?: string;
}

export interface TopicKeyword {
  topic_id: string | number;
  keyword: string;
  weight: number;
  rank_position: number;
}

export interface TopicTrend {
  topic_id: string | number;
  analysis_date: string;
  document_count: number;
  average_engagement: number;
  growth_rate: number;
  trend_direction: 'up' | 'down' | 'stable';
}

export interface TopicRelationship {
  topic1_id: string | number;
  topic2_id: string | number;
  similarity_score: number;
  relationship_type: string;
  strength: number;
}

export interface TopicCategory {
  category: string;
  category_color: string;
  topic_count: number;
  total_size: number;
  avg_coherence: number;
}

/**
 * Engagement Analysis Types
 */
export interface EngagementMetrics {
  total_engagements: number;
  avg_likes: number;
  avg_shares: number;
  avg_comments: number;
  engagement_rate: number;
}

export interface PostEngagement {
  post_id: string | number;
  likes_count: number;
  shares_count: number;
  comments_count: number;
  total_engagement: number;
  engagement_score: number;
  virality_score?: number;
}

export interface DailyEngagement {
  date: string;
  total_posts: number;
  total_engagement: number;
  avg_engagement: number;
}

export interface HashtagEngagement {
  hashtag: string;
  usage_count: number;
  total_engagement: number;
  avg_engagement: number;
}

/**
 * Language Detection Types
 */
export interface LanguageStats {
  language: string;
  language_code: string;
  post_count: number;
  percentage: number;
  confidence: number;
}

export interface LanguageTrend {
  date: string;
  language: string;
  post_count: number;
}

export interface LanguageMixing {
  primary_language: string;
  secondary_language: string;
  occurrence_count: number;
  percentage: number;
}

/**
 * Android Analytics Types
 */
export interface AndroidAnalyticsSummary {
  totalSessions: number;
  totalScreenshots: number;
  uniqueApps: number;
  sessionDuration: number;
  totalEvents: number;
  activeUsers: number;
}

export interface AppUsage {
  app_name: string;
  package_name?: string;
  usage_time: number;
  session_count: number;
  last_used: string;
}

export interface ScreenData {
  screen_id: string | number;
  timestamp: string;
  screen_text: string[];
  app_context: string;
  user_interaction?: string;
}

/**
 * Crawler Types
 */
export interface CrawlerJob {
  id: string;
  name: string;
  platform: 'telegram' | 'youtube';
  urls: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface CrawlerConfig {
  jobName: string;
  platform: 'telegram' | 'youtube';
  urls: string[];
  maxPosts?: number;
  concurrency?: number;
  skipMedia?: boolean;
  timeAgo?: string;
  youtubeApiKey?: string;
  samplingMethod?: 'channel' | 'random';
  minChannelVideos?: number;
  sampleSize?: number;
}

/**
 * Export Data Types
 */
export interface ExportData<T = any> {
  exportDate: string;
  filters: FilterOptions;
  data: T[];
  summary?: any;
  metadata?: Record<string, any>;
}

/**
 * Pagination Types
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

/**
 * Error Types
 */
export interface DatabaseError {
  code: string;
  message: string;
  details?: string;
  timestamp: string;
}

/**
 * Time Series Types
 */
export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface TimeSeriesData {
  series: string;
  data: TimeSeriesDataPoint[];
}

/**
 * Aggregation Types
 */
export interface AggregationResult {
  key: string;
  count: number;
  sum?: number;
  avg?: number;
  min?: number;
  max?: number;
}

/**
 * Type Guards
 */
export function isSentimentPost(obj: any): obj is SentimentPost {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'text' in obj &&
    'sentiment' in obj &&
    'confidence' in obj
  );
}

export function isTopic(obj: any): obj is Topic {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'size' in obj &&
    'weight' in obj
  );
}

/**
 * Utility Types
 */
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
