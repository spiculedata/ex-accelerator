import { get, writable } from 'svelte/store';

export interface Project {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  dataSources: string[];
  totalPosts: number;
  teamMembers: string[];
  owner: string;
}

// Store for available projects (loaded from API)
export const availableProjects = writable<Project[]>([]);

// Current active project store
export const currentProject = writable<Project | null>(null);

// A one-line explanation shown when the project had to change by itself (for example a saved project was deleted)
export const projectNotice = writable<string | null>(null);

// Whether the last project lookup reached the server and found nothing, or could not reach it at all
let lastLookup: 'found' | 'missing' | 'unreachable' = 'found';

// Function to set the current project
export async function setCurrentProject(projectId: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      // Fetch project details from API
      const response = await fetch(`/api/projects?id=${projectId}`);
      const result = await response.json();

      if (result.success && result.project) {
        // Normalize the project data from database schema
        const project: Project = {
          id: result.project.id.toString(),
          name: result.project.name,
          description: result.project.description || '',
          type: result.project.project_type || 'general',
          status: result.project.status || 'active',
          createdAt: result.project.created_at || new Date().toISOString(),
          updatedAt: result.project.updated_at || new Date().toISOString(),
          dataSources: [], // TODO: Load from workspace data sources
          totalPosts: result.project.total_data_sources || 0,
          teamMembers: result.project.member_count ? Array(result.project.member_count).fill('member') : [],
          owner: result.project.created_by || ''
        };

        currentProject.set(project);
        // Persist to localStorage
        localStorage.setItem('currentProject', projectId);
        lastLookup = 'found';
        return true;
      }
      lastLookup = 'missing';
      return false;
    } catch (error) {
      console.error('Error loading project:', error);
      lastLookup = 'unreachable';
      return false;
    }
  }
  return false;
}

// Function to load project from localStorage on app init
// If no saved project, or the saved one no longer exists, selects the first available project
export async function loadCurrentProject(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const savedProjectId = localStorage.getItem('currentProject');
  if (savedProjectId) {
    if (await setCurrentProject(savedProjectId)) return true;
    // Only a project the server says is gone is stale; a failed request must not change anything
    if (lastLookup !== 'missing') return false;
    localStorage.removeItem('currentProject');
  }

  const selected = await selectFirstProject();
  if (selected && savedProjectId) {
    projectNotice.set(`Your previously selected project is no longer available, so ${selected} is open instead.`);
  }
  return selected !== null;
}

/** Opens the first project the user can see and returns its name, or null when there is none. */
async function selectFirstProject(): Promise<string | null> {
  try {
    const response = await fetch('/api/projects');
    const result = await response.json();
    if (result.success && result.projects && result.projects.length > 0) {
      if (await setCurrentProject(result.projects[0].id.toString())) return get(currentProject)?.name ?? '';
    }
  } catch (error) {
    console.error('Error auto-selecting project:', error);
  }
  return null;
}

// Function to clear current project
export function clearCurrentProject() {
  currentProject.set(null);
  if (typeof window !== 'undefined') {
    localStorage.removeItem('currentProject');
  }
}