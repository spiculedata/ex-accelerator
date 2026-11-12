import { describe, it, expect } from 'vitest';
import {
  buildAnalyticsData,
  formatWavePulseSchedule,
  getProgressFromStatus,
  jobStateToUiJob,
  sortJobs,
  wavePulseStreamsToJobs
} from './jobList';
import { createDefaultWavePulseConfig } from './configDefaults';
import type { UiJob } from './types';

describe('getProgressFromStatus', () => {
  it('maps fixed statuses', () => {
    expect(getProgressFromStatus('scheduled')).toBe(0);
    expect(getProgressFromStatus('completed')).toBe(100);
    expect(getProgressFromStatus('failed')).toBe(0);
    expect(getProgressFromStatus('cancelled')).toBe(0);
    expect(getProgressFromStatus('mystery')).toBe(0);
  });

  it('computes running progress and caps it at 99', () => {
    expect(getProgressFromStatus('running', 50, 200)).toBe(25);
    expect(getProgressFromStatus('running', 500, 200)).toBe(99);
  });

  it('defaults running progress to 25 without estimates', () => {
    expect(getProgressFromStatus('running')).toBe(25);
    expect(getProgressFromStatus('running', 10, 0)).toBe(25);
  });
});

describe('formatWavePulseSchedule', () => {
  it('describes none, one and many slots', () => {
    expect(formatWavePulseSchedule([])).toBe('No schedule configured');
    expect(formatWavePulseSchedule([{ start: '08:00', end: '09:00' }])).toBe('Daily 08:00 - 09:00');
    expect(formatWavePulseSchedule([{ start: 'a', end: 'b' }, { start: 'c', end: 'd' }])).toBe('Daily (2 time slots)');
  });
});

describe('jobStateToUiJob', () => {
  it('maps a stored state to a UI row', () => {
    const state: any = {
      id: 'j1',
      name: 'job-one',
      status: 'running',
      createdAt: '2026-01-01T00:00:00Z',
      scheduledFor: '2026-01-01T00:00:10Z',
      platform: 'telegram',
      jobData: { maxPosts: 100, crawlId: 'c1' },
      result: { itemsProcessed: 40 },
      executionLog: ['a', 'b']
    };
    const row = jobStateToUiJob(state);
    expect(row).toMatchObject({
      id: 'j1',
      name: 'job-one',
      status: 'running',
      progress: 40,
      itemsCollected: 40,
      totalEstimated: 100,
      crawlId: 'c1',
      daprJobName: 'job-one',
      logs: ['a', 'b'],
      lastLogCount: 2,
      hasNewLogs: false
    });
    expect(row.stateData).toBe(state);
    expect(row.schedule).toMatch(/^Scheduled for /);
  });

  it('falls back to empty counts and logs', () => {
    const row = jobStateToUiJob({ id: 'j', name: 'n', status: 'scheduled', jobData: {}, scheduledFor: 0 } as any);
    expect(row).toMatchObject({ itemsCollected: 0, totalEstimated: 0, logs: [], lastLogCount: 0 });
  });
});

describe('wavePulseStreamsToJobs', () => {
  const config = createDefaultWavePulseConfig();

  it('shows idle streams as scheduled with no logs', () => {
    const [job] = wavePulseStreamsToJobs(config, 'idle', 0, null);
    expect(job).toMatchObject({
      id: 'wavepulse-0',
      name: 'WXYZ (NY)',
      type: 'wavepulse',
      status: 'scheduled',
      schedule: 'Daily (2 time slots)',
      streamUrl: 'https://example.com/stream',
      logs: [],
      startTime: null
    });
  });

  it('shows progress while starting and passes other statuses through', () => {
    expect(wavePulseStreamsToJobs(config, 'starting', 40, null)[0]).toMatchObject({ status: 'starting', progress: 40 });
    expect(wavePulseStreamsToJobs(config, 'error', 0, null)[0].status).toBe('error');
  });

  it('logs the enabled pipeline stages while running', () => {
    const [job] = wavePulseStreamsToJobs(config, 'running', 100, { startTime: 'T' });
    expect(job.status).toBe('running');
    expect(job.startTime).toBe('T');
    expect(job.logs).toHaveLength(4); // diarization is off by default
    expect(job.logs.some((l: string) => l.includes('Content classification enabled'))).toBe(true);
  });

  it('labels unnamed streams', () => {
    const unnamed = { ...config, radioStreams: [{ url: '', radioName: '', state: '', timeSlots: [] }] };
    expect(wavePulseStreamsToJobs(unnamed, 'idle', 0, null)[0].name).toBe('Unknown Station (Unknown)');
  });
});

describe('sortJobs', () => {
  const jobs: UiJob[] = [
    { id: 'a', name: 'a', status: 'failed', startTime: '2026-01-02', itemsCollected: 5, platform: 'youtube' },
    { id: 'b', name: 'b', status: 'completed', startTime: '2026-01-03', itemsCollected: 1, platform: 'telegram' },
    { id: 'c', name: 'c', status: 'running', startTime: '2026-01-01', itemsCollected: 9, type: 'wavepulse' }
  ];
  const ids = (list: UiJob[]) => list.map((j) => j.id);

  it('sorts by date in both directions', () => {
    expect(ids(sortJobs(jobs, 'date', 'asc'))).toEqual(['c', 'a', 'b']);
    expect(ids(sortJobs(jobs, 'date', 'desc'))).toEqual(['b', 'a', 'c']);
  });

  it('sorts by status, size and type', () => {
    expect(ids(sortJobs(jobs, 'status', 'asc'))).toEqual(['b', 'a', 'c']);
    expect(ids(sortJobs(jobs, 'size', 'asc'))).toEqual(['b', 'a', 'c']);
    expect(ids(sortJobs(jobs, 'type', 'asc'))).toEqual(['b', 'c', 'a']);
  });

  it('keeps order for unknown fields and does not mutate the input', () => {
    const copy = [...jobs];
    expect(ids(sortJobs(jobs, 'nonsense', 'asc'))).toEqual(['a', 'b', 'c']);
    expect(jobs).toEqual(copy);
  });
});

describe('buildAnalyticsData', () => {
  const jobs: UiJob[] = [
    { id: '1', name: '1', status: 'running', itemsCollected: 10, platform: 'telegram', startTime: '2026-01-01' },
    { id: '2', name: '2', status: 'completed', itemsCollected: 30, platform: 'telegram', startTime: '2026-01-03' },
    { id: '3', name: '3', status: 'scheduled', itemsCollected: 0 },
    { id: '4', name: '4', status: 'failed', itemsCollected: 0, platform: 'youtube', startTime: '2026-01-02' }
  ];

  it('counts statuses, items and platforms', () => {
    const data = buildAnalyticsData(jobs);
    expect(data).toMatchObject({
      totalJobs: 4,
      runningJobs: 1,
      completedJobs: 1,
      failedJobs: 1,
      pendingJobs: 1,
      totalItemsCollected: 40,
      averageItemsPerJob: 20,
      jobsByPlatform: { telegram: 2, unknown: 1, youtube: 1 }
    });
    expect(data.jobsByStatus.pending.map((j) => j.id)).toEqual(['3']);
  });

  it('lists recent jobs newest first and only those with a start time', () => {
    expect(buildAnalyticsData(jobs).recentJobs.map((j) => j.id)).toEqual(['2', '4', '1']);
  });

  it('handles an empty list and no collected items', () => {
    expect(buildAnalyticsData([]).averageItemsPerJob).toBe(0);
    expect(buildAnalyticsData([{ id: 'x', name: 'x', status: 'scheduled' }]).averageItemsPerJob).toBe(0);
  });
});
