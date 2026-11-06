import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseDatabaseService } from './baseDatabaseService';
import type { DatabaseServiceConfig, QueryOptions } from './baseDatabaseService';
import { createFetchMock, createFetchError, createNetworkError } from '../../test/mocks/fetchMock';
import { get } from 'svelte/store';
import { apiErrors, dismissApiErrors } from '$lib/stores/apiErrors';

// Concrete subclass for testing the abstract base class
class TestService extends BaseDatabaseService {
  constructor(config: Partial<DatabaseServiceConfig> & { serviceName: string } = { serviceName: 'TestService' }) {
    super(config);
  }

  // Expose protected methods for testing
  public async publicQueryAPI<T>(options: QueryOptions) {
    return this.queryAPI<T>(options);
  }

  public publicSafeTransform<TInput, TOutput>(
    data: TInput[],
    transformer: (item: TInput, index: number) => TOutput,
    defaultValue: TOutput[] = []
  ) {
    return this.safeTransform(data, transformer, defaultValue);
  }

  public async publicQueryMultiple<T>(queries: QueryOptions[]) {
    return this.queryMultiple<T>(queries);
  }

  public async publicExecuteQuery<T>(sql: string, params?: any[]) {
    return this.executeQuery<T>(sql, params);
  }
}

// Subclass with a failing testConnection for retry testing
class FailingConnectionService extends BaseDatabaseService {
  public connectAttempts = 0;

  constructor(config?: Partial<DatabaseServiceConfig> & { serviceName: string }) {
    super(config || { serviceName: 'FailingService', retryDelay: 1 });
  }

  protected async testConnection(): Promise<void> {
    this.connectAttempts++;
    throw new Error('Connection refused');
  }

  public async publicQueryAPI<T>(options: QueryOptions) {
    return this.queryAPI<T>(options);
  }
}

describe('BaseDatabaseService', () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
    vi.stubGlobal('fetch', createFetchMock({}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Constructor ───────────────────────────────────────────────────

  describe('constructor', () => {
    it('should set serviceName from config', () => {
      const svc = new TestService({ serviceName: 'MyService' });
      expect(svc.getConfig().serviceName).toBe('MyService');
    });

    it('should default apiEndpoint to /api/unified-analytics', () => {
      expect(service.getConfig().apiEndpoint).toBe('/api/unified-analytics');
    });

    it('should allow overriding apiEndpoint', () => {
      const svc = new TestService({ serviceName: 'Test', apiEndpoint: '/api/custom' });
      expect(svc.getConfig().apiEndpoint).toBe('/api/custom');
    });

    it('should default autoConnect to false', () => {
      expect(service.getConfig().autoConnect).toBe(false);
    });

    it('should default retryAttempts to 2', () => {
      expect(service.getConfig().retryAttempts).toBe(2);
    });

    it('should default retryDelay to 1000', () => {
      expect(service.getConfig().retryDelay).toBe(1000);
    });

    it('should not be connected initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should trigger auto-connect when autoConnect is true', async () => {
      const svc = new TestService({ serviceName: 'AutoConnect', autoConnect: true });
      // Allow the auto-connect promise to resolve
      await vi.waitFor(() => expect(svc.isConnected()).toBe(true));
    });
  });

  // ─── connect() ────────────────────────────────────────────────────

  describe('connect()', () => {
    it('should set connected state to true', async () => {
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should be idempotent when already connected', async () => {
      await service.connect();
      await service.connect(); // second call should return early
      expect(service.isConnected()).toBe(true);
    });

    it('should retry on connection failure then mark initialized', async () => {
      const failing = new FailingConnectionService({
        serviceName: 'FailRetry',
        retryDelay: 1,
      });

      await failing.connect();

      // maxConnectionAttempts is 3, so it should attempt 3 times
      expect(failing.connectAttempts).toBe(3);
      // Still marks as initialized to prevent infinite loops
      expect(failing.isConnected()).toBe(true);
    });
  });

  // ─── queryAPI() ───────────────────────────────────────────────────

  describe('queryAPI()', () => {
    it('should build correct URL with endpoint as type param', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true, data: [{ id: 1 }] }),
      }));
      vi.stubGlobal('fetch', mockFetch);

      await service.connect();
      await service.publicQueryAPI({ endpoint: 'sentiment-data' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/unified-analytics?');
      expect(calledUrl).toContain('type=sentiment-data');
    });

    it('should append additional params to URL', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true, data: [] }),
      }));
      vi.stubGlobal('fetch', mockFetch);

      await service.connect();
      await service.publicQueryAPI({
        endpoint: 'test',
        params: { platform: 'twitter', limit: 10 },
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('platform=twitter');
      expect(calledUrl).toContain('limit=10');
    });

    it('should skip null and undefined params', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true, data: [] }),
      }));
      vi.stubGlobal('fetch', mockFetch);

      await service.connect();
      await service.publicQueryAPI({
        endpoint: 'test',
        params: { included: 'yes', excluded: null, alsoExcluded: undefined },
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('included=yes');
      expect(calledUrl).not.toContain('excluded');
      expect(calledUrl).not.toContain('alsoExcluded');
    });

    it('should return data on successful response', async () => {
      const mockData = [{ id: 1, name: 'test' }, { id: 2, name: 'test2' }];
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true, data: mockData }),
      }));
      vi.stubGlobal('fetch', mockFetch);

      await service.connect();
      const result = await service.publicQueryAPI({ endpoint: 'my-data' });
      expect(result).toEqual(mockData);
    });

    it('should return empty array when response.ok is false', async () => {
      vi.stubGlobal('fetch', createFetchError(500, 'Internal Server Error'));

      await service.connect();
      const result = await service.publicQueryAPI({ endpoint: 'failing' });
      expect(result).toEqual([]);
    });

    it('should return empty array when success is false in body', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: false, error: 'Query failed' }),
      }));
      vi.stubGlobal('fetch', mockFetch);

      await service.connect();
      const result = await service.publicQueryAPI({ endpoint: 'bad-query' });
      expect(result).toEqual([]);
    });

    it('should return empty array on network failure', async () => {
      vi.stubGlobal('fetch', createNetworkError());

      await service.connect();
      const result = await service.publicQueryAPI({ endpoint: 'network-fail' });
      expect(result).toEqual([]);
    });

    it('should return empty array when data is missing from response', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true }),
      }));
      vi.stubGlobal('fetch', mockFetch);

      await service.connect();
      const result = await service.publicQueryAPI({ endpoint: 'no-data' });
      expect(result).toEqual([]);
    });

    describe('reporting failures to the user', () => {
      beforeEach(() => dismissApiErrors());

      it('reports an HTTP failure so the UI can tell the user', async () => {
        vi.stubGlobal('fetch', createFetchError(500, 'Internal Server Error'));

        await service.connect();
        await service.publicQueryAPI({ endpoint: 'failing' });

        expect(get(apiErrors)).toEqual([
          expect.objectContaining({ source: 'TestService: failing', message: expect.stringContaining('500') })
        ]);
      });

      it('reports a failure returned in the response body', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ success: false, error: 'Query failed' }) })));

        await service.connect();
        await service.publicQueryAPI({ endpoint: 'bad-query' });

        expect(get(apiErrors)[0]).toMatchObject({ source: 'TestService: bad-query', message: 'Query failed' });
      });

      it('clears the report once the same query succeeds again', async () => {
        vi.stubGlobal('fetch', createFetchError(500, 'Internal Server Error'));
        await service.connect();
        await service.publicQueryAPI({ endpoint: 'flaky' });
        expect(get(apiErrors)).toHaveLength(1);

        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, data: [{ id: 1 }] }) })));
        await service.publicQueryAPI({ endpoint: 'flaky' });

        expect(get(apiErrors)).toEqual([]);
      });

      it('does not report an unavailable module (an empty, flagged success) as an error', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, data: [], meta: { unavailable: true } }) })));

        await service.connect();
        await service.publicQueryAPI({ endpoint: 'unused-module' });

        expect(get(apiErrors)).toEqual([]);
      });

      it('reports a failed raw SQL query too', async () => {
        vi.stubGlobal('fetch', createNetworkError());

        await service.connect();
        await service.publicExecuteQuery('SELECT 1');

        expect(get(apiErrors)[0]).toMatchObject({ source: 'TestService: SQL query' });
      });
    });

    it('should auto-connect if not initialized', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true, data: [{ x: 1 }] }),
      }));
      vi.stubGlobal('fetch', mockFetch);

      expect(service.isConnected()).toBe(false);
      const result = await service.publicQueryAPI({ endpoint: 'auto' });
      expect(service.isConnected()).toBe(true);
      expect(result).toEqual([{ x: 1 }]);
    });

    it('should use custom apiEndpoint in URL', async () => {
      const svc = new TestService({ serviceName: 'Custom', apiEndpoint: '/api/custom' });
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true, data: [] }),
      }));
      vi.stubGlobal('fetch', mockFetch);

      await svc.connect();
      await svc.publicQueryAPI({ endpoint: 'test' });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/custom?');
    });
  });

  // ─── safeTransform() ─────────────────────────────────────────────

  describe('safeTransform()', () => {
    it('should transform items correctly', () => {
      const input = [{ value: 1 }, { value: 2 }, { value: 3 }];
      const result = service.publicSafeTransform(
        input,
        (item) => item.value * 2
      );
      expect(result).toEqual([2, 4, 6]);
    });

    it('should pass index to transformer', () => {
      const input = ['a', 'b', 'c'];
      const result = service.publicSafeTransform(
        input,
        (item, index) => `${index}:${item}`
      );
      expect(result).toEqual(['0:a', '1:b', '2:c']);
    });

    it('should return fallback on transformer error', () => {
      const input = [{ nested: { deep: 1 } }, null as any];
      const fallback = [{ safe: true }];
      const result = service.publicSafeTransform(
        input,
        (item) => {
          // This will throw on the null item
          return item.nested.deep;
        },
        fallback
      );
      expect(result).toEqual(fallback);
    });

    it('should return default empty array fallback on error', () => {
      const result = service.publicSafeTransform(
        [null as any],
        (item) => item.nonexistent.property
      );
      expect(result).toEqual([]);
    });

    it('should handle empty array input', () => {
      const result = service.publicSafeTransform(
        [],
        (item: any) => item.value
      );
      expect(result).toEqual([]);
    });
  });

  // ─── queryMultiple() ──────────────────────────────────────────────

  describe('queryMultiple()', () => {
    it('should execute multiple queries in parallel and return all results', async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async (url: string) => {
        callCount++;
        const data = url.includes('type=query-a')
          ? [{ id: 'a' }]
          : [{ id: 'b' }];
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ success: true, data }),
        };
      });
      vi.stubGlobal('fetch', mockFetch);

      await service.connect();
      const results = await service.publicQueryMultiple([
        { endpoint: 'query-a' },
        { endpoint: 'query-b' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual([{ id: 'a' }]);
      expect(results[1]).toEqual([{ id: 'b' }]);
    });

    it('should return empty array for failed queries while succeeding others', async () => {
      let callIndex = 0;
      const mockFetch = vi.fn(async () => {
        callIndex++;
        if (callIndex === 1) {
          // First query succeeds
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ success: true, data: [{ result: 'ok' }] }),
          };
        }
        // Second query: API returns success:false (which queryAPI catches and returns [])
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ success: false, error: 'Bad query' }),
        };
      });
      vi.stubGlobal('fetch', mockFetch);

      await service.connect();
      const results = await service.publicQueryMultiple([
        { endpoint: 'good' },
        { endpoint: 'bad' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual([{ result: 'ok' }]);
      // queryAPI returns [] on failure, and queryMultiple wraps that
      expect(results[1]).toEqual([]);
    });

    it('should handle empty queries array', async () => {
      await service.connect();
      const results = await service.publicQueryMultiple([]);
      expect(results).toEqual([]);
    });
  });

  // ─── isConnected() / getConfig() ─────────────────────────────────

  describe('isConnected()', () => {
    it('should return false before connect', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should return true after connect', async () => {
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should return false after close', async () => {
      await service.connect();
      await service.close();
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('getConfig()', () => {
    it('should return a copy of the config', () => {
      const config = service.getConfig();
      expect(config.serviceName).toBe('TestService');
      expect(config.apiEndpoint).toBe('/api/unified-analytics');
      expect(config.autoConnect).toBe(false);
      expect(config.retryAttempts).toBe(2);
      expect(config.retryDelay).toBe(1000);
    });

    it('should return a frozen snapshot (modifying the copy does not affect service)', () => {
      const config1 = service.getConfig();
      (config1 as any).serviceName = 'Modified';
      const config2 = service.getConfig();
      expect(config2.serviceName).toBe('TestService');
    });
  });

  // ─── close() ──────────────────────────────────────────────────────

  describe('close()', () => {
    it('should reset initialized state', async () => {
      await service.connect();
      expect(service.isConnected()).toBe(true);
      await service.close();
      expect(service.isConnected()).toBe(false);
    });
  });

  // ─── executeQuery() ───────────────────────────────────────────────

  describe('executeQuery()', () => {
    it('should POST SQL to the query endpoint', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true, data: [{ count: 42 }] }),
      }));
      vi.stubGlobal('fetch', mockFetch);

      await service.connect();
      const result = await service.publicExecuteQuery('SELECT COUNT(*) as count FROM posts');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/unified-analytics/query',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.sql).toBe('SELECT COUNT(*) as count FROM posts');
      expect(body.params).toEqual([]);
      expect(result).toEqual([{ count: 42 }]);
    });

    it('should return empty array on HTTP error', async () => {
      vi.stubGlobal('fetch', createFetchError(400, 'Bad Request'));

      await service.connect();
      const result = await service.publicExecuteQuery('INVALID SQL');
      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      vi.stubGlobal('fetch', createNetworkError());

      await service.connect();
      const result = await service.publicExecuteQuery('SELECT 1');
      expect(result).toEqual([]);
    });
  });
});
