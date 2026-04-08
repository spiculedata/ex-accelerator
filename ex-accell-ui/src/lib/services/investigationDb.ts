// Database connection and query service for Investigation data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { BaseDatabaseService } from './baseDatabaseService';

export interface Investigation {
  id: number;
  name: string;
  description: string | null;
  query_config: Record<string, any>;
  layout_config: Record<string, any>;
  pinned_views: any[];
  annotations: any[];
  created_by: string | null;
  workspace_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface TimelineEntry {
  date: string;
  gdelt_events: number;
  avg_goldstein: number | null;
  avg_tone: number | null;
  radio_segments: number;
  radio_positive: number;
  radio_negative: number;
  radio_neutral: number;
  social_posts: number;
  social_positive: number;
  social_negative: number;
  social_neutral: number;
}

export interface GdeltEvent {
  globaleventid: string;
  sqldate: number;
  actor1name: string;
  actor2name: string;
  eventcode: string;
  goldsteinscale: number;
  nummentions: number;
  avgtone: number;
  actor1countrycode: string;
  actor2countrycode: string;
  actiongeo_fullname: string;
  actiongeo_lat: number;
  actiongeo_long: number;
  sourceurl: string;
}

export interface RadioSegment {
  id: number;
  station: string;
  segment_start: string;
  segment_end: string;
  duration_seconds: number;
  transcript: string;
  sentiment: string;
  topics: string[];
  relevance_score: number;
}

export interface SocialPost {
  id: string;
  text: string;
  timestamp: number;
  platform: string;
  author: string;
  sentiment_score: number;
  sentiment_category: string;
  engagement_score: number;
  hashtags: string[];
}

export interface KeywordOverlap {
  keyword: string;
  source: string;
  mention_count: number;
}

interface InvestigationQueryParams {
  keywords: string;
  date_start: string;
  date_end: string;
  limit?: number;
}

/**
 * Investigation Database Service
 * Provides investigation data from PostgreSQL with pg_duckdb extension
 * and CRUD operations for investigation configurations
 */
class InvestigationDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'Investigation',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  // ── Analytics query methods ───────────────────────────────────────

  /**
   * Get multi-source timeline data for an investigation
   */
  async getTimeline(params: InvestigationQueryParams): Promise<TimelineEntry[]> {
    const data = await this.queryAPI<TimelineEntry>({
      endpoint: 'investigation-timeline',
      params: {
        keywords: params.keywords,
        date_start: params.date_start,
        date_end: params.date_end
      }
    });

    return data || [];
  }

  /**
   * Get GDELT events matching investigation keywords
   */
  async getGdeltEvents(params: InvestigationQueryParams): Promise<GdeltEvent[]> {
    const data = await this.queryAPI<GdeltEvent>({
      endpoint: 'investigation-gdelt-events',
      params: {
        keywords: params.keywords,
        date_start: params.date_start,
        date_end: params.date_end,
        limit: params.limit?.toString() || '100'
      }
    });

    return data || [];
  }

  /**
   * Get radio transcript segments matching investigation keywords
   */
  async getRadioSegments(params: InvestigationQueryParams): Promise<RadioSegment[]> {
    const data = await this.queryAPI<RadioSegment>({
      endpoint: 'investigation-radio-segments',
      params: {
        keywords: params.keywords,
        date_start: params.date_start,
        date_end: params.date_end,
        limit: params.limit?.toString() || '50'
      }
    });

    return data || [];
  }

  /**
   * Get social media posts matching investigation keywords
   */
  async getSocialPosts(params: InvestigationQueryParams): Promise<SocialPost[]> {
    const data = await this.queryAPI<SocialPost>({
      endpoint: 'investigation-social-posts',
      params: {
        keywords: params.keywords,
        date_start: params.date_start,
        date_end: params.date_end,
        limit: params.limit?.toString() || '100'
      }
    });

    return data || [];
  }

  /**
   * Get keyword/entity overlap across sources
   */
  async getKeywordOverlap(params: InvestigationQueryParams): Promise<KeywordOverlap[]> {
    const data = await this.queryAPI<KeywordOverlap>({
      endpoint: 'investigation-keyword-overlap',
      params: {
        keywords: params.keywords,
        date_start: params.date_start,
        date_end: params.date_end
      }
    });

    return data || [];
  }

  // ── CRUD methods for investigation configurations ─────────────────

  /**
   * List all investigations, optionally filtered by workspace
   */
  async list(workspaceId?: number): Promise<Investigation[]> {
    const params = new URLSearchParams();
    if (workspaceId !== undefined) {
      params.set('workspace_id', workspaceId.toString());
    }

    const response = await fetch(`/api/investigations?${params.toString()}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to list investigations');
    }

    return result.investigations || [];
  }

  /**
   * Get a single investigation by ID
   */
  async get(id: number): Promise<Investigation> {
    const response = await fetch(`/api/investigations?id=${id}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Investigation not found');
    }

    return result.investigation;
  }

  /**
   * Create a new investigation
   */
  async create(data: {
    name: string;
    description?: string;
    query_config: Record<string, any>;
    workspace_id?: number;
    created_by?: string;
  }): Promise<Investigation> {
    const response = await fetch('/api/investigations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to create investigation');
    }

    return result.investigation;
  }

  /**
   * Update an existing investigation
   */
  async update(data: {
    id: number;
    name?: string;
    description?: string;
    query_config?: Record<string, any>;
    layout_config?: Record<string, any>;
    pinned_views?: any[];
    annotations?: any[];
  }): Promise<Investigation> {
    const response = await fetch('/api/investigations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to update investigation');
    }

    return result.investigation;
  }

  /**
   * Delete an investigation by ID
   */
  async delete(id: number): Promise<boolean> {
    const response = await fetch(`/api/investigations?id=${id}`, {
      method: 'DELETE'
    });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete investigation');
    }

    return true;
  }
}

export const investigationDb = new InvestigationDatabase();
