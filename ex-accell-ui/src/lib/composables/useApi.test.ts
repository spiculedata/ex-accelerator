import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient, api, apiGet, apiPost, apiPut, apiDelete } from './useApi';

function mockFetchResponse(body: any, opts: { ok?: boolean; status?: number; statusText?: string; contentType?: string } = {}) {
  const { ok = true, status = 200, statusText = 'OK', contentType = 'application/json' } = opts;
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText,
    headers: { get: (h: string) => h.toLowerCase() === 'content-type' ? contentType : null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body))
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useApi - createApiClient', () => {
  describe('GET requests', () => {
    it('makes a GET request and returns data', async () => {
      const fetchMock = mockFetchResponse({ success: true, data: [1, 2, 3] });
      const client = createApiClient();

      const result = await client.get('/api/items');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
      expect(fetchMock).toHaveBeenCalledWith('/api/items', expect.objectContaining({ method: 'GET' }));
    });

    it('appends query params to URL', async () => {
      const fetchMock = mockFetchResponse({ success: true });
      const client = createApiClient();

      await client.get('/api/items', { page: 1, limit: 10, active: true });
      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('limit=10');
      expect(calledUrl).toContain('active=true');
    });
  });

  describe('POST requests', () => {
    it('sends JSON body', async () => {
      const fetchMock = mockFetchResponse({ success: true, data: { id: 1 } });
      const client = createApiClient();

      const result = await client.post('/api/items', { name: 'New Item' });
      expect(result.success).toBe(true);

      const callOpts = fetchMock.mock.calls[0][1];
      expect(callOpts.method).toBe('POST');
      expect(callOpts.body).toBe(JSON.stringify({ name: 'New Item' }));
    });
  });

  describe('PUT requests', () => {
    it('sends PUT with body', async () => {
      const fetchMock = mockFetchResponse({ success: true });
      const client = createApiClient();

      await client.put('/api/items/1', { name: 'Updated' });
      expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    });
  });

  describe('DELETE requests', () => {
    it('sends DELETE request', async () => {
      const fetchMock = mockFetchResponse({ success: true });
      const client = createApiClient();

      await client.delete('/api/items/1');
      expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    });
  });

  describe('PATCH requests', () => {
    it('sends PATCH with body', async () => {
      const fetchMock = mockFetchResponse({ success: true });
      const client = createApiClient();

      await client.patch('/api/items/1', { status: 'done' });
      expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    });
  });

  describe('headers', () => {
    it('includes Content-Type: application/json by default', async () => {
      const fetchMock = mockFetchResponse({ success: true });
      const client = createApiClient();

      await client.get('/api/test');
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('merges base headers from client creation', async () => {
      const fetchMock = mockFetchResponse({ success: true });
      const client = createApiClient({ 'X-Custom': 'value' });

      await client.get('/api/test');
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers['X-Custom']).toBe('value');
    });

    it('merges per-request headers', async () => {
      const fetchMock = mockFetchResponse({ success: true });
      const client = createApiClient();

      await client.get('/api/test', undefined, { headers: { Authorization: 'Bearer tok' } });
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer tok');
    });
  });

  describe('error handling', () => {
    it('returns error on HTTP error response', async () => {
      mockFetchResponse({ error: 'Not Found' }, { ok: false, status: 404, statusText: 'Not Found' });
      const client = createApiClient();

      const result = await client.get('/api/missing');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not Found');
    });

    it('returns error on API success: false response', async () => {
      mockFetchResponse({ success: false, error: 'Validation failed' });
      const client = createApiClient();

      const result = await client.post('/api/items', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
    });

    it('returns error when fetch throws (network error)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
      const client = createApiClient();

      const result = await client.get('/api/test');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network down');
    });

    it('calls onError callback on failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Oops')));
      const client = createApiClient();
      const onError = vi.fn();

      await client.get('/api/test', undefined, { onError });
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('callbacks', () => {
    it('calls onSuccess callback on success', async () => {
      mockFetchResponse({ success: true, data: { id: 1 } });
      const client = createApiClient();
      const onSuccess = vi.fn();

      await client.get('/api/test', undefined, { onSuccess });
      expect(onSuccess).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('non-JSON responses', () => {
    it('handles plain text response', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('Hello World')
      });
      vi.stubGlobal('fetch', fetchMock);
      const client = createApiClient();

      const result = await client.get('/api/text');
      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello World');
    });
  });

  describe('timeout', () => {
    it('aborts request on timeout', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: any) => {
        return new Promise((_resolve, reject) => {
          // Simulate the abort signal firing
          if (opts.signal) {
            opts.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      }));

      const client = createApiClient();
      const result = await client.get('/api/slow', undefined, { timeout: 50 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });
});

describe('useApi - helper functions', () => {
  it('apiGet delegates to default client', async () => {
    mockFetchResponse({ success: true, data: 'ok' });
    const result = await apiGet('/api/test');
    expect(result.success).toBe(true);
  });

  it('apiPost delegates to default client', async () => {
    mockFetchResponse({ success: true });
    const result = await apiPost('/api/test', { x: 1 });
    expect(result.success).toBe(true);
  });

  it('apiPut delegates to default client', async () => {
    mockFetchResponse({ success: true });
    const result = await apiPut('/api/test', { x: 1 });
    expect(result.success).toBe(true);
  });

  it('apiDelete delegates to default client', async () => {
    mockFetchResponse({ success: true });
    const result = await apiDelete('/api/test');
    expect(result.success).toBe(true);
  });
});
