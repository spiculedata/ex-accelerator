import type { JobState } from '$lib/services/jobStateStore';
import type { RadioStream, UiJob, WavePulseConfig } from './types';

/** Progress shown for a job given its status; running jobs are capped at 99%. */
export function getProgressFromStatus(status: string, itemsProcessed?: number, totalEstimated?: number): number {
  switch (status) {
    case 'scheduled': return 0;
    case 'running':
      if (itemsProcessed && totalEstimated && totalEstimated > 0) {
        return Math.min(Math.round((itemsProcessed / totalEstimated) * 100), 99);
      }
      return 25; // Default progress for running jobs without estimates
    case 'completed': return 100;
    case 'failed': return 0;
    case 'cancelled': return 0;
    default: return 0;
  }
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

/** Turn a stored job state into the row the UI shows. */
export function jobStateToUiJob(state: JobState): UiJob {
  return {
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
    lastLogCount: state.executionLog?.length || 0,
    hasNewLogs: false // Reset new logs indicator
  };
}

/** Merge a freshly fetched job state into a UI row, flagging whether new log lines arrived. */
export function applyJobStateUpdate(job: UiJob, updatedState: any): UiJob {
  const previousLogCount = job.lastLogCount || 0;
  const newLogCount = updatedState.executionLog?.length || 0;

  return {
    ...job,
    status: updatedState.status,
    progress: getProgressFromStatus(updatedState.status, updatedState.result?.itemsProcessed, updatedState.jobData.maxPosts),
    itemsCollected: updatedState.result?.itemsProcessed || 0,
    logs: updatedState.executionLog || [],
    stateData: updatedState,
    lastLogCount: newLogCount,
    hasNewLogs: newLogCount > previousLogCount // Flag for UI indication
  };
}

const RECENT_UPDATE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Jobs the global poll should refresh: every running job, plus completed or failed jobs
 * updated within the last five minutes (for any final updates).
 */
export function selectJobsToPoll(jobs: UiJob[], nowMs: number = Date.now()): UiJob[] {
  const running = jobs.filter(job => job.status === 'running');
  const cutoff = new Date(nowMs - RECENT_UPDATE_WINDOW_MS);
  const recentlyFinished = jobs.filter(job => {
    if (job.status !== 'completed' && job.status !== 'failed') return false;
    const updatedAt = new Date(job.stateData?.updatedAt || job.startTime);
    return updatedAt > cutoff;
  });
  return [...running, ...recentlyFinished];
}

const TAB_IDS = ['schedule', 'crawler', 'upload', 'princeton-smart', 'wavepulse', 'analytics'];

/** The tab named by a `?tab=` query string, or null when absent or unknown. */
export function parseTabParam(search: string): string | null {
  const tab = new URLSearchParams(search).get('tab');
  return tab && TAB_IDS.includes(tab) ? tab : null;
}

/** Whether a scrolled container is within `threshold` pixels of its bottom. */
export function isNearBottom(
  container: { scrollTop: number; clientHeight: number; scrollHeight: number },
  threshold = 50
): boolean {
  return container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;
}

/** Format WavePulse time slots into schedule text. */
export function formatWavePulseSchedule(timeSlots: Array<{ start: string; end: string }>): string {
  if (timeSlots.length === 0) return 'No schedule configured';
  if (timeSlots.length === 1) {
    return `Daily ${timeSlots[0].start} - ${timeSlots[0].end}`;
  }
  return `Daily (${timeSlots.length} time slots)`;
}

/** One job row per configured radio stream. */
export function wavePulseStreamsToJobs(
  config: WavePulseConfig,
  status: string,
  progress: number,
  results: { startTime?: string } | null
): UiJob[] {
  return config.radioStreams.map((stream: RadioStream, index: number) => ({
    id: `wavepulse-${index}`,
    name: `${stream.radioName || 'Unknown Station'} (${stream.state || 'Unknown'})`,
    type: 'wavepulse',
    status: status === 'running' ? 'running' : status === 'idle' ? 'scheduled' : status,
    progress: status === 'starting' ? progress : undefined,
    startTime: results?.startTime || null,
    schedule: formatWavePulseSchedule(stream.timeSlots),
    // The WavePulse service does not report collection counts yet, so none are shown
    itemsCollected: 0,
    totalEstimated: 0,
    streamUrl: stream.url,
    logs: status === 'running' ? [
      `[${new Date().toISOString()}] INFO: Started WavePulse for ${stream.radioName}`,
      `[${new Date().toISOString()}] INFO: Recording radio stream from ${stream.url}`,
      `[${new Date().toISOString()}] INFO: Transcription pipeline active`,
      config.enableClassification ? `[${new Date().toISOString()}] INFO: Content classification enabled` : null,
      config.enableDiarization ? `[${new Date().toISOString()}] INFO: Speaker diarization active` : null
    ].filter(Boolean) : []
  }));
}

/** Return a new array sorted by the chosen field; the input is not changed. */
export function sortJobs(jobs: UiJob[], sortBy: string, sortDirection: 'asc' | 'desc'): UiJob[] {
  return [...jobs].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'type': {
        const typeA = a.type || a.platform || 'unknown';
        const typeB = b.type || b.platform || 'unknown';
        comparison = typeA.localeCompare(typeB);
        break;
      }
      case 'date': {
        const dateA = new Date(a.startTime || a.createdAt || 0).getTime();
        const dateB = new Date(b.startTime || b.createdAt || 0).getTime();
        comparison = dateA - dateB;
        break;
      }
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
      case 'repeat': {
        // The schedule field indicates a repeating job
        const repeatA = a.schedule ? 1 : 0;
        const repeatB = b.schedule ? 1 : 0;
        comparison = repeatA - repeatB;
        break;
      }
      case 'size':
        comparison = (a.itemsCollected || 0) - (b.itemsCollected || 0);
        break;
      case 'nextRun': {
        const nextA = new Date(a.nextRun || a.startTime || 0).getTime();
        const nextB = new Date(b.nextRun || b.startTime || 0).getTime();
        comparison = nextA - nextB;
        break;
      }
      case 'url': {
        const urlA = a.streamUrl || a.crawlId || a.id || '';
        const urlB = b.streamUrl || b.crawlId || b.id || '';
        comparison = urlA.localeCompare(urlB);
        break;
      }
      default:
        comparison = 0;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });
}

/** Summary numbers and groupings for the Analytics tab. */
export function buildAnalyticsData(allJobs: UiJob[]) {
  return {
    totalJobs: allJobs.length,
    runningJobs: allJobs.filter(job => job.status === 'running').length,
    completedJobs: allJobs.filter(job => job.status === 'completed').length,
    failedJobs: allJobs.filter(job => job.status === 'failed').length,
    pendingJobs: allJobs.filter(job => job.status === 'pending' || job.status === 'scheduled').length,
    totalItemsCollected: allJobs.reduce((sum, job) => sum + (job.itemsCollected || 0), 0),
    averageItemsPerJob: allJobs.length > 0 ? Math.round(allJobs.reduce((sum, job) => sum + (job.itemsCollected || 0), 0) / allJobs.filter(job => job.itemsCollected > 0).length) || 0 : 0,
    jobsByPlatform: allJobs.reduce((acc: Record<string, number>, job) => {
      const platform = job.platform || 'unknown';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {}),
    recentJobs: allJobs
      .filter(job => job.startTime)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 10),
    jobsByStatus: {
      running: allJobs.filter(job => job.status === 'running'),
      completed: allJobs.filter(job => job.status === 'completed'),
      failed: allJobs.filter(job => job.status === 'failed'),
      pending: allJobs.filter(job => job.status === 'pending' || job.status === 'scheduled')
    }
  };
}
