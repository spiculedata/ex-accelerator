import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  currentWorkspace,
  currentWorkspaceId,
  setWorkspaceFromUrl,
  restoreWorkspace,
  clearWorkspace,
  type WorkspaceContext
} from './workspaceStore';

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null)
  };
})();

vi.stubGlobal('sessionStorage', sessionStorageMock);

function mockFetch(data: any, ok = true) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data)
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  sessionStorageMock.clear();
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  currentWorkspace.set(null);
});

describe('workspaceStore', () => {
  describe('currentWorkspace', () => {
    it('initializes as null', () => {
      expect(get(currentWorkspace)).toBeNull();
    });
  });

  describe('currentWorkspaceId', () => {
    it('returns null when workspace is null', () => {
      expect(get(currentWorkspaceId)).toBeNull();
    });

    it('returns workspace id when workspace is set', () => {
      currentWorkspace.set({ id: 'ws-5', name: 'Test', projectId: 'p-1' });
      expect(get(currentWorkspaceId)).toBe('ws-5');
    });
  });

  describe('setWorkspaceFromUrl', () => {
    it('returns null when URL has no workspace param', async () => {
      const url = new URL('http://localhost/page');
      const result = await setWorkspaceFromUrl(url);
      expect(result).toBeNull();
    });

    it('fetches workspace from API and sets store', async () => {
      mockFetch({
        success: true,
        workspace: { id: 10, name: 'WS Alpha', project_id: 3 }
      });

      const url = new URL('http://localhost/page?workspace=10');
      const result = await setWorkspaceFromUrl(url);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('10');
      expect(result!.name).toBe('WS Alpha');
      expect(result!.projectId).toBe('3');

      const stored = get(currentWorkspace);
      expect(stored!.id).toBe('10');
    });

    it('persists workspace to sessionStorage', async () => {
      mockFetch({ success: true, workspace: { id: 1, name: 'WS', project_id: 2 } });
      const url = new URL('http://localhost/?workspace=1');
      await setWorkspaceFromUrl(url);

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'currentWorkspace',
        expect.any(String)
      );
      // Find the call that saved currentWorkspace
      const call = sessionStorageMock.setItem.mock.calls.find(
        (c: string[]) => c[0] === 'currentWorkspace'
      );
      const saved = JSON.parse(call![1]);
      expect(saved.id).toBe('1');
    });

    it('returns cached workspace if already set with same id', async () => {
      const ctx: WorkspaceContext = { id: '7', name: 'Cached', projectId: 'p-1' };
      currentWorkspace.set(ctx);

      const url = new URL('http://localhost/?workspace=7');
      const result = await setWorkspaceFromUrl(url);
      expect(result).toEqual(ctx);
      // fetch should NOT have been called
    });

    it('returns null when API returns success: false', async () => {
      mockFetch({ success: false });
      const url = new URL('http://localhost/?workspace=99');
      const result = await setWorkspaceFromUrl(url);
      expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
      const url = new URL('http://localhost/?workspace=1');
      const result = await setWorkspaceFromUrl(url);
      expect(result).toBeNull();
    });

    it('handles missing project_id gracefully', async () => {
      mockFetch({ success: true, workspace: { id: 5, name: 'No Project' } });
      const url = new URL('http://localhost/?workspace=5');
      const result = await setWorkspaceFromUrl(url);
      expect(result!.projectId).toBe('');
    });
  });

  describe('restoreWorkspace', () => {
    it('returns null when nothing saved', () => {
      const result = restoreWorkspace();
      expect(result).toBeNull();
    });

    it('restores workspace from sessionStorage', () => {
      const ctx: WorkspaceContext = { id: '3', name: 'Restored', projectId: 'p-2' };
      sessionStorageMock.setItem('currentWorkspace', JSON.stringify(ctx));

      const result = restoreWorkspace();
      expect(result).toEqual(ctx);
      expect(get(currentWorkspace)).toEqual(ctx);
    });

    it('returns null on invalid JSON in sessionStorage', () => {
      sessionStorageMock.setItem('currentWorkspace', 'not-json');
      const result = restoreWorkspace();
      expect(result).toBeNull();
    });
  });

  describe('clearWorkspace', () => {
    it('sets store to null and removes from sessionStorage', () => {
      currentWorkspace.set({ id: '1', name: 'W', projectId: 'p' });
      clearWorkspace();
      expect(get(currentWorkspace)).toBeNull();
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('currentWorkspace');
    });
  });
});
