// Database connection and query service for Overview Dashboard data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { BaseDatabaseService } from './baseDatabaseService';

import { CHART } from '$lib/utils/chartColors';
import { getSentimentColor } from '$lib/utils/colorUtils';
interface OverviewStats {
  activeProjects: number;
  postsAnalyzed: number;
  totalWorkspaces: number;
  activeDatasets: number;
}

interface AppModule {
  name: string;
  displayName: string;
  status: string;
  activeJobs: number;
  totalProcessed: number;
  statusDisplay: string;
  activityDisplay: string;
  iconColor: string;
}

interface SystemActivity {
  id: number | string;
  activityType: string;
  title: string;
  description: string;
  module: string;
  status: string;
  timeAgo: string;
  iconColor: string;
}

interface SystemStatus {
  metricName: string;
  displayName: string;
  metricValue: number;
  metricUnit: string;
  status: string;
  statusColor: string;
  statusDisplay: string;
}

interface Project {
  id: number;
  name: string;
  description: string;
  status: string;
  category: string;
  activityCount: number;
}

interface Workspace {
  id: number;
  name: string;
  description: string;
  status: string;
  category: string;
  activityCount: number;
  reportsCount: number;
}

interface DataProcessingStats {
  sourceType: string;
  totalRecords: number;
  batchCount: number;
  avgBatchSize: number;
  latestImport: string;
}

/**
 * Overview Database Service
 * Provides overview dashboard data from PostgreSQL with pg_duckdb extension
 */
class OverviewDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'Overview',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  /**
   * Get overview dashboard statistics
   */
  async getOverviewStats(workspaceId?: string): Promise<OverviewStats> {
    try {
      // Fetch real data from projects and datasets APIs
      const [projectsResponse, datasetsResponse] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/datasets')
      ]);

      const projectsResult = await projectsResponse.json();
      const datasetsResult = await datasetsResponse.json();

      // Get analytics data for posts count
      const analyticsData = await this.queryAPI<any>({
        endpoint: 'cross-platform-sentiment',
        params: workspaceId ? { workspace_id: workspaceId } : {}
      });

      const totalPosts = analyticsData && analyticsData.length > 0
        ? analyticsData.reduce((sum: number, item: any) => sum + (item.post_count || 0), 0)
        : 0;

      return {
        activeProjects: projectsResult.success ? (projectsResult.projects || []).filter((p: any) => p.status === 'active').length : 0,
        postsAnalyzed: totalPosts,
        totalWorkspaces: projectsResult.success ? (projectsResult.projects || []).reduce((sum: number, p: any) => sum + (p.workspace_count || 0), 0) : 0,
        activeDatasets: datasetsResult.success ? (datasetsResult.datasets || []).filter((d: any) => d.status === 'active').length : 0
      };
    } catch (error) {
      console.error('Error fetching overview stats:', error);
      return this.getDefaultOverviewStats();
    }
  }

  /**
   * Get app modules status based on real platform data
   */
  async getAppModulesStatus(workspaceId?: string): Promise<AppModule[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'platform-performance',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    const platformColors: Record<string, string> = {
      twitter: CHART.twitter,
      facebook: CHART.facebook,
      instagram: CHART.instagram,
      youtube: CHART.danger500,
      telegram: CHART.telegram,
      reddit: CHART.catVermilion
    };

    return this.safeTransform(
      data,
      (platform) => {
        const name = platform.platform.toLowerCase();
        const isActive = platform.total_posts > 0;

        return {
          name: name,
          displayName: platform.platform.charAt(0).toUpperCase() + platform.platform.slice(1),
          status: isActive ? 'running' : 'idle',
          activeJobs: 0,
          totalProcessed: platform.total_posts,
          statusDisplay: isActive ? 'Active' : 'Idle',
          activityDisplay: `${platform.total_posts} posts analyzed`,
          iconColor: platformColors[name] || CHART.ink500
        };
      },
      []
    );
  }

  /**
   * Get recent system activities from actual post data
   */
  async getRecentActivities(limit: number = 10, workspaceId?: string): Promise<SystemActivity[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'sample-posts',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), limit: limit.toString() }
    });

    if (!data || data.length === 0) {
      return [];
    }

    const sentimentColors: Record<string, string> = {
      positive: getSentimentColor('positive'),
      negative: getSentimentColor('negative'),
      neutral: getSentimentColor('neutral')
    };

    return this.safeTransform(
      data,
      (post) => {
        const sentiment = (post.sentiment || '').toLowerCase();
        const sentimentKey = sentiment.includes('positive') ? 'positive' :
                            sentiment.includes('negative') ? 'negative' : 'neutral';
        const confidence = post.confidence ? Math.round(post.confidence * 100) : 0;

        return {
          id: post.id,
          activityType: 'analysis',
          title: `${post.platform} post analyzed`,
          description: `Sentiment: ${sentimentKey} (${confidence}% confidence) - "${(post.text || '').substring(0, 80)}${(post.text || '').length > 80 ? '...' : ''}"`,
          module: 'sentiment-analysis',
          status: 'completed',
          timeAgo: this.getTimeAgo(new Date(post.timestamp)),
          iconColor: sentimentColors[sentimentKey] || CHART.ink500
        };
      },
      []
    );
  }

  /**
   * Get system status metrics
   */
  async getSystemStatus(workspaceId?: string): Promise<SystemStatus[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'cross-platform-sentiment',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      [data],
      () => this.calculateSystemStatus(data),
      []
    )[0];
  }

  /**
   * Get active projects
   */
  async getActiveProjects(limit: number = 10, workspaceId?: string): Promise<Project[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'platform-performance',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    const categories = ['Social Media Analysis', 'Content Research', 'Market Intelligence', 'Brand Monitoring'];

    return this.safeTransform(
      data.slice(0, limit),
      (platform, index) => ({
        id: index + 1,
        name: `${platform.platform.charAt(0).toUpperCase() + platform.platform.slice(1)} Analytics`,
        description: `Comprehensive analysis of ${platform.platform} content and engagement patterns`,
        status: platform.total_posts > 0 ? 'active' : 'inactive',
        category: categories[index % categories.length],
        activityCount: platform.total_posts
      }),
      []
    );
  }

  /**
   * Get current workspace (most active project)
   */
  async getCurrentWorkspace(workspaceId?: string): Promise<Workspace | null> {
    const data = await this.queryAPI<any>({
      endpoint: 'platform-performance',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return null;
    }

    // Find the platform with most posts
    const mostActive = data.reduce((max: any, current: any) =>
      current.total_posts > max.total_posts ? current : max, data[0]);

    return {
      id: 1,
      name: `${mostActive.platform.charAt(0).toUpperCase() + mostActive.platform.slice(1)} Research Workspace`,
      description: `Primary workspace for ${mostActive.platform} content analysis and insights`,
      status: 'active',
      category: 'Social Media Analysis',
      activityCount: mostActive.total_posts,
      reportsCount: Math.floor(mostActive.total_posts * 0.1)
    };
  }

  /**
   * Get data processing statistics
   */
  async getDataProcessingStats(workspaceId?: string): Promise<DataProcessingStats[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'platform-performance',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (platform) => ({
        sourceType: platform.platform.charAt(0).toUpperCase() + platform.platform.slice(1),
        totalRecords: platform.total_posts,
        batchCount: Math.ceil(platform.total_posts / 100),
        avgBatchSize: Math.min(platform.total_posts, 100),
        latestImport: new Date().toISOString()
      }),
      []
    );
  }

  /**
   * Export all overview data
   */
  async exportOverviewData(workspaceId?: string): Promise<any> {
    const [stats, modules, activities, systemStatus, projects, workspace, dataProcessing] = await Promise.all([
      this.getOverviewStats(workspaceId),
      this.getAppModulesStatus(workspaceId),
      this.getRecentActivities(20, workspaceId),
      this.getSystemStatus(workspaceId),
      this.getActiveProjects(20, workspaceId),
      this.getCurrentWorkspace(workspaceId),
      this.getDataProcessingStats(workspaceId)
    ]);

    return {
      exportDate: new Date().toISOString(),
      stats,
      modules,
      activities,
      systemStatus,
      projects,
      workspace,
      dataProcessing
    };
  }

  // ========== Private Helper Methods ==========

  /**
   * Get default overview statistics
   */
  private getDefaultOverviewStats(): OverviewStats {
    return {
      activeProjects: 0,
      postsAnalyzed: 0,
      totalWorkspaces: 0,
      activeDatasets: 0
    };
  }


  /**
   * Calculate system status from raw data
   */
  private calculateSystemStatus(data: any[]): SystemStatus[] {
    const totalPosts = data.reduce((sum, item) => sum + item.post_count, 0);
    const avgConfidence = data.reduce((sum, item) => sum + (item.avg_confidence || 0.8), 0) / data.length;
    const activePlatforms = new Set(data.map(item => item.platform)).size;

    return [
      {
        metricName: 'posts_processed',
        displayName: 'Posts Processed',
        metricValue: totalPosts,
        metricUnit: 'posts',
        status: totalPosts > 1000 ? 'healthy' : 'warning',
        statusColor: totalPosts > 1000 ? CHART.success600 : CHART.catOrange,
        statusDisplay: totalPosts > 1000 ? 'Healthy' : 'Low Volume'
      },
      {
        metricName: 'avg_confidence',
        displayName: 'Average Confidence',
        metricValue: Math.round(avgConfidence * 100),
        metricUnit: '%',
        status: avgConfidence > 0.8 ? 'healthy' : 'warning',
        statusColor: avgConfidence > 0.8 ? CHART.success600 : CHART.catOrange,
        statusDisplay: avgConfidence > 0.8 ? 'High Quality' : 'Moderate Quality'
      },
      {
        metricName: 'active_sources',
        displayName: 'Active Sources',
        metricValue: activePlatforms,
        metricUnit: 'platforms',
        status: activePlatforms > 2 ? 'healthy' : 'warning',
        statusColor: activePlatforms > 2 ? CHART.success600 : CHART.catOrange,
        statusDisplay: activePlatforms > 2 ? 'Multi-Platform' : 'Limited Sources'
      }
    ];
  }

  /**
   * Calculate time ago from date
   */
  private getTimeAgo(date: Date): string {
    if (!date || isNaN(date.getTime())) return '—';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
}

export const overviewDb = new OverviewDatabase();
