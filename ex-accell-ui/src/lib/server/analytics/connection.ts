import { json } from '@sveltejs/kit';
import { postgresPool } from '$lib/services/postgres';
import { executeQuery } from './executeQuery';
import type { AnalyticsContext, AnalyticsHandler } from './types';

async function test({ scope }: AnalyticsContext): Promise<Response> {
  // Test PostgreSQL connection with pg_duckdb
  const isConnected = await postgresPool.healthCheck();

  if (isConnected) {
    try {
      // Check if we have data in the database
      const postCount = await executeQuery('SELECT COUNT(*) as count FROM sentiment_posts');
      const sentimentCount = await executeQuery('SELECT COUNT(*) as count FROM sentiment_classifications');

      // Get connection pool stats
      const poolStats = postgresPool.getPoolStats();

      return json({
        success: true,
        message: 'PostgreSQL with pg_duckdb extension connected',
        timestamp: new Date().toISOString(),
        dataStatus: {
          posts: postCount[0]?.count || 0,
          sentiments: sentimentCount[0]?.count || 0,
          hasData: (postCount[0]?.count || 0) > 0
        },
        poolStats,
        scope: scope ? {
          workspaceId: scope.workspaceId,
          workspaceName: scope.workspaceName,
          datasetCount: scope.datasets.length,
          datasetTypes: scope.datasetTypes,
          socialPlatforms: scope.socialPlatforms,
          hasGdeltEvents: scope.hasGdeltEvents,
          hasGdeltGkg: scope.hasGdeltGkg
        } : null
      });
    } catch (error) {
      console.warn('Could not check data status:', error);
      return json({
        success: true,
        message: 'PostgreSQL connected (data status unknown)',
        timestamp: new Date().toISOString(),
        warning: 'Could not verify data availability'
      });
    }
  } else {
    return json({
      success: false,
      error: 'Database connection failed',
      message: 'Could not connect to PostgreSQL'
    });
  }
}

export const connectionHandlers: Record<string, AnalyticsHandler> = {
  'test': test
};
