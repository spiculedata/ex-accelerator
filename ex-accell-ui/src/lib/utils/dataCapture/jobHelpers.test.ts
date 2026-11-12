import { describe, it, expect } from 'vitest';
import { applyJobStateUpdate, isNearBottom, parseTabParam, selectJobsToPoll } from './jobList';
import { parseNewUrls, readRunError } from './jobRequests';
import type { UiJob } from './types';

describe('applyJobStateUpdate', () => {
  const job: UiJob = { id: 'j', name: 'n', status: 'running', lastLogCount: 2, keep: 'me' };
  const updated = {
    status: 'running',
    jobData: { maxPosts: 100 },
    result: { itemsProcessed: 50 },
    executionLog: ['a', 'b', 'c']
  };

  it('merges the new state and flags new logs', () => {
    const next = applyJobStateUpdate(job, updated);
    expect(next).toMatchObject({
      keep: 'me',
      status: 'running',
      progress: 50,
      itemsCollected: 50,
      logs: ['a', 'b', 'c'],
      lastLogCount: 3,
      hasNewLogs: true
    });
    expect(next.stateData).toBe(updated);
    expect(next).not.toBe(job);
  });

  it('does not flag new logs when the count is unchanged', () => {
    expect(applyJobStateUpdate({ ...job, lastLogCount: 3 }, updated).hasNewLogs).toBe(false);
  });

  it('handles a state without result or log', () => {
    const next = applyJobStateUpdate(job, { status: 'failed', jobData: {} });
    expect(next).toMatchObject({ itemsCollected: 0, logs: [], lastLogCount: 0, progress: 0, hasNewLogs: false });
  });
});

describe('selectJobsToPoll', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  const jobs: UiJob[] = [
    { id: 'run', name: 'run', status: 'running' },
    { id: 'fresh', name: 'fresh', status: 'completed', stateData: { updatedAt: '2026-01-01T11:58:00Z' } },
    { id: 'stale', name: 'stale', status: 'failed', stateData: { updatedAt: '2026-01-01T11:00:00Z' } },
    { id: 'sched', name: 'sched', status: 'scheduled', startTime: '2026-01-01T11:59:00Z' },
    { id: 'startOnly', name: 's', status: 'completed', startTime: '2026-01-01T11:57:00Z' }
  ];

  it('returns running jobs and recently finished ones only', () => {
    expect(selectJobsToPoll(jobs, now).map((j) => j.id)).toEqual(['run', 'fresh', 'startOnly']);
  });

  it('is empty when nothing is active', () => {
    expect(selectJobsToPoll([jobs[2], jobs[3]], now)).toEqual([]);
  });
});

describe('parseTabParam', () => {
  it('accepts known tabs', () => {
    expect(parseTabParam('?tab=wavepulse')).toBe('wavepulse');
    expect(parseTabParam('?x=1&tab=princeton-smart')).toBe('princeton-smart');
  });

  it('ignores missing or unknown tabs', () => {
    expect(parseTabParam('')).toBeNull();
    expect(parseTabParam('?tab=bogus')).toBeNull();
  });
});

describe('isNearBottom', () => {
  it('is true within 50px of the bottom and false above', () => {
    expect(isNearBottom({ scrollTop: 450, clientHeight: 100, scrollHeight: 600 })).toBe(true);
    expect(isNearBottom({ scrollTop: 0, clientHeight: 100, scrollHeight: 600 })).toBe(false);
  });
});

describe('parseNewUrls', () => {
  it('keeps trimmed http lines that are not already present', () => {
    const content = ' https://a.test \n\nftp://x\nhttps://b.test\nhttps://c.test';
    expect(parseNewUrls(content, ['https://b.test'])).toEqual(['https://a.test', 'https://c.test']);
  });
});

describe('readRunError', () => {
  it('reads a JSON error message', async () => {
    const response = new Response(JSON.stringify({ message: 'boom' }), { status: 500 });
    expect(await readRunError(response)).toBe('boom');
  });

  it('keeps the status line when JSON has no known field', async () => {
    const response = new Response(JSON.stringify({ other: 1 }), { status: 502 });
    expect(await readRunError(response)).toBe('Failed to submit job: 502');
  });

  it('falls back to the status line when the body is not JSON', async () => {
    // Reading the body as JSON consumes it, so the text fallback cannot re-read it
    const response = new Response('plain failure', { status: 500, statusText: 'Server Error' });
    expect(await readRunError(response)).toBe('Failed to submit job: 500 Server Error');
  });
});
