import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({ getAllJobStates: vi.fn() }));
vi.mock('$lib/services/jobStateStore.js', () => ({ jobStateStore: store }));

import { GET } from './+server';

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

beforeEach(() => {
  store.getAllJobStates.mockReset();
});

describe('GET /api/job-monitor', () => {
  it('reports overdue and upcoming scheduled jobs in the envelope', async () => {
    store.getAllJobStates.mockResolvedValue([
      { name: 'late', status: 'scheduled', scheduledFor: minutesFromNow(-30) },
      { name: 'soon', status: 'scheduled', scheduledFor: minutesFromNow(10) },
      { name: 'done', status: 'completed', scheduledFor: minutesFromNow(-90) }
    ]);

    const response = await GET({} as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, totalJobs: 3, scheduledJobs: 2, overdueJobs: 1 });
    expect(body.overdue).toEqual([{ name: 'late', scheduledFor: expect.any(String), delayMinutes: expect.any(Number) }]);
    expect(body.overdue[0].delayMinutes).toBeGreaterThanOrEqual(29);
    expect(body.upcoming.map((job: { name: string }) => job.name)).toEqual(['late', 'soon']);
    expect(body.data.overdueJobs).toBe(1);
  });

  it('returns a generic 500 without the store error text', async () => {
    store.getAllJobStates.mockRejectedValue(new Error('Dapr at 10.0.0.5 refused'));

    const response = await GET({} as never);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to read job state' });
  });
});
