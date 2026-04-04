/**
 * Data Loading Composable
 *
 * Provides a reusable pattern for async data loading with loading states,
 * error handling, and automatic cleanup. Eliminates ~500 lines of
 * duplicate code across 15+ components.
 *
 * @example
 * ```typescript
 * const { loading, data, error, load, refresh } = createDataLoader(
 *   '/api/sentiment-analysis',
 *   {
 *     transform: (result) => result.data,
 *     onError: (err) => console.error('Failed:', err)
 *   }
 * );
 *
 * onMount(() => load());
 * ```
 */

export interface DataLoaderOptions<T, R = any> {
  /**
   * Transform function to convert API response to desired type
   */
  transform?: (response: R) => T;

  /**
   * Error callback for custom error handling
   */
  onError?: (error: Error) => void;

  /**
   * Success callback after data loads
   */
  onSuccess?: (data: T) => void;

  /**
   * Enable in-memory caching (default: false)
   */
  cache?: boolean;

  /**
   * Initial data value
   */
  initialData?: T | null;

  /**
   * Auto-load on creation (default: false)
   */
  autoLoad?: boolean;
}

export interface DataLoaderState<T> {
  /**
   * Current loading state
   */
  loading: boolean;

  /**
   * Loaded data (null if not yet loaded or error occurred)
   */
  data: T | null;

  /**
   * Error object if loading failed
   */
  error: Error | null;

  /**
   * Load data with optional query parameters
   */
  load: (params?: Record<string, string | number | boolean>) => Promise<void>;

  /**
   * Refresh data (re-run last load)
   */
  refresh: () => Promise<void>;

  /**
   * Reset to initial state
   */
  reset: () => void;

  /**
   * Manually set data (useful for optimistic updates)
   */
  setData: (data: T | null) => void;
}

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Create a data loader for async operations
 */
export function createDataLoader<T, R = any>(
  endpoint: string,
  options: DataLoaderOptions<T, R> = {}
): DataLoaderState<T> {
  let loading = $state(false);
  let data = $state<T | null>(options.initialData ?? null);
  let error = $state<Error | null>(null);
  let lastParams: Record<string, string | number | boolean> | undefined;

  /**
   * Get cache key from endpoint and params
   */
  function getCacheKey(params?: Record<string, string | number | boolean>): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${endpoint}:${paramStr}`;
  }

  /**
   * Check if cached data is still valid
   */
  function getCachedData(key: string): T | null {
    if (!options.cache) return null;

    const cached = cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > CACHE_TTL) {
      cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Store data in cache
   */
  function setCachedData(key: string, value: T): void {
    if (!options.cache) return;

    cache.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  /**
   * Load data from endpoint
   */
  async function load(params?: Record<string, string | number | boolean>): Promise<void> {
    // Save params for refresh
    lastParams = params;

    // Check cache first
    const cacheKey = getCacheKey(params);
    const cachedData = getCachedData(cacheKey);
    if (cachedData !== null) {
      data = cachedData;
      loading = false;
      error = null;
      return;
    }

    // Build URL with query params
    let url = endpoint;
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, String(value));
      });
      url = `${endpoint}?${queryParams.toString()}`;
    }

    loading = true;
    error = null;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Check for API error format
      if (result.success === false) {
        throw new Error(result.error || 'API request failed');
      }

      // Transform data if transformer provided
      const transformedData = options.transform ? options.transform(result) : result;

      // Update state
      data = transformedData;

      // Cache the data
      setCachedData(cacheKey, transformedData);

      // Call success callback
      options.onSuccess?.(transformedData);

    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      error = errorObj;
      data = null;

      // Call error callback
      options.onError?.(errorObj);

      console.error(`[DataLoader] Failed to load from ${endpoint}:`, errorObj);
    } finally {
      loading = false;
    }
  }

  /**
   * Refresh data using last params
   */
  async function refresh(): Promise<void> {
    // Clear cache for this endpoint
    if (lastParams !== undefined) {
      const cacheKey = getCacheKey(lastParams);
      cache.delete(cacheKey);
    }

    await load(lastParams);
  }

  /**
   * Reset to initial state
   */
  function reset(): void {
    loading = false;
    data = options.initialData ?? null;
    error = null;
    lastParams = undefined;
  }

  /**
   * Manually set data
   */
  function setData(newData: T | null): void {
    data = newData;
    error = null;
  }

  // Auto-load if requested
  if (options.autoLoad) {
    load();
  }

  return {
    get loading() { return loading; },
    get data() { return data; },
    get error() { return error; },
    load,
    refresh,
    reset,
    setData
  };
}

/**
 * Helper: Create a simple data loader without options
 */
export function useData<T>(endpoint: string, autoLoad = true): DataLoaderState<T> {
  return createDataLoader<T>(endpoint, { autoLoad });
}

/**
 * Helper: Create a data loader with transformation
 */
export function useTransformedData<T, R = any>(
  endpoint: string,
  transform: (response: R) => T,
  autoLoad = true
): DataLoaderState<T> {
  return createDataLoader<T, R>(endpoint, { transform, autoLoad });
}
