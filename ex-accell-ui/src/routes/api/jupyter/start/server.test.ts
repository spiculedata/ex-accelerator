import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JupyterNotSetUpError } from '$lib/server/jupyterManager';

const ensureJupyter = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/jupyterRuntime', () => ({ ensureJupyter }));

import { POST } from './+server';

const call = () => POST({ url: new URL('http://localhost:5173/api/jupyter/start') } as Parameters<typeof POST>[0]);

describe('POST /api/jupyter/start', () => {
	beforeEach(() => {
		ensureJupyter.mockReset();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('returns the access details in the envelope', async () => {
		ensureJupyter.mockResolvedValue({ url: 'u', baseUrl: 'b', message: 'running' });
		const response = await call();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true, message: 'running', data: { url: 'u', baseUrl: 'b' } });
	});

	it('answers 409 when the bootstrap has not been run', async () => {
		ensureJupyter.mockRejectedValue(new JupyterNotSetUpError());
		const response = await call();
		expect(response.status).toBe(409);
		expect((await response.json()).error).toMatch(/jupyter:bootstrap/);
	});

	it('answers 503 for other launch failures', async () => {
		ensureJupyter.mockRejectedValue(new Error('did not become ready in time'));
		expect((await call()).status).toBe(503);
	});
});
