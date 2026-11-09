import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  availableProjects,
  currentProject,
  setCurrentProject,
  loadCurrentProject,
  projectNotice,
  clearCurrentProject,
  type Project
} from './projectStore';

// Mock localStorage
const localStorageMock = (() => {
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

vi.stubGlobal('localStorage', localStorageMock);

function mockFetch(data: any, ok = true) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error'
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  localStorageMock.clear();
  currentProject.set(null);
  availableProjects.set([]);
  projectNotice.set(null);
});

describe('projectStore', () => {
  describe('availableProjects', () => {
    it('initializes as empty array', () => {
      expect(get(availableProjects)).toEqual([]);
    });

    it('can be updated with projects', () => {
      const projects: Project[] = [
        { id: '1', name: 'P1', description: '', type: 'general', status: 'active', createdAt: '', updatedAt: '', dataSources: [], totalPosts: 0, teamMembers: [], owner: '' }
      ];
      availableProjects.set(projects);
      expect(get(availableProjects)).toHaveLength(1);
      expect(get(availableProjects)[0].name).toBe('P1');
    });
  });

  describe('currentProject', () => {
    it('initializes as null', () => {
      expect(get(currentProject)).toBeNull();
    });
  });

  describe('setCurrentProject', () => {
    it('fetches project from API and sets store on success', async () => {
      mockFetch({
        success: true,
        project: {
          id: 42,
          name: 'Test Project',
          description: 'A test',
          project_type: 'social-media',
          status: 'active',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          total_data_sources: 5,
          member_count: 3,
          created_by: 'tom'
        }
      });

      const result = await setCurrentProject('42');
      expect(result).toBe(true);

      const project = get(currentProject);
      expect(project).not.toBeNull();
      expect(project!.id).toBe('42');
      expect(project!.name).toBe('Test Project');
      expect(project!.type).toBe('social-media');
      expect(project!.totalPosts).toBe(5);
      expect(project!.teamMembers).toHaveLength(3);
      expect(project!.owner).toBe('tom');
    });

    it('persists project id to localStorage', async () => {
      mockFetch({ success: true, project: { id: 7, name: 'P', description: '', project_type: 'general', status: 'active' } });
      await setCurrentProject('7');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('currentProject', '7');
    });

    it('returns false when API returns success: false', async () => {
      mockFetch({ success: false });
      const result = await setCurrentProject('999');
      expect(result).toBe(false);
      expect(get(currentProject)).toBeNull();
    });

    it('returns false when fetch throws', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const result = await setCurrentProject('1');
      expect(result).toBe(false);
    });

    it('normalizes missing fields with defaults', async () => {
      mockFetch({ success: true, project: { id: 1, name: 'Minimal' } });
      await setCurrentProject('1');
      const p = get(currentProject)!;
      expect(p.description).toBe('');
      expect(p.type).toBe('general');
      expect(p.status).toBe('active');
      expect(p.teamMembers).toEqual([]);
      expect(p.owner).toBe('');
    });
  });

  describe('loadCurrentProject', () => {
    it('loads saved project from localStorage', async () => {
      localStorageMock.setItem('currentProject', '10');
      mockFetch({ success: true, project: { id: 10, name: 'Saved' } });

      const result = await loadCurrentProject();
      expect(result).toBe(true);
      expect(get(currentProject)!.id).toBe('10');
    });

    it('auto-selects first project when none saved', async () => {
      const fetchMock = vi.fn()
        // First call: list projects
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, projects: [{ id: 1 }, { id: 2 }] })
        })
        // Second call: load project by id
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, project: { id: 1, name: 'First' } })
        });
      vi.stubGlobal('fetch', fetchMock);

      const result = await loadCurrentProject();
      expect(result).toBe(true);
      expect(get(currentProject)!.name).toBe('First');
    });

    it('returns false when no projects available and none saved', async () => {
      mockFetch({ success: true, projects: [] });
      const result = await loadCurrentProject();
      expect(result).toBe(false);
    });

    it('returns false when API call for project list fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
      const result = await loadCurrentProject();
      expect(result).toBe(false);
    });
  });

  describe('clearCurrentProject', () => {
    it('sets store to null and removes from localStorage', async () => {
      mockFetch({ success: true, project: { id: 1, name: 'X' } });
      await setCurrentProject('1');
      expect(get(currentProject)).not.toBeNull();

      clearCurrentProject();
      expect(get(currentProject)).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('currentProject');
    });
  });

  describe('a saved project that is no longer available', () => {
    const reply = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) });

    it('forgets the stale id, falls back to the first project and says so', async () => {
      localStorageMock.setItem('currentProject', '99');
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(reply({ success: false, error: 'Project not found' })) // saved id
        .mockResolvedValueOnce(reply({ success: true, projects: [{ id: 1 }] })) // list
        .mockResolvedValueOnce(reply({ success: true, project: { id: 1, name: 'Marlow' } }))); // first project

      expect(await loadCurrentProject()).toBe(true);
      expect(get(currentProject)!.id).toBe('1');
      expect(localStorageMock.getItem('currentProject')).toBe('1');
      expect(get(projectNotice)).toContain('Marlow');
    });

    it('keeps the saved id when the server cannot be reached, so a blip does not change the project', async () => {
      localStorageMock.setItem('currentProject', '10');
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

      expect(await loadCurrentProject()).toBe(false);
      expect(localStorageMock.getItem('currentProject')).toBe('10');
      expect(get(projectNotice)).toBeNull();
    });

    it('stays quiet when the saved project loads', async () => {
      localStorageMock.setItem('currentProject', '10');
      mockFetch({ success: true, project: { id: 10, name: 'Saved' } });
      await loadCurrentProject();
      expect(get(projectNotice)).toBeNull();
    });
  });
});
