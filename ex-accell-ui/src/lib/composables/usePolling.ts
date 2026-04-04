/**
 * Polling Composable
 *
 * Provides a reusable pattern for periodic data fetching with automatic
 * cleanup. Eliminates duplicate polling logic across 8+ components.
 *
 * Features:
 * - Automatic cleanup on component destroy
 * - Conditional polling (stop when condition met)
 * - Error handling with backoff
 * - Pause/resume functionality
 *
 * @example
 * ```typescript
 * const { start, stop, isActive } = createPoller(
 *   async () => {
 *     const data = await fetchJobStatus();
 *     if (data.status === 'completed') stop();
 *   },
 *   {
 *     interval: 2000,
 *     condition: () => isJobRunning,
 *     onError: (err) => console.error(err)
 *   }
 * );
 *
 * onMount(() => start());
 * ```
 */

import { onDestroy } from 'svelte';

export interface PollingOptions {
  /**
   * Polling interval in milliseconds (default: 2000)
   */
  interval?: number;

  /**
   * Condition to continue polling (default: always true)
   * When returns false, polling stops automatically
   */
  condition?: () => boolean;

  /**
   * Error callback
   */
  onError?: (error: Error) => void;

  /**
   * Auto-start polling on creation (default: false)
   */
  autoStart?: boolean;

  /**
   * Enable exponential backoff on errors (default: false)
   */
  backoff?: boolean;

  /**
   * Max backoff interval in milliseconds (default: 30000)
   */
  maxBackoff?: number;

  /**
   * Stop polling after first error (default: false)
   */
  stopOnError?: boolean;

  /**
   * Maximum number of poll attempts (default: Infinity)
   */
  maxAttempts?: number;
}

export interface PollerState {
  /**
   * Whether polling is currently active
   */
  isActive: boolean;

  /**
   * Number of successful polls
   */
  pollCount: number;

  /**
   * Number of consecutive errors
   */
  errorCount: number;

  /**
   * Start polling
   */
  start: () => void;

  /**
   * Stop polling
   */
  stop: () => void;

  /**
   * Pause polling (can be resumed)
   */
  pause: () => void;

  /**
   * Resume polling after pause
   */
  resume: () => void;

  /**
   * Reset poll/error counts
   */
  reset: () => void;
}

/**
 * Create a poller for periodic async operations
 */
export function createPoller(
  callback: () => Promise<void> | void,
  options: PollingOptions = {}
): PollerState {
  const {
    interval = 2000,
    condition = () => true,
    onError,
    autoStart = false,
    backoff = false,
    maxBackoff = 30000,
    stopOnError = false,
    maxAttempts = Infinity
  } = options;

  let intervalId: number | null = null;
  let isActive = $state(false);
  let isPaused = $state(false);
  let pollCount = $state(0);
  let errorCount = $state(0);
  let currentInterval = interval;

  /**
   * Calculate backoff interval
   */
  function getBackoffInterval(): number {
    if (!backoff) return interval;

    // Exponential backoff: interval * 2^errorCount
    const backoffInterval = interval * Math.pow(2, errorCount);
    return Math.min(backoffInterval, maxBackoff);
  }

  /**
   * Execute the polling callback
   */
  async function poll(): Promise<void> {
    // Check if we should continue polling
    if (!condition()) {
      stop();
      return;
    }

    // Check max attempts
    if (pollCount >= maxAttempts) {
      stop();
      return;
    }

    try {
      await callback();
      pollCount++;
      errorCount = 0; // Reset error count on success
      currentInterval = interval; // Reset to normal interval
    } catch (error) {
      errorCount++;
      const errorObj = error instanceof Error ? error : new Error(String(error));

      // Call error callback
      onError?.(errorObj);

      console.error('[Poller] Error during poll:', errorObj);

      // Stop on error if requested
      if (stopOnError) {
        stop();
        return;
      }

      // Update interval for backoff
      if (backoff) {
        currentInterval = getBackoffInterval();
      }
    }
  }

  /**
   * Start polling
   */
  function start(): void {
    if (intervalId !== null) {
      console.warn('[Poller] Already running');
      return;
    }

    isActive = true;
    isPaused = false;

    // Run first poll immediately
    poll();

    // Set up interval for subsequent polls
    intervalId = setInterval(() => {
      if (!isPaused) {
        poll();
      }
    }, currentInterval) as unknown as number;
  }

  /**
   * Stop polling
   */
  function stop(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }

    isActive = false;
    isPaused = false;
  }

  /**
   * Pause polling (keeps interval running but skips execution)
   */
  function pause(): void {
    if (!isActive) {
      console.warn('[Poller] Not running');
      return;
    }

    isPaused = true;
  }

  /**
   * Resume polling after pause
   */
  function resume(): void {
    if (!isActive) {
      console.warn('[Poller] Not running, use start() instead');
      return;
    }

    isPaused = false;
  }

  /**
   * Reset counters
   */
  function reset(): void {
    pollCount = 0;
    errorCount = 0;
    currentInterval = interval;
  }

  // Auto-start if requested
  if (autoStart) {
    start();
  }

  // Auto-cleanup on component destroy
  onDestroy(() => {
    stop();
  });

  return {
    get isActive() { return isActive; },
    get pollCount() { return pollCount; },
    get errorCount() { return errorCount; },
    start,
    stop,
    pause,
    resume,
    reset
  };
}

/**
 * Helper: Create a simple poller with auto-start
 */
export function usePoller(
  callback: () => Promise<void> | void,
  interval = 2000
): PollerState {
  return createPoller(callback, { interval, autoStart: true });
}

/**
 * Helper: Create a conditional poller
 */
export function useConditionalPoller(
  callback: () => Promise<void> | void,
  condition: () => boolean,
  interval = 2000
): PollerState {
  return createPoller(callback, { interval, condition, autoStart: true });
}

/**
 * Helper: Create a poller with backoff on errors
 */
export function useBackoffPoller(
  callback: () => Promise<void> | void,
  options: Omit<PollingOptions, 'backoff'> = {}
): PollerState {
  return createPoller(callback, { ...options, backoff: true });
}
