// Database connection and query service for Language Detection data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { BaseDatabaseService } from './baseDatabaseService';
import type {
  LanguageStats,
  LanguageTrend,
  LanguageMixing,
  FilterOptions,
  ExportData
} from './types/databaseTypes';

interface LanguageAnalysis {
  code: string;
  name: string;
  native_name: string;
  totalDetections: number;
  veryHighConfidence: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  avgConfidence: number;
  confidenceStddev: number;
}

interface LanguagePost {
  id: string | number;
  text: string;
  language: string;
  language_name: string;
  confidence: number;
  timestamp: string;
  platform: string;
  secondary_language: string | null;
  secondary_confidence: number | null;
}

interface GeographicDistribution {
  language_name: string;
  country_code: string;
  region: string;
  post_count: number;
  percentage: number;
  country_rank: number;
}

interface LanguageDetectionStats {
  totalPosts: number;
  totalLanguages: number;
  avgConfidence: number;
  topLanguage: { name: string };
  confidenceDistribution: {
    veryHigh: number;
    high: number;
    medium: number;
    low: number;
  };
  lastUpdated: string;
}

/** The API returns numeric columns as strings. */
const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round = (value: number, places: number): number => Number(value.toFixed(places));

/** The database returns naive UTC timestamps like '2026-10-07 08:30:00'. */
const toIsoString = (value: unknown): string => {
  const text = String(value);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text.replace(' ', 'T')}Z`).toISOString();
};

/**
 * Language Detection Database Service
 * Provides language detection and analysis data from PostgreSQL with pg_duckdb extension
 */
class LanguageDetectionDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'LanguageDetection',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  /**
   * Get language statistics and distribution
   */
  async getLanguageStats(workspaceId?: string): Promise<LanguageStats[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'language-stats',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    const totalPosts = data.reduce((sum: number, item: any) => sum + (item.post_count || 0), 0);

    return data.map((lang: any) => ({
      language: lang.language,
      language_code: lang.language_code,
      post_count: lang.post_count || 0,
      percentage: totalPosts > 0 ? Math.round((lang.post_count / totalPosts * 100) * 100) / 100 : 0,
      confidence: Math.round((lang.confidence || 0) * 100) / 100
    }));
  }

  /**
   * Get detailed language analysis with confidence breakdown
   */
  async getLanguageAnalysis(workspaceId?: string): Promise<LanguageAnalysis[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'language-stats',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    const nativeNames: Record<string, string> = {
      'en': 'English', 'es': 'Español', 'fr': 'Français', 'de': 'Deutsch',
      'it': 'Italiano', 'cy': 'Cymraeg', 'pt': 'Português', 'nl': 'Nederlands',
      'ru': 'Русский', 'ar': 'العربية', 'zh': '中文', 'ja': '日本語'
    };

    return data.map((item: any) => ({
      code: item.language_code,
      name: item.language,
      native_name: nativeNames[item.language_code] || item.language,
      totalDetections: toNumber(item.post_count),
      veryHighConfidence: toNumber(item.very_high_count),
      highConfidence: toNumber(item.high_count),
      mediumConfidence: toNumber(item.medium_count),
      lowConfidence: toNumber(item.low_count),
      avgConfidence: round(toNumber(item.confidence), 2),
      confidenceStddev: round(toNumber(item.confidence_stddev), 2)
    }));
  }

  /**
   * Get language trends over time
   */
  async getLanguageTrends(timeRange: string = '7d', workspaceId?: string): Promise<LanguageTrend[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'language-trends',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((item: any) => ({
      date: item.analysis_date,
      language: item.language_code,
      post_count: item.document_count || 0
    }));
  }

  /**
   * Get posts with the language detected for each
   */
  async getSamplePosts(filters: FilterOptions = {}, workspaceId?: string): Promise<LanguagePost[]> {
    const f = filters as any;
    const data = await this.queryAPI<any>({
      endpoint: 'language-posts',
      params: {
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
        platform: f.platform || 'all',
        language: f.language || 'all',
        ...(typeof f.confidenceThreshold === 'number' ? { minConfidence: f.confidenceThreshold } : {}),
        limit: String(f.limit || 50)
      }
    });

    return data.map((row: any) => ({
      id: row.id,
      text: row.text,
      language: row.language_code,
      language_name: row.language_name,
      confidence: round(toNumber(row.confidence), 2),
      timestamp: toIsoString(row.timestamp),
      platform: row.platform,
      secondary_language: row.secondary_language ?? null,
      secondary_confidence: row.secondary_language ? round(toNumber(row.secondary_confidence), 2) : null
    }));
  }

  /**
   * Get language mixing (code-switching) pairs, with each pair's share of all mixed posts
   */
  async getLanguageMixing(workspaceId?: string): Promise<LanguageMixing[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'language-mixing',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });
    const total = data.reduce((sum: number, row: any) => sum + toNumber(row.occurrence_count), 0);

    return data.map((row: any) => ({
      primary_language: row.primary_language,
      secondary_language: row.secondary_language,
      occurrence_count: toNumber(row.occurrence_count),
      percentage: total > 0 ? round((toNumber(row.occurrence_count) / total) * 100, 2) : 0
    }));
  }

  /**
   * Geographic distribution is not available: posts carry no location data, so there is nothing
   * truthful to report. Returns an empty list rather than inventing one.
   */
  async getGeographicDistribution(_workspaceId?: string): Promise<GeographicDistribution[]> {
    return [];
  }

  /**
   * Get overall language detection statistics, aggregated from the per-language stats
   */
  async getLanguageDetectionStats(workspaceId?: string): Promise<LanguageDetectionStats> {
    const data = await this.queryAPI<any>({
      endpoint: 'language-stats',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });
    if (data.length === 0) return this.getDefaultDetectionStats();

    const sum = (key: string) => data.reduce((total: number, row: any) => total + toNumber(row[key]), 0);
    const totalPosts = sum('post_count');
    const weightedConfidence = data.reduce((total: number, row: any) => total + toNumber(row.confidence) * toNumber(row.post_count), 0);
    const top = data.reduce((best: any, row: any) => (toNumber(row.post_count) > toNumber(best.post_count) ? row : best), data[0]);

    return {
      totalPosts,
      totalLanguages: data.length,
      avgConfidence: totalPosts > 0 ? round(weightedConfidence / totalPosts, 2) : 0,
      topLanguage: { name: top.language },
      confidenceDistribution: {
        veryHigh: sum('very_high_count'),
        high: sum('high_count'),
        medium: sum('medium_count'),
        low: sum('low_count')
      },
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Export language detection data
   */
  async exportLanguageData(filters: FilterOptions = {}, workspaceId?: string): Promise<ExportData<LanguagePost>> {
    const [posts, languageStats, mixing, geographic, trends, stats] = await Promise.all([
      this.getSamplePosts(filters, workspaceId),
      this.getLanguageStats(workspaceId),
      this.getLanguageMixing(workspaceId),
      this.getGeographicDistribution(workspaceId),
      this.getLanguageTrends(filters.timeRange || '7d', workspaceId),
      this.getLanguageDetectionStats(workspaceId)
    ]);

    return {
      exportDate: new Date().toISOString(),
      filters,
      data: posts.map(post => ({
        ...post,
        post_id: post.id,
        user_id: `user_${post.id}`
      })) as any,
      summary: {
        stats,
        languages: languageStats,
        trends,
        mixing,
        geographic
      }
    };
  }

  // ========== Private Helper Methods ==========

  /**
   * Get default detection statistics
   */
  private getDefaultDetectionStats(): LanguageDetectionStats {
    return {
      totalPosts: 0,
      totalLanguages: 0,
      avgConfidence: 0,
      topLanguage: { name: 'English' },
      confidenceDistribution: { veryHigh: 0, high: 0, medium: 0, low: 0 },
      lastUpdated: new Date().toISOString()
    };
  }
}

export const languageDetectionDb = new LanguageDetectionDatabase();
