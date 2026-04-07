import { writable, derived, get } from 'svelte/store';

export interface WorkspaceContext {
  id: string;
  name: string;
  projectId: string;
}

export const currentWorkspace = writable<WorkspaceContext | null>(null);

// Derived store for just the ID (convenience for passing to services)
export const currentWorkspaceId = derived(currentWorkspace, ($ws) => $ws?.id || null);

/**
 * Set workspace from URL params. Fetches workspace details from API.
 */
export async function setWorkspaceFromUrl(url: URL): Promise<WorkspaceContext | null> {
  const wsId = url.searchParams.get('workspace');
  if (!wsId) return null;

  // Check if already set
  const current = get(currentWorkspace);
  if (current?.id === wsId) return current;

  try {
    const response = await fetch(`/api/workspaces?id=${wsId}`);
    const result = await response.json();
    if (result.success && result.workspace) {
      const ctx: WorkspaceContext = {
        id: result.workspace.id.toString(),
        name: result.workspace.name,
        projectId: result.workspace.project_id?.toString() || ''
      };
      currentWorkspace.set(ctx);

      // Persist to sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('currentWorkspace', JSON.stringify(ctx));
      }

      return ctx;
    }
  } catch (error) {
    console.error('Failed to load workspace context:', error);
  }
  return null;
}

/**
 * Restore workspace from sessionStorage (for page navigations).
 */
export function restoreWorkspace(): WorkspaceContext | null {
  if (typeof sessionStorage === 'undefined') return null;

  const saved = sessionStorage.getItem('currentWorkspace');
  if (saved) {
    try {
      const ctx = JSON.parse(saved) as WorkspaceContext;
      currentWorkspace.set(ctx);
      return ctx;
    } catch {
      // Invalid JSON
    }
  }
  return null;
}

/**
 * Clear workspace context.
 */
export function clearWorkspace() {
  currentWorkspace.set(null);
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('currentWorkspace');
  }
}
