import { beforeEach, describe, expect, it, vi } from 'vitest';

const jupyterStatus = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/jupyterRuntime', () => ({ jupyterStatus }));

import { GET } from './+server';

const call = () => GET({} as Parameters<typeof GET>[0]);

describe('GET /api/jupyter/status', () => {
	beforeEach(() => {
		jupyterStatus.mockReset();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('returns the status in the envelope', async () => {
		jupyterStatus.mockResolvedValue({ state: 'running', url: 'u', baseUrl: 'b' });
		const response = await call();
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(await response.json()).toEqual({ success: true, data: { state: 'running', url: 'u', baseUrl: 'b' } });
	});

	it('answers 503 with a generic message when the check itself fails', async () => {
		jupyterStatus.mockRejectedValue(new Error('EACCES /secret/path'));
		const response = await call();
		expect(response.status).toBe(503);
		expect(JSON.stringify(await response.json())).not.toContain('secret');
	});
});
