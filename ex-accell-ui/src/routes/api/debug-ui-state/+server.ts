import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Debug endpoint to check UI state synchronization
 * This helps diagnose issues between state store and UI display
 */

export const GET: RequestHandler = async ({ url }) => {
  try {
    const jobId = url.searchParams.get('jobId');

    // Get job states from our API
    const jobsResponse = await fetch('http://localhost:5173/api/jobs?state=true');
    const jobStates = await jobsResponse.json();

    // Get specific job if requested
    let specificJob = null;
    if (jobId) {
      const jobResponse = await fetch(`http://localhost:5173/api/job-state?jobId=${jobId}`);
      if (jobResponse.ok) {
        specificJob = await jobResponse.json();
      }
    }

    // Simulate UI mapping
    const uiMappedJobs = jobStates.map((state: any) => ({
      id: state.id,
      name: state.name,
      status: state.status,
      progress: getProgressFromStatus(state.status, state.result?.itemsProcessed, state.jobData.maxPosts),
      startTime: state.createdAt,
      schedule: `Scheduled for ${new Date(state.scheduledFor).toLocaleString()}`,
      itemsCollected: state.result?.itemsProcessed || 0,
      totalEstimated: state.jobData.maxPosts || 0,
      platform: state.platform,
      crawlId: state.jobData.crawlId,
      crawlLabel: state.name,
      daprJobName: state.name,
      logs: state.executionLog || [],
      stateData: state,
      lastLogCount: state.executionLog?.length || 0
    }));

    function getProgressFromStatus(status: string, itemsProcessed?: number, totalEstimated?: number): number {
      switch (status) {
        case 'scheduled': return 0;
        case 'running': 
          if (itemsProcessed && totalEstimated && totalEstimated > 0) {
            return Math.min(Math.round((itemsProcessed / totalEstimated) * 100), 99);
          }
          return 25;
        case 'completed': return 100;
        case 'failed': return 0;
        case 'cancelled': return 0;
        default: return 0;
      }
    }

    return json({
      timestamp: new Date().toISOString(),
      rawJobStates: jobStates,
      uiMappedJobs,
      specificJob,
      diagnostics: {
        totalJobs: jobStates.length,
        runningJobs: jobStates.filter((j: any) => j.status === 'running').length,
        completedJobs: jobStates.filter((j: any) => j.status === 'completed').length,
        jobsWithLogs: jobStates.filter((j: any) => j.executionLog && j.executionLog.length > 0).length
      }
    });

  } catch (error) {
    console.error('Debug UI state error:', error);
    return json({ error: error.message }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { action, jobId } = await request.json();

    if (action === 'refresh-job' && jobId) {
      // Force refresh a specific job's state
      const jobResponse = await fetch(`http://localhost:5173/api/job-state?jobId=${jobId}`);
      if (jobResponse.ok) {
        const jobState = await jobResponse.json();
        return json({ 
          success: true, 
          jobState,
          message: `Job ${jobId} state refreshed` 
        });
      } else {
        return json({ 
          success: false, 
          message: `Job ${jobId} not found` 
        });
      }
    }

    return json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('Debug UI state POST error:', error);
    return json({ error: error.message }, { status: 500 });
  }
};