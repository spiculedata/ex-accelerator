import { writable } from 'svelte/store';

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
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading project:', error);
      return false;
    }
  }
  return false;
}

// Function to load project from localStorage on app init
export async function loadCurrentProject(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const savedProjectId = localStorage.getItem('currentProject');
    if (savedProjectId) {
      return await setCurrentProject(savedProjectId);
    }
  }
  return false;
}

// Function to clear current project
export function clearCurrentProject() {
  currentProject.set(null);
  if (typeof window !== 'undefined') {
    localStorage.removeItem('currentProject');
  }
}