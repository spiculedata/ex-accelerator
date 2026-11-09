/**
 * Wraps a task so that only one run is ever in flight. Requests that arrive during a run are collapsed
 * into a single follow-up run that starts when the current one ends. Because the task reads current state
 * when it runs, that follow-up always carries the latest data, and responses can never arrive out of
 * order. The returned promise settles when the run that was started for this call has finished.
 */
export function createSingleFlight(task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let again = false;

  async function loop(): Promise<void> {
    try {
      do {
        again = false;
        await task();
      } while (again);
    } finally {
      running = null;
    }
  }

  return () => {
    if (running) {
      again = true;
      return running;
    }
    running = loop();
    return running;
  };
}
