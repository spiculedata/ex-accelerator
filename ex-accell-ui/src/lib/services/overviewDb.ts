// DuckDB connection and query service for Overview Dashboard data
// This service provides real DuckDB SQL queries for dashboard metrics via server-side API

interface OverviewStats {
  activeProjects: number;
  postsAnalyzed: number;  
  reportsReady: number;
  todaysActivities: number;
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
  id: number;
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

class OverviewDatabase {
  private initialized = false;

  async connect() {
    if (this.initialized) return; // Already connected

    try {
      // Test connection with a simple stats query
      await this.queryOverviewAPI('stats');
      this.initialized = true;
      console.log('OverviewDatabase connected successfully');
    } catch (error) {
      console.error('Failed to connect to OverviewDatabase:', error);
      this.initialized = true; // Continue with fallback mode
    }
  }

  private async queryOverviewAPI(queryType: string, params: any = {}): Promise<any[]> {
    try {
      const urlParams = new URLSearchParams();
      urlParams.append('type', queryType);
      
      // Add any additional parameters
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          urlParams.append(key, String(value));
        }
      });
      
      const response = await fetch(`/api/overview?${urlParams.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Overview API query failed');
      }
    } catch (error) {
      console.error('Overview API error:', error);
      throw error;
    }
  }

  // Get overview dashboard statistics
  async getOverviewStats(): Promise<OverviewStats> {
    if (!this.initialized) await this.connect();

    try {
      const result = await this.queryOverviewAPI('stats');
      
      if (result.length > 0) {
        const stats = result[0];
        return {
          activeProjects: stats.active_projects || 0,
          postsAnalyzed: stats.posts_analyzed || 0,
          reportsReady: stats.reports_ready || 0,
          todaysActivities: stats.todays_activities || 0
        };
      }
      
      return {
        activeProjects: 0,
        postsAnalyzed: 0,
        reportsReady: 0,
        todaysActivities: 0
      };
    } catch (error) {
      console.error('Error fetching overview stats:', error);
      // Return empty stats on error
      return {
        activeProjects: 0,
        postsAnalyzed: 0,
        reportsReady: 0,
        todaysActivities: 0
      };
    }
  }

  // Get app modules status
  async getAppModulesStatus(): Promise<AppModule[]> {
    if (!this.initialized) await this.connect();

    try {
      const result = await this.queryOverviewAPI('app-modules');
      
      return result.map(module => ({
        name: module.name,
        displayName: module.display_name,
        status: module.status,
        activeJobs: module.active_jobs || 0,
        totalProcessed: module.total_processed || 0,
        statusDisplay: module.status_display,
        activityDisplay: module.activity_display,
        iconColor: module.icon_color
      }));
    } catch (error) {
      console.error('Error fetching app modules status:', error);
      return [];
    }
  }

  // Get recent system activities
  async getRecentActivities(limit: number = 10): Promise<SystemActivity[]> {
    if (!this.initialized) await this.connect();

    try {
      const result = await this.queryOverviewAPI('recent-activities', { limit });
      
      return result.map(activity => ({
        id: activity.id,
        activityType: activity.activity_type,
        title: activity.title,
        description: activity.description,
        module: activity.module,
        status: activity.status,
        timeAgo: activity.time_ago,
        iconColor: activity.icon_color
      }));
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      return [];
    }
  }

  // Get system status metrics
  async getSystemStatus(): Promise<SystemStatus[]> {
    if (!this.initialized) await this.connect();

    try {
      const result = await this.queryOverviewAPI('system-status');
      
      return result.map(metric => ({
        metricName: metric.metric_name,
        displayName: metric.display_name,
        metricValue: metric.metric_value || 0,
        metricUnit: metric.metric_unit,
        status: metric.status,
        statusColor: metric.status_color,
        statusDisplay: metric.status_display
      }));
    } catch (error) {
      console.error('Error fetching system status:', error);
      return [];
    }
  }

  // Get active projects
  async getActiveProjects(limit: number = 10): Promise<Project[]> {
    if (!this.initialized) await this.connect();

    try {
      const result = await this.queryOverviewAPI('projects', { limit });
      
      return result.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        category: project.category,
        activityCount: project.activity_count || 0
      }));
    } catch (error) {
      console.error('Error fetching active projects:', error);
      return [];
    }
  }

  // Get current workspace (most active project)
  async getCurrentWorkspace(): Promise<Workspace | null> {
    if (!this.initialized) await this.connect();

    try {
      const result = await this.queryOverviewAPI('workspace');
      
      if (result.length > 0) {
        const workspace = result[0];
        return {
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
          status: workspace.status,
          category: workspace.category,
          activityCount: workspace.activity_count || 0,
          reportsCount: workspace.reports_count || 0
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching current workspace:', error);
      return null;
    }
  }

  // Get data processing statistics
  async getDataProcessingStats(): Promise<any[]> {
    if (!this.initialized) await this.connect();

    try {
      const result = await this.queryOverviewAPI('data-processing');
      
      return result.map(batch => ({
        sourceType: batch.source_type,
        totalRecords: batch.total_records || 0,
        batchCount: batch.batch_count || 0,
        avgBatchSize: Math.round(batch.avg_batch_size || 0),
        latestImport: batch.latest_import
      }));
    } catch (error) {
      console.error('Error fetching data processing stats:', error);
      return [];
    }
  }

  // Export all overview data
  async exportOverviewData(): Promise<any> {
    if (!this.initialized) await this.connect();

    try {
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
    } catch (error) {
      console.error('Error exporting overview data:', error);
      return {
        exportDate: new Date().toISOString(),
        stats: {},
        modules: [],
        activities: [],
        systemStatus: [],
        projects: [],
        workspace: null,
        dataProcessing: []
      };
    }
  }

  async close() {
    // In browser environment, no cleanup needed
    this.initialized = false;
  }
}

export const overviewDb = new OverviewDatabase();