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

// Mock project data - in real app this would come from API
export const availableProjects: Project[] = [
  {
    id: '1',
    name: 'Brand Sentiment Analysis Q1 2025',
    description: 'Social media sentiment tracking for major brands',
    type: 'social-media',
    status: 'active',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-27T14:30:00Z',
    dataSources: ['twitter', 'reddit', 'telegram'],
    totalPosts: 125430,
    teamMembers: ['john.doe@company.com', 'sarah.wilson@company.com', 'mike.johnson@company.com'],
    owner: 'John Doe'
  },
  {
    id: '2',
    name: 'Customer Feedback Analysis',
    description: 'Processing customer reviews and support interactions',
    type: 'customer-feedback',
    status: 'active',
    createdAt: '2025-01-20T09:15:00Z',
    updatedAt: '2025-01-26T16:45:00Z',
    dataSources: ['csv-upload', 'json-upload'],
    totalPosts: 8920,
    teamMembers: ['john.doe@company.com', 'sarah.wilson@company.com'],
    owner: 'Sarah Wilson'
  },
  {
    id: '3',
    name: 'Market Research Dashboard',
    description: 'Track brand mentions and competitor analysis',
    type: 'market-research',
    status: 'paused',
    createdAt: '2025-01-10T14:20:00Z',
    updatedAt: '2025-01-25T11:15:00Z',
    dataSources: ['twitter', 'linkedin', 'reddit'],
    totalPosts: 67230,
    teamMembers: ['john.doe@company.com', 'sarah.wilson@company.com', 'mike.johnson@company.com', 'anna.lee@company.com'],
    owner: 'Mike Johnson'
  }
];

// Current active project store
export const currentProject = writable<Project | null>(null);

// Function to set the current project
export function setCurrentProject(projectId: string) {
  const project = availableProjects.find(p => p.id === projectId);
  if (project) {
    currentProject.set(project);
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentProject', projectId);
    }
  }
}

// Function to load project from localStorage on app init
export function loadCurrentProject() {
  if (typeof window !== 'undefined') {
    const savedProjectId = localStorage.getItem('currentProject');
    if (savedProjectId) {
      setCurrentProject(savedProjectId);
    }
  }
}

// Function to clear current project
export function clearCurrentProject() {
  currentProject.set(null);
  if (typeof window !== 'undefined') {
    localStorage.removeItem('currentProject');
  }
}