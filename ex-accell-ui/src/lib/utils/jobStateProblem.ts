import { extractCommand } from './commandHint';

export interface JobStateProblem {
  title: string;
  detail: string;
  /** A command to run, shown with a Copy button */
  command?: string;
}

const DEFAULT_COMMAND = 'npm run dev:dapr';

/** Turns a failed job-state request into something a person can act on. Server detail is never shown as is. */
export function describeJobStateFailure(status: number, body: { message?: string } | null): JobStateProblem {
  if (status === 503) {
    return {
      title: 'The job service is not running',
      detail: 'Crawl jobs are scheduled through Dapr, which is not reachable, so job history cannot be shown. Start it, then try again.',
      command: extractCommand(body?.message ?? '') ?? DEFAULT_COMMAND
    };
  }
  return {
    title: 'We could not load crawl jobs',
    detail: 'Something went wrong on the server. Try again in a moment.'
  };
}
