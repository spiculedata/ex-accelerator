import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { datasetsDb } from '$lib/services/datasetsDb';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const workspaceId = parseInt(params.id);

    if (isNaN(workspaceId)) {
      return json({ success: false, error: 'Invalid workspace ID' }, { status: 400 });
    }

    // Get all datasets for this workspace
    const datasets = await datasetsDb.getWorkspaceDatasets(workspaceId);

    if (!datasets || datasets.length === 0) {
      return json({
        success: true,
        summary: {
          types: [],
          platforms: [],
          recordCount: 0,
          datasetCount: 0,
          lastSync: null
        }
      });
    }

    // Extract unique dataset types
    const types = [...new Set(datasets.map(d => d.dataset_type).filter(Boolean))];

    // Extract unique source platforms
    const platforms = [...new Set(datasets.map(d => d.source_platform).filter(Boolean))];

    // Calculate total record count (BIGINT columns arrive as strings, so convert before adding)
    const recordCount = datasets.reduce((sum, d) => sum + (Number(d.record_count) || 0), 0);

    // Find most recent sync time
    const syncTimes = datasets
      .map(d => (d as any).last_updated ? new Date((d as any).last_updated).getTime() : 0)
      .filter(t => t > 0);

    let lastSync = null;
    if (syncTimes.length > 0) {
      const mostRecentTime = Math.max(...syncTimes);
      const now = Date.now();
      const diffMs = now - mostRecentTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) {
        lastSync = diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
      } else if (diffHours < 24) {
        lastSync = `${diffHours}h ago`;
      } else if (diffDays < 30) {
        lastSync = `${diffDays}d ago`;
      } else {
        lastSync = new Date(mostRecentTime).toLocaleDateString();
      }
    }

    return json({
      success: true,
      summary: {
        types,
        platforms,
        recordCount,
        datasetCount: datasets.length,
        lastSync
      }
    });
  } catch (error) {
    console.error('Error getting workspace dataset summary:', error);
    return json(
      { success: false, error: 'Failed to retrieve dataset summary' },
      { status: 500 }
    );
  }
};
