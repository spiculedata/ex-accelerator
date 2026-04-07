// Database connection and query service for Android Research data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { BaseDatabaseService } from './baseDatabaseService';

interface TemporalUsagePattern {
  hour: number;
  apps: Array<{
    app: string;
    hour: number;
    usage: number;
    sessions: number;
    avgDuration: number;
  }>;
  totalUsage: number;
}

interface AppTransition {
  source: string;
  target: string;
  value: number;
  avgTime?: number;
}

interface AttentionSpan {
  app: string;
  meanDuration: number;
  sessions: Array<{
    duration: number;
    timestamp: number;
    taskSwitches: number;
    interruptions: number;
  }>;
}

interface ContentEngagement {
  content: string;
  engagementScore: number;
  avgDuration: number;
  interactionDepth: number;
  returnRate: number;
}

interface CognitiveLoad {
  hour: number;
  taskSwitches: number;
  multitaskingIndex: number;
  attentionFragmentation: number;
  cognitiveEfficiency: number;
}

interface BehavioralMetrics {
  totalDailyUsage: number;
  peakUsageHour: number;
  avgSessionLength: number;
  appSwitchingRate: number;
  digitalWellbeingScore: number;
}

interface DigitalPhenotype {
  behaviorType: string;
  attentionProfile: string;
  usagePattern: string;
  multitaskingIndex: string;
}

interface ResearchFinding {
  title: string;
  finding: string;
  significance: string;
  implication: string;
}

interface NetworkCentrality {
  app: string;
  outDegree: number;
  inDegree: number;
  centralityScore: number;
  category: string;
}

/**
 * Android Research Database Service
 * Provides Android research and behavioral analysis data from PostgreSQL with pg_duckdb extension
 */
class AndroidResearchDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'AndroidResearch',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  /**
   * Query Android Research API specifically
   */
  private async queryAndroidResearchAPI<T = any>(endpoint: string, params: any = {}): Promise<T[]> {
    return this.queryAPI<T>({ endpoint, params });
  }

  /**
   * Get temporal usage patterns for 24-hour analysis
   * Note: Returns demo data derived from sentiment hourly patterns since no real Android tables exist.
   */
  async getTemporalUsagePatterns(): Promise<{ data: TemporalUsagePattern[]; isDemo: boolean }> {
    const results = await this.queryAPI<any>({ endpoint: 'hourly-patterns' });

    if (!results || results.length === 0) {
      return { data: this.getFallbackTemporalPatterns(), isDemo: true };
    }

    const apps = ['YouTube', 'Chrome', 'Instagram', 'WhatsApp', 'Gmail'];

    const patterns = this.safeTransform(
      results,
      (hourData) => {
        const totalActivity = (hourData.positive || 0) + (hourData.negative || 0) + (hourData.neutral || 0);
        const appUsage = apps.map((app, appIdx) => ({
          app,
          hour: hourData.hour_of_day,
          usage: Math.floor(totalActivity * (0.2 + (appIdx * 0.12))),
          sessions: Math.floor(totalActivity * 0.1),
          avgDuration: ((hourData.hour_of_day * 13 + appIdx * 47) % 300) + 30
        }));

        return {
          hour: hourData.hour_of_day,
          apps: appUsage,
          totalUsage: appUsage.reduce((sum, a) => sum + a.usage, 0)
        };
      },
      this.getFallbackTemporalPatterns()
    );

    return { data: patterns, isDemo: true };
  }

  /**
   * Get app transition network data
   * Note: Returns demo data derived from platform performance since no real Android tables exist.
   */
  async getAppTransitions(): Promise<{ data: AppTransition[]; isDemo: boolean }> {
    const results = await this.queryAPI<any>({ endpoint: 'platform-performance' });

    if (!results || results.length < 2) {
      return { data: this.getFallbackAppTransitions(), isDemo: true };
    }

    const apps = ['YouTube', 'Chrome', 'Instagram', 'WhatsApp', 'Gmail'];
    const transitions: AppTransition[] = [];

    for (let i = 0; i < apps.length - 1; i++) {
      const platformData = results[i % results.length] || { total_posts: 10 };
      transitions.push({
        source: apps[i],
        target: apps[i + 1],
        value: Math.floor(platformData.total_posts * 0.1),
        avgTime: ((i * 67) % 300) + 60
      });
    }

    return { data: transitions, isDemo: true };
  }

  /**
   * Get attention span distribution data
   */
  async getAttentionSpans(): Promise<{ data: AttentionSpan[]; isDemo: boolean }> {
    try {
      const results = await this.queryAndroidResearchAPI('attention-spans');

      if (results.length === 0) {
        return { data: this.getFallbackAttentionSpans(), isDemo: true };
      }

      // Group by app
      const appGroups: Record<string, AttentionSpan> = {};

      results.forEach((r: any) => {
        const appName = r.app_name || r.apk;
        if (!appGroups[appName]) {
          appGroups[appName] = {
            app: appName,
            meanDuration: 0,
            sessions: []
          };
        }

        appGroups[appName].sessions.push({
          duration: Math.round((r.attention_duration_ms || 0) / 1000),
          timestamp: r.attention_start_ts || Date.now(),
          taskSwitches: r.task_switches || 0,
          interruptions: r.interruption_count || 0
        });
      });

      // Calculate mean durations
      Object.values(appGroups).forEach((group) => {
        if (group.sessions.length > 0) {
          group.meanDuration = group.sessions.reduce((sum, s) => sum + s.duration, 0) / group.sessions.length;
        }
      });

      return { data: Object.values(appGroups), isDemo: false };
    } catch (error) {
      this.log('error', 'Failed to get attention spans');
      return { data: this.getFallbackAttentionSpans(), isDemo: true };
    }
  }

  /**
   * Get content engagement analysis data
   */
  async getContentEngagement(): Promise<{ data: ContentEngagement[]; isDemo: boolean }> {
    try {
      const results = await this.queryAndroidResearchAPI('content-engagement');

      if (results.length === 0) {
        return { data: this.getFallbackContentEngagement(), isDemo: true };
      }

      const engagement = this.safeTransform(
        results,
        (r) => ({
          content: r.content_category || r.content,
          engagementScore: r.engagement_score || r.avg_engagement_score || 0,
          avgDuration: Math.round((r.avg_duration_minutes || 0) * 60),
          interactionDepth: r.avg_interaction_depth || r.interaction_depth || 0,
          returnRate: r.avg_return_visits ? r.avg_return_visits / 100 : 0
        }),
        this.getFallbackContentEngagement()
      );

      return { data: engagement, isDemo: false };
    } catch (error) {
      this.log('error', 'Failed to get content engagement');
      return { data: this.getFallbackContentEngagement(), isDemo: true };
    }
  }

  /**
   * Get cognitive load indicators
   */
  async getCognitiveLoadData(): Promise<{ data: CognitiveLoad[]; isDemo: boolean }> {
    try {
      const results = await this.queryAndroidResearchAPI('cognitive-load');

      if (results.length === 0) {
        return { data: this.getFallbackCognitiveLoad(), isDemo: true };
      }

      // Group by hour
      const hourlyData = Array.from({ length: 24 }, (_, hour) => {
        const hourData = results.filter((r: any) => r.analysis_hour === hour);

        if (hourData.length === 0) {
          return {
            hour,
            taskSwitches: 0,
            multitaskingIndex: 0,
            attentionFragmentation: 0,
            cognitiveEfficiency: 0
          };
        }

        return {
          hour,
          taskSwitches: Math.round(hourData.reduce((sum: number, r: any) => sum + (r.task_switching_rate || 0), 0) / hourData.length),
          multitaskingIndex: hourData.reduce((sum: number, r: any) => sum + (r.multitasking_index || 0), 0) / hourData.length,
          attentionFragmentation: hourData.reduce((sum: number, r: any) => sum + (r.attention_fragmentation || 0), 0) / hourData.length,
          cognitiveEfficiency: hourData.reduce((sum: number, r: any) => sum + (r.cognitive_efficiency || 0), 0) / hourData.length
        };
      });

      return { data: hourlyData, isDemo: false };
    } catch (error) {
      this.log('error', 'Failed to get cognitive load data');
      return { data: this.getFallbackCognitiveLoad(), isDemo: true };
    }
  }

  /**
   * Get behavioral metrics calculation
   */
  async getBehavioralMetrics(): Promise<{ data: BehavioralMetrics; isDemo: boolean }> {
    const results = await this.queryAPI<any>({ endpoint: 'cross-platform-sentiment' });

    if (!results || results.length === 0) {
      return { data: this.getFallbackBehavioralMetrics(), isDemo: true };
    }

    try {
      const metrics = await this.calculateBehavioralMetrics(results);
      return { data: metrics, isDemo: true };
    } catch (error) {
      this.log('error', 'Failed to calculate behavioral metrics');
      return { data: this.getFallbackBehavioralMetrics(), isDemo: true };
    }
  }

  /**
   * Get digital phenotype classification
   */
  async getDigitalPhenotype(): Promise<{ data: DigitalPhenotype; isDemo: boolean }> {
    try {
      const results = await this.queryAndroidResearchAPI('digital-phenotype');

      if (results.length > 0) {
        const phenotype = results[0];
        return {
          data: {
            behaviorType: phenotype.usage_behavior_type || 'Moderate User',
            attentionProfile: phenotype.attention_profile || 'Moderate',
            usagePattern: phenotype.usage_pattern || 'Evening-Peak',
            multitaskingIndex: phenotype.multitasking_profile || 'Moderate'
          },
          isDemo: false
        };
      }

      return { data: this.getFallbackDigitalPhenotype(), isDemo: true };
    } catch (error) {
      this.log('error', 'Failed to get digital phenotype');
      return { data: this.getFallbackDigitalPhenotype(), isDemo: true };
    }
  }

  /**
   * Get research findings and insights
   */
  async getResearchFindings(): Promise<{ data: ResearchFinding[]; isDemo: boolean }> {
    try {
      const results = await this.queryAndroidResearchAPI('research-findings');

      if (results.length === 0) {
        return { data: this.getFallbackResearchFindings(), isDemo: true };
      }

      const findings = this.safeTransform(
        results,
        (r) => ({
          title: r.finding_title || r.title,
          finding: r.finding_description || r.finding,
          significance: r.research_implications || r.significance,
          implication: r.behavioral_recommendations || r.implication
        }),
        this.getFallbackResearchFindings()
      );

      return { data: findings, isDemo: false };
    } catch (error) {
      this.log('error', 'Failed to get research findings');
      return { data: this.getFallbackResearchFindings(), isDemo: true };
    }
  }

  /**
   * Get network centrality analysis
   */
  async getNetworkCentrality(): Promise<{ data: NetworkCentrality[]; isDemo: boolean }> {
    try {
      const results = await this.queryAndroidResearchAPI('network-centrality');

      if (results.length === 0) {
        return { data: this.getFallbackNetworkCentrality(), isDemo: true };
      }

      const centrality = this.safeTransform(
        results,
        (r) => ({
          app: r.app_name || r.app,
          outDegree: r.out_degree || 0,
          inDegree: r.in_degree || 0,
          centralityScore: r.total_degree || r.overall_centrality || 0,
          category: r.app_category || 'Other'
        }),
        this.getFallbackNetworkCentrality()
      );

      return { data: centrality.sort((a, b) => b.centralityScore - a.centralityScore), isDemo: false };
    } catch (error) {
      this.log('error', 'Failed to get network centrality');
      return { data: this.getFallbackNetworkCentrality(), isDemo: true };
    }
  }

  /**
   * Get transition flow data for Sankey diagram
   */
  async getTransitionFlow(): Promise<{ data: AppTransition[]; isDemo: boolean }> {
    try {
      const results = await this.queryAndroidResearchAPI('transition-flow');

      if (results.length === 0) {
        return { data: this.getFallbackTransitionFlow(), isDemo: true };
      }

      const flow = this.safeTransform(
        results,
        (r) => ({
          source: r.from_app_name || r.source,
          target: r.to_app_name || r.target,
          value: r.transition_count || r.value || 1
        }),
        this.getFallbackTransitionFlow()
      );

      return { data: flow, isDemo: false };
    } catch (error) {
      this.log('error', 'Failed to get transition flow');
      return { data: this.getFallbackTransitionFlow(), isDemo: true };
    }
  }

  // ========== Fallback Methods ==========

  private getFallbackTemporalPatterns(): TemporalUsagePattern[] {
    const apps = ['YouTube', 'Chrome', 'Instagram', 'WhatsApp', 'Gmail'];
    return Array.from({ length: 24 }, (_, hour) => {
      const baseUsage = Math.max(0, Math.sin((hour - 6) * Math.PI / 12) * 100 + (hour % 5) * 4);
      const appUsage = apps.map((app, appIdx) => ({
        app,
        hour,
        usage: Math.max(0, baseUsage * (0.5 + appIdx * 0.15)),
        sessions: (hour + appIdx * 3) % 15 + 1,
        avgDuration: ((hour * 13 + appIdx * 47) % 300) + 30
      }));
      return { hour, apps: appUsage, totalUsage: appUsage.reduce((sum, a) => sum + a.usage, 0) };
    });
  }

  private getFallbackAppTransitions(): AppTransition[] {
    return [
      { source: 'YouTube', target: 'Chrome', value: 25, avgTime: 120 },
      { source: 'Chrome', target: 'Instagram', value: 18, avgTime: 90 },
      { source: 'Instagram', target: 'WhatsApp', value: 22, avgTime: 60 },
      { source: 'WhatsApp', target: 'Gmail', value: 16, avgTime: 45 }
    ];
  }

  private getFallbackAttentionSpans(): AttentionSpan[] {
    const apps = ['YouTube', 'Chrome', 'Instagram', 'WhatsApp'];
    return apps.map((app, appIdx) => ({
      app,
      meanDuration: app === 'YouTube' ? 280 : app === 'Chrome' ? 200 : 120,
      sessions: Array.from({ length: 10 }, (_, sessIdx) => ({
        duration: ((appIdx * 10 + sessIdx) * 31 % 300) + 30,
        timestamp: Date.now() - (appIdx * 10 + sessIdx) * 8640000,
        taskSwitches: (appIdx + sessIdx) % 3,
        interruptions: (appIdx + sessIdx) % 2
      }))
    }));
  }

  private getFallbackContentEngagement(): ContentEngagement[] {
    return [
      { content: 'Social Media', engagementScore: 85, avgDuration: 180, interactionDepth: 7.2, returnRate: 0.65 },
      { content: 'Video Content', engagementScore: 92, avgDuration: 320, interactionDepth: 4.1, returnRate: 0.45 },
      { content: 'Communication', engagementScore: 88, avgDuration: 90, interactionDepth: 6.5, returnRate: 0.85 }
    ];
  }

  private getFallbackCognitiveLoad(): CognitiveLoad[] {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      taskSwitches: (hour * 3) % 15 + 5,
      multitaskingIndex: (hour * 7 % 80) / 10,
      attentionFragmentation: (hour * 11 % 80),
      cognitiveEfficiency: Math.max(20, 100 - (hour * 5 % 60))
    }));
  }

  private getFallbackBehavioralMetrics(): BehavioralMetrics {
    return {
      totalDailyUsage: 240,
      peakUsageHour: 19,
      avgSessionLength: 180,
      appSwitchingRate: 12,
      digitalWellbeingScore: 75
    };
  }

  private getFallbackDigitalPhenotype(): DigitalPhenotype {
    return {
      behaviorType: 'Moderate User',
      attentionProfile: 'Moderate',
      usagePattern: 'Evening-Peak',
      multitaskingIndex: 'Moderate'
    };
  }

  private getFallbackResearchFindings(): ResearchFinding[] {
    return [
      {
        title: 'Peak Activity Window',
        finding: 'Highest usage occurs at 19:00 (45 minutes)',
        significance: 'Primary attention allocation period',
        implication: 'Optimal time for notifications'
      }
    ];
  }

  private getFallbackNetworkCentrality(): NetworkCentrality[] {
    return [
      { app: 'YouTube', outDegree: 12, inDegree: 8, centralityScore: 20, category: 'Entertainment' },
      { app: 'Chrome', outDegree: 10, inDegree: 15, centralityScore: 25, category: 'Productivity' }
    ];
  }

  private getFallbackTransitionFlow(): AppTransition[] {
    return [
      { source: 'Launcher', target: 'YouTube', value: 45 },
      { source: 'YouTube', target: 'Chrome', value: 25 },
      { source: 'Chrome', target: 'Instagram', value: 20 }
    ];
  }

  /**
   * Calculate behavioral metrics from raw data
   */
  private async calculateBehavioralMetrics(results: any[]): Promise<BehavioralMetrics> {
    const totalPosts = results.reduce((sum, item) => sum + item.post_count, 0);
    const avgConfidence = results.reduce((sum, item) => sum + (item.avg_confidence || 0.8), 0) / results.length;

    // Get hourly patterns to find peak usage
    const hourlyResults = await this.queryAPI<any>({ endpoint: 'hourly-patterns' });
    let peakHour = 19; // Default

    if (hourlyResults && hourlyResults.length > 0) {
      const maxActivity = hourlyResults.reduce((max, current) => {
        const currentTotal = (current.positive || 0) + (current.negative || 0) + (current.neutral || 0);
        const maxTotal = (max.positive || 0) + (max.negative || 0) + (max.neutral || 0);
        return currentTotal > maxTotal ? current : max;
      });
      peakHour = maxActivity.hour_of_day || 19;
    }

    return {
      totalDailyUsage: Math.round(totalPosts * 0.5),
      peakUsageHour: peakHour,
      avgSessionLength: Math.round(totalPosts * 0.3),
      appSwitchingRate: Math.round(results.length * 2),
      digitalWellbeingScore: Math.round(avgConfidence * 100)
    };
  }
}

export const androidResearchDb = new AndroidResearchDatabase();
