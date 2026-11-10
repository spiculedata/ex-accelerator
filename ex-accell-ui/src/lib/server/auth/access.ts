// Who may see which project and workspace. Projects record their members (`project_members`, the creator as owner);
// a workspace follows its project. Admins see everything. A project from before accounts existed has no real member
// (its owner is a placeholder like "default_user"), so it stays open to every signed-in user rather than becoming
// invisible to everyone; it closes as soon as a real person is added.
import type { SessionUser } from './session';

export interface ProjectAccessInfo {
  createdBy: string | null;
  memberEmails: string[];
}

/** A real person has an email address; "default_user" and "unknown" are placeholders from before accounts. */
const isPerson = (email: string | null | undefined): email is string => !!email && email.includes('@');

export function canAccessProject(user: Pick<SessionUser, 'email' | 'role'>, project: ProjectAccessInfo): boolean {
  if (user.role === 'admin') return true;
  const people = [project.createdBy, ...project.memberEmails].filter(isPerson).map((email) => email.toLowerCase());
  if (people.length === 0) return true;
  return people.includes(user.email.toLowerCase());
}

export interface RequestResources {
  projects: number[];
  workspaces: number[];
}

const WORKSPACE_PARAMS = ['workspace_id', 'workspace', 'workspaceId'];
const PROJECT_PARAMS = ['project_id', 'project', 'projectId'];

const wholeNumber = (value: string | null): number | null => {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const unique = (values: Array<number | null>): number[] => [...new Set(values.filter((v): v is number => v !== null))];

/** The projects and workspaces a request names, in its path or query string. Ids that are not whole numbers are ignored. */
export function resourcesInRequest(url: URL): RequestResources {
  const { pathname, searchParams } = url;
  const workspaces: Array<number | null> = WORKSPACE_PARAMS.map((name) => wholeNumber(searchParams.get(name)));
  const projects: Array<number | null> = PROJECT_PARAMS.map((name) => wholeNumber(searchParams.get(name)));

  // Endpoints whose `id` parameter is the resource itself
  if (pathname === '/api/projects') projects.push(wholeNumber(searchParams.get('id')));
  if (pathname === '/api/workspaces' || pathname === '/api/workspace-overview') workspaces.push(wholeNumber(searchParams.get('id')));

  const inPath = /^\/(?:api\/)?(projects|workspaces)\/(\d+)(?:\/|$)/.exec(pathname);
  if (inPath) (inPath[1] === 'projects' ? projects : workspaces).push(wholeNumber(inPath[2]));

  return { projects: unique(projects), workspaces: unique(workspaces) };
}
