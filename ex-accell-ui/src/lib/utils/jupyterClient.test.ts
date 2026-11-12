import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJupyterStatus, initialJupyterPoll, jupyterLink, nextJupyterPoll, parseJupyterStart, parseJupyterStatus } from './jupyterClient';

describe('parseJupyterStart', () => {
	it('splits the server URL into base and token', () => {
		expect(parseJupyterStart({ success: true, data: { url: 'http://localhost:8888/?token=abc', baseUrl: 'http://localhost:8888' } })).toEqual({
			baseUrl: 'http://localhost:8888',
			token: 'abc'
		});
	});

	it('returns null for a failed or malformed response', () => {
		expect(parseJupyterStart({ success: false, data: null })).toBeNull();
		expect(parseJupyterStart({ success: true, data: { url: 'nope', baseUrl: 'x' } })).toBeNull();
		expect(parseJupyterStart(null)).toBeNull();
	});
});

describe('jupyterLink', () => {
	it('appends the token to a path', () => {
		expect(jupyterLink({ baseUrl: 'http://h:8888', token: 'a b' }, '/lab/tree/x.ipynb')).toBe('http://h:8888/lab/tree/x.ipynb?token=a+b');
	});

	it('returns an empty string without a connection', () => {
		expect(jupyterLink(null, '/lab')).toBe('');
	});

	it('keeps an existing query string', () => {
		expect(jupyterLink({ baseUrl: 'http://h:8888', token: 't' }, '/lab?reset')).toBe('http://h:8888/lab?reset=&token=t');
	});
});

describe('token round trip', () => {
	it('decodes a token that needed URL encoding', () => {
		const parsed = parseJupyterStart({ success: true, data: { url: 'http://j:8888/?token=a%2Fb%20c', baseUrl: 'http://j:8888' } });
		expect(parsed?.token).toBe('a/b c');
	});
});

describe('parseJupyterStatus', () => {
	it('reads a running Jupyter with its connection', () => {
		expect(parseJupyterStatus({ success: true, data: { state: 'running', url: 'http://localhost:8888/?token=abc', baseUrl: 'http://localhost:8888' } })).toEqual({
			observed: 'running',
			connection: { baseUrl: 'http://localhost:8888', token: 'abc' }
		});
	});

	it('reads starting and stopped without a connection', () => {
		expect(parseJupyterStatus({ success: true, data: { state: 'starting' } })).toEqual({ observed: 'starting', connection: null });
		expect(parseJupyterStatus({ success: true, data: { state: 'stopped' } })).toEqual({ observed: 'stopped', connection: null });
	});

	it('treats a failed, malformed or token-less response as an error', () => {
		expect(parseJupyterStatus(null)).toEqual({ observed: 'error', connection: null });
		expect(parseJupyterStatus({ success: false, data: null })).toEqual({ observed: 'error', connection: null });
		expect(parseJupyterStatus({ success: true, data: { state: 'running', url: 'nope', baseUrl: 'x' } })).toEqual({ observed: 'error', connection: null });
		expect(parseJupyterStatus({ success: true, data: { state: 'whatever' } })).toEqual({ observed: 'error', connection: null });
	});
});

describe('nextJupyterPoll', () => {
	it('starts stopped', () => {
		expect(initialJupyterPoll).toEqual({ phase: 'stopped', misses: 0 });
	});

	it('moves to running and starting as observed', () => {
		expect(nextJupyterPoll(initialJupyterPoll, 'running')).toEqual({ phase: 'running', misses: 0 });
		expect(nextJupyterPoll(initialJupyterPoll, 'starting')).toEqual({ phase: 'starting', misses: 0 });
	});

	it('keeps the embedded Jupyter through a single failed or stopped poll', () => {
		const running = nextJupyterPoll(initialJupyterPoll, 'running');
		expect(nextJupyterPoll(running, 'error')).toEqual({ phase: 'running', misses: 1 });
		expect(nextJupyterPoll(running, 'stopped')).toEqual({ phase: 'running', misses: 1 });
	});

	it('gives up after two misses in a row, and a good poll resets the count', () => {
		const running = nextJupyterPoll(initialJupyterPoll, 'running');
		const oneMiss = nextJupyterPoll(running, 'error');
		expect(nextJupyterPoll(oneMiss, 'error').phase).toBe('stopped');
		expect(nextJupyterPoll(nextJupyterPoll(oneMiss, 'running'), 'error')).toEqual({ phase: 'running', misses: 1 });
	});

	it('does not invent a running Jupyter from misses when it was not running', () => {
		expect(nextJupyterPoll(initialJupyterPoll, 'error').phase).toBe('stopped');
		expect(nextJupyterPoll({ phase: 'starting', misses: 0 }, 'stopped').phase).toBe('stopped');
	});
});

describe('fetchJupyterStatus', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('reads the status envelope', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: { state: 'starting' } }))));
		expect(await fetchJupyterStatus()).toEqual({ observed: 'starting', connection: null });
	});

	it('reports an error for a non-ok response, bad JSON or a network failure, never running', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 403 })));
		expect((await fetchJupyterStatus()).observed).toBe('error');
		vi.stubGlobal('fetch', vi.fn(async () => new Response('not json')));
		expect((await fetchJupyterStatus()).observed).toBe('error');
		vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
		expect((await fetchJupyterStatus()).observed).toBe('error');
	});
});
