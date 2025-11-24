// Database connection and query service for Overview Dashboard data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { BaseDatabaseService } from './baseDatabaseService';

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
  async getOverviewStats(): Promise<OverviewStats> {
    try {
      // Fetch real data from projects and datasets APIs
      const [projectsResponse, datasetsResponse] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/datasets')
      ]);

      const projectsResult = await projectsResponse.json();
      const datasetsResult = await datasetsResponse.json();

      // Get analytics data for posts count
      const analyticsData = await this.queryAPI<any>({ endpoint: 'cross-platform-sentiment' });

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
   * Get app modules status
   */
  async getAppModulesStatus(): Promise<AppModule[]> {
    const data = await this.queryAPI<any>({ endpoint: 'platform-performance' });

    if (!data || data.length === 0) {
      return [];
    }

    const modules = [
      { name: 'sentiment-analysis', displayName: 'Sentiment Analysis', color: '#10b981' },
      { name: 'topic-modeling', displayName: 'Topic Modeling', color: '#3b82f6' },
      { name: 'language-detection', displayName: 'Language Detection', color: '#8b5cf6' },
      { name: 'engagement-analysis', displayName: 'Engagement Analysis', color: '#f59e0b' }
    ];

    return modules.map((module, index) => {
      const platformData = data[index % data.length] || { total_posts: 0, avg_confidence: 0.8 };
      const isActive = platformData.total_posts > 0;

      return {
        name: module.name,
        displayName: module.displayName,
        status: isActive ? 'running' : 'idle',
        activeJobs: Math.floor(platformData.total_posts * 0.02),
        totalProcessed: platformData.total_posts,
        statusDisplay: isActive ? 'Active' : 'Idle',
        activityDisplay: `${platformData.total_posts} processed`,
        iconColor: module.color
      };
    });
  }

  /**
   * Get recent system activities
   */
  async getRecentActivities(limit: number = 10): Promise<SystemActivity[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'sample-posts',
      params: { limit: limit.toString() }
    });

    if (!data || data.length === 0) {
      return [];
    }

    const activityTypes = ['analysis', 'processing', 'export', 'crawl'];
    const modules = ['sentiment-analysis', 'topic-modeling', 'language-detection', 'engagement-analysis'];
    const statuses = ['completed', 'running', 'pending'];
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

    return this.safeTransform(
      data,
      (post, index) => ({
        id: post.id,
        activityType: activityTypes[index % activityTypes.length],
        title: `${modules[index % modules.length].replace('-', ' ')} completed`,
        description: `Processed ${post.platform} content with ${Math.round((post.confidence || 0.8) * 100)}% confidence`,
        module: modules[index % modules.length],
        status: statuses[index % statuses.length],
        timeAgo: this.getTimeAgo(new Date(post.timestamp)),
        iconColor: colors[index % colors.length]
      }),
      []
    );
  }

  /**
   * Get system status metrics
   */
  async getSystemStatus(): Promise<SystemStatus[]> {
    const data = await this.queryAPI<any>({ endpoint: 'cross-platform-sentiment' });

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
  async getActiveProjects(limit: number = 10): Promise<Project[]> {
    const data = await this.queryAPI<any>({ endpoint: 'platform-performance' });

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
  async getCurrentWorkspace(): Promise<Workspace | null> {
    const data = await this.queryAPI<any>({ endpoint: 'platform-performance' });

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
  async getDataProcessingStats(): Promise<DataProcessingStats[]> {
    const data = await this.queryAPI<any>({ endpoint: 'platform-performance' });

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
  async exportOverviewData(): Promise<any> {
    const [stats, modules, activities, systemStatus, projects, workspace, dataProcessing] = await Promise.all([
      this.getOverviewStats(),
      this.getAppModulesStatus(),
      this.getRecentActivities(20),
      this.getSystemStatus(),
      this.getActiveProjects(20),
      this.getCurrentWorkspace(),
      this.getDataProcessingStats()
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
        statusColor: totalPosts > 1000 ? '#10b981' : '#f59e0b',
        statusDisplay: totalPosts > 1000 ? 'Healthy' : 'Low Volume'
      },
      {
        metricName: 'avg_confidence',
        displayName: 'Average Confidence',
        metricValue: Math.round(avgConfidence * 100),
        metricUnit: '%',
        status: avgConfidence > 0.8 ? 'healthy' : 'warning',
        statusColor: avgConfidence > 0.8 ? '#10b981' : '#f59e0b',
        statusDisplay: avgConfidence > 0.8 ? 'High Quality' : 'Moderate Quality'
      },
      {
        metricName: 'active_sources',
        displayName: 'Active Sources',
        metricValue: activePlatforms,
        metricUnit: 'platforms',
        status: activePlatforms > 2 ? 'healthy' : 'warning',
        statusColor: activePlatforms > 2 ? '#10b981' : '#f59e0b',
        statusDisplay: activePlatforms > 2 ? 'Multi-Platform' : 'Limited Sources'
      }
    ];
  }

  /**
   * Calculate time ago from date
   */
  private getTimeAgo(date: Date): string {
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
