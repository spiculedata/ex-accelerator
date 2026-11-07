import { describe, expect, it } from 'vitest';
import { jupyterLink, parseJupyterStart } from './jupyterClient';

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
