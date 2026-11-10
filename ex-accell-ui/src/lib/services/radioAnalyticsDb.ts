// Database connection and query service for Radio Analytics data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { BaseDatabaseService } from './baseDatabaseService';
import { CHART } from '$lib/utils/chartColors';
import type {
  RadioOverviewStats,
  StationStats,
  RadioTranscript,
  PoliticalStats,
  WordFrequency,
  RadioTopic,
  SentimentCategory,
  SentimentTrend,
  FilterOptions
} from './types/databaseTypes';

/**
 * Radio Analytics Database Service
 * Provides radio transcript analytics data from PostgreSQL with pg_duckdb extension
 */
class RadioAnalyticsDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'RadioAnalytics',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  /**
   * Get overview statistics for radio transcripts
   */
  async getOverviewStats(workspaceId?: string, extraParams?: Record<string, string>): Promise<RadioOverviewStats> {
    const data = await this.queryAPI<any>({
      endpoint: 'radio-overview',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    if (!data || data.length === 0) {
      return {
        totalTranscripts: 0,
        totalHours: 0,
        stationCount: 0,
        avgDuration: 0,
        politicalPercent: 0,
        adPercent: 0
      };
    }

    const row = data[0];
    const totalTranscripts = row.total_transcripts || 0;
    return {
      totalTranscripts,
      totalHours: Math.round(((row.total_seconds || 0) / 3600) * 100) / 100,
      stationCount: row.station_count || 0,
      avgDuration: Math.round((row.avg_duration || 0) * 100) / 100,
      politicalPercent: totalTranscripts > 0
        ? Math.round(((row.political_count || 0) / totalTranscripts * 100) * 100) / 100
        : 0,
      adPercent: totalTranscripts > 0
        ? Math.round(((row.ad_count || 0) / totalTranscripts * 100) * 100) / 100
        : 0
    };
  }

  /**
   * Get sentiment breakdown for radio transcripts
   */
  async getSentimentBreakdown(workspaceId?: string, extraParams?: Record<string, string>): Promise<SentimentCategory[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'radio-sentiment',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    const sentimentColors: Record<string, string> = {
      positive: CHART.catGreen,
      negative: CHART.danger500,
      neutral: CHART.ink500,
      mixed: CHART.catOrange
    };

    const total = data.reduce((sum: number, row: any) => sum + (row.post_count || 0), 0);

    return this.safeTransform(
      data,
      (row) => ({
        label: row.sentiment_category || 'unknown',
        count: row.post_count || 0,
        color: sentimentColors[row.sentiment_category?.toLowerCase()] || CHART.ink500,
        percentage: total > 0 ? Math.round(((row.post_count || 0) / total * 100) * 100) / 100 : 0
      }),
      []
    );
  }

  /**
   * Get breakdown by radio station
   */
  async getStationBreakdown(workspaceId?: string, extraParams?: Record<string, string>): Promise<StationStats[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'radio-by-station',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (row) => ({
        radioName: row.radio_name || 'Unknown',
        state: row.state || 'Unknown',
        transcriptCount: row.transcript_count || 0,
        totalHours: Math.round(((row.total_seconds || 0) / 3600) * 100) / 100,
        positiveCount: row.positive_count || 0,
        negativeCount: row.negative_count || 0,
        neutralCount: row.neutral_count || 0,
        politicalCount: row.political_count || 0
      }),
      []
    );
  }

  /**
   * Get sentiment trends over time
   */
  async getSentimentTrends(timeRange: string = '30d', workspaceId?: string, extraParams?: Record<string, string>): Promise<SentimentTrend[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'radio-trends',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), timeRange, ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (item) => ({
        date: item.date,
        positive: item.positive || 0,
        negative: item.negative || 0,
        neutral: item.neutral || 0,
        total: item.total || 0
      }),
      []
    ).reverse(); // Reverse to get chronological order
  }

  /**
   * Get top topics from radio transcripts
   */
  async getTopTopics(workspaceId?: string, extraParams?: Record<string, string>): Promise<RadioTopic[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'radio-topics',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (row) => ({
        topic: row.topic || 'Unknown',
        count: row.count || 0,
        avgRelevance: Math.round((row.avg_relevance || 0) * 100) / 100
      }),
      []
    );
  }

  /**
   * Get political content breakdown
   */
  async getPoliticalBreakdown(workspaceId?: string, extraParams?: Record<string, string>): Promise<PoliticalStats[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'radio-political',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    const total = data.reduce((sum: number, row: any) => sum + (row.count || 0), 0);

    return this.safeTransform(
      data,
      (row) => ({
        category: row.category || 'unknown',
        count: row.count || 0,
        percentage: total > 0 ? Math.round(((row.count || 0) / total * 100) * 100) / 100 : 0
      }),
      []
    );
  }

  /**
   * Get radio transcripts with optional filtering
   */
  async getTranscripts(filters: FilterOptions = {}, workspaceId?: string): Promise<RadioTranscript[]> {
    const params: Record<string, any> = {
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      limit: filters.limit || 50,
      offset: filters.offset || 0
    };

    if (filters.search) {
      params.search = filters.search;
    }

    if (filters.category === 'political') {
      params.political = 'true';
    } else if (filters.category === 'apolitical') {
      params.political = 'false';
    }

    const data = await this.queryAPI<any>({
      endpoint: 'radio-transcripts',
      params
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (row) => ({
        id: row.id,
        radioName: row.radio_name || 'Unknown',
        state: row.state || 'Unknown',
        segmentStart: row.segment_start || '',
        segmentEnd: row.segment_end || '',
        durationSeconds: row.duration_seconds || 0,
        transcript: row.transcript || '',
        isPolitical: row.is_political || false,
        isAd: row.is_ad || false,
        sentiment: row.sentiment || 'unknown',
        emotion: row.emotion || '',
        confidence: row.confidence || 0,
        wordCount: row.word_count || 0,
        topics: Array.isArray(row.topics) ? row.topics : []
      }),
      []
    );
  }

  /**
   * Get word frequencies for word cloud visualization
   */
  async getWordFrequencies(workspaceId?: string, extraParams?: Record<string, string>): Promise<WordFrequency[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'radio-wordcloud',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (row) => ({
        word: row.word || '',
        count: row.count || 0
      }),
      []
    );
  }
}

export const radioAnalyticsDb = new RadioAnalyticsDatabase();
