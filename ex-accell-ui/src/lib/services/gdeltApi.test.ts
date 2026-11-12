import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEventsQuery, fetchEventMentions, fetchGdeltEvents, fetchMentionsBatch } from './gdeltApi';

const fetchMock = vi.fn();
const reply = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Server Error', json: async () => body, text: async () => 'failure text' });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe('buildEventsQuery', () => {
  it('always sends the Goldstein range and sends dates only when set', () => {
    expect(buildEventsQuery([-10, 10], ['', '']).toString()).toBe('goldsteinMin=-10&goldsteinMax=10');
    expect(buildEventsQuery([-2.5, 4], ['2026-01-01', '']).toString()).toBe('goldsteinMin=-2.5&goldsteinMax=4&dateStart=2026-01-01');
    expect(buildEventsQuery([-10, 10], ['', '2026-02-01']).toString()).toBe('goldsteinMin=-10&goldsteinMax=10&dateEnd=2026-02-01');
  });
});

describe('fetchGdeltEvents', () => {
  it('returns the response and reports whether GDELT is unavailable', async () => {
    fetchMock.mockResolvedValue(reply({ events: [], unavailable: true }));
    const onUnavailable = vi.fn();
    const data = await fetchGdeltEvents([-10, 10], ['', ''], onUnavailable);
    expect(data.events).toEqual([]);
    expect(onUnavailable).toHaveBeenCalledWith(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/gdelt?goldsteinMin=-10&goldsteinMax=10');
  });

  it('throws with the status and body for a failed response', async () => {
    fetchMock.mockResolvedValue(reply({}, false));
    await expect(fetchGdeltEvents([-10, 10], ['', ''])).rejects.toThrow('HTTP 500: Server Error - failure text');
  });

  it('tells the caller about availability before throwing an error in the body', async () => {
    fetchMock.mockResolvedValue(reply({ error: 'bad', unavailable: false }));
    const onUnavailable = vi.fn();
    await expect(fetchGdeltEvents([-10, 10], ['', ''], onUnavailable)).rejects.toThrow('bad');
    expect(onUnavailable).toHaveBeenCalledWith(false);
  });
});

describe('mentions', () => {
  it('loads the mentions of one event', async () => {
    fetchMock.mockResolvedValue(reply({ mentions: [{ a: 1 }] }));
    expect(await fetchEventMentions(5)).toEqual([{ a: 1 }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/gdelt/mentions?eventId=5');
  });

  it('treats a missing mentions list as empty', async () => {
    fetchMock.mockResolvedValue(reply({}));
    expect(await fetchEventMentions(5)).toEqual([]);
  });

  it('throws the error the API reports', async () => {
    fetchMock.mockResolvedValue(reply({ error: 'Note: limited' }));
    await expect(fetchEventMentions(5)).rejects.toThrow('Note: limited');
  });

  it('posts the event ids for a batch', async () => {
    fetchMock.mockResolvedValue(reply({ mentions: [{ b: 2 }] }));
    expect(await fetchMentionsBatch([1, 2])).toEqual([{ b: 2 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/gdelt/mentions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ eventIds: [1, 2] });
  });

  it('throws for a failed batch', async () => {
    fetchMock.mockResolvedValue(reply({}, false));
    await expect(fetchMentionsBatch([1])).rejects.toThrow('HTTP 500');
  });
});
