import { vi } from 'vitest';

type EndpointMap = Record<string, unknown>;

/**
 * Create a fetch mock that routes by endpoint query parameter.
 * Usage: vi.stubGlobal('fetch', createFetchMock({ 'cross-platform-sentiment': [...data] }))
 */
export function createFetchMock(endpoints: EndpointMap) {
  return vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    const parsed = new URL(urlStr, 'http://localhost');
    const endpoint = parsed.searchParams.get('endpoint') || '';

    if (endpoint in endpoints) {
      return createJsonResponse({ success: true, data: endpoints[endpoint] });
    }

    // Check for partial URL match (for non-unified-analytics endpoints)
    for (const [key, value] of Object.entries(endpoints)) {
      if (urlStr.includes(key)) {
        return createJsonResponse(value);
      }
    }

    return createJsonResponse({ success: true, data: [] });
  });
}

/**
 * Create a fetch mock that always returns a specific error
 */
export function createFetchError(status: number, statusText: string = 'Error') {
  return vi.fn(async () => ({
    ok: false,
    status,
    statusText,
    json: async () => ({ success: false, error: statusText }),
    text: async () => statusText,
  }));
}

/**
 * Create a fetch mock that simulates a network error
 */
export function createNetworkError() {
  return vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });
}

/**
 * Create a delayed fetch response for testing timeouts
 */
export function createDelayedResponse(data: unknown, delayMs: number) {
  return vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return createJsonResponse({ success: true, data });
  });
}

function createJsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}
