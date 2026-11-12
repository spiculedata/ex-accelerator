import { describe, it, expect } from 'vitest';
import { describeJobStateFailure } from './jobStateProblem';

describe('describeJobStateFailure', () => {
  it('explains that the job service is not running and gives the command from the server message', () => {
    const problem = describeJobStateFailure(503, { message: 'Job state service unavailable: connect ECONNREFUSED. Please start the unified deployment with: npm run dev:dapr' });

    expect(problem.title).toMatch(/job service/i);
    expect(problem.detail).toMatch(/crawl/i);
    expect(problem.command).toBe('npm run dev:dapr');
  });

  it('still names the job service for a 503 with no usable body', () => {
    const problem = describeJobStateFailure(503, null);

    expect(problem.title).toMatch(/job service/i);
    expect(problem.command).toBe('npm run dev:dapr');
  });

  it('gives a plain retry message for other failures, with no command', () => {
    const problem = describeJobStateFailure(500, { message: 'boom' });

    expect(problem.title).toMatch(/could not load/i);
    expect(problem.command).toBeUndefined();
    expect(JSON.stringify(problem)).not.toContain('boom');
  });

  it('reads the envelope error field and falls back to the default command for the server text', () => {
    const problem = describeJobStateFailure(503, { error: 'Job services unavailable. Please start the unified deployment with: npm run dev:dapr' });

    expect(problem.title).toMatch(/job service/i);
    expect(problem.command).toBe('npm run dev:dapr');
  });
});
