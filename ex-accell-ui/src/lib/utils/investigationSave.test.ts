import { afterEach, describe, expect, it, vi } from 'vitest';
import { FORBIDDEN_MESSAGE, saveInvestigation } from './investigationSave';

const notes = [{ id: 'a', text: 'note', timestamp: 't' }];

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve(body) });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const sentBody = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse(fetchMock.mock.calls[0][1].body);

afterEach(() => vi.unstubAllGlobals());

describe('saveInvestigation', () => {
  it('patches only the id and notes when no query is given', async () => {
    const fetchMock = stubFetch(200, { success: true });

    const outcome = await saveInvestigation({ id: '5', annotations: notes });

    expect(outcome).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/investigations');
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    expect(sentBody(fetchMock)).toEqual({ id: '5', annotations: notes });
  });

  it('adds keywords and dates to the stored query when asked, keeping its other settings', async () => {
    const fetchMock = stubFetch(200, { success: true });

    await saveInvestigation({
      id: '5',
      annotations: notes,
      queryConfig: { base: { sources: ['gdelt'], keywords: ['old'] }, keywords: ['new'], dateStart: '2026-01-01', dateEnd: '2026-01-31' }
    });

    expect(sentBody(fetchMock).query_config).toEqual({ sources: ['gdelt'], keywords: ['new'], dateStart: '2026-01-01', dateEnd: '2026-01-31' });
  });

  it('explains a refusal (403) in terms the visitor can act on', async () => {
    stubFetch(403, { success: false, error: 'forbidden' });

    const outcome = await saveInvestigation({ id: '5', annotations: notes });

    expect(outcome).toMatchObject({ ok: false, message: FORBIDDEN_MESSAGE });
  });

  it('fails without a message for other errors, an unsuccessful body or a network failure', async () => {
    stubFetch(500, null);
    expect(await saveInvestigation({ id: '5', annotations: notes })).toMatchObject({ ok: false, message: '' });

    stubFetch(200, { success: false, error: 'nope' });
    const failed = await saveInvestigation({ id: '5', annotations: notes });
    expect(failed).toMatchObject({ ok: false, message: '' });
    expect((failed as { error: Error }).error.message).toBe('nope');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await saveInvestigation({ id: '5', annotations: notes })).toMatchObject({ ok: false, message: '' });
  });
});
