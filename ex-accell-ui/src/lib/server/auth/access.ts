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
  /** Names of parameters (or "path") that name a resource but are not a plain positive whole number. */
  malformed: string[];
}

const CANONICAL_ID = /^[1-9]\d*$/;

/**
 * The one way an id naming a project or workspace is read: a positive whole number, as a number or as plain digits.
 * `null` when there is no value; `'invalid'` for anything else (spaces, a sign, a leading zero, letters). Routes read
 * ids more loosely (`parseInt('9abc')` is 9, and Postgres accepts ' 9'), so a value that is not exactly this must be
 * refused, not ignored, or it can name a project the check never looked at.
 */
export function parseResourceId(value: unknown): number | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : 'invalid';
  if (typeof value === 'string' && CANONICAL_ID.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : 'invalid';
  }
  return 'invalid';
}

const WORKSPACE_PARAMS = ['workspace_id', 'workspace', 'workspaceId'];
const PROJECT_PARAMS = ['project_id', 'project', 'projectId'];

/** Endpoints whose own `id` parameter is the project or workspace they are about. */
const PROJECT_ID_ENDPOINTS = new Set(['/api/projects', '/api/project-overview']);
const WORKSPACE_ID_ENDPOINTS = new Set(['/api/workspaces', '/api/workspace-overview']);

/** The path as it was sent and as the router sees it: percent-decoded, with doubled slashes collapsed. */
function pathVariants(pathname: string): string[] {
  try {
    return [pathname, decodeURIComponent(pathname).replace(/\/{2,}/g, '/')];
  } catch {
    return [pathname];
  }
}

/** The projects and workspaces a request names, in its path or query string, and any id that is named but malformed. */
export function resourcesInRequest(url: URL): RequestResources {
  const { pathname, searchParams } = url;
  const variants = pathVariants(pathname);
  const projects: number[] = [];
  const workspaces: number[] = [];
  const malformed = new Set<string>();

  const note = (into: number[], name: string, raw: unknown) => {
    const id = parseResourceId(raw);
    if (id === 'invalid') malformed.add(name);
    else if (id !== null) into.push(id);
  };

  for (const name of WORKSPACE_PARAMS) note(workspaces, name, searchParams.get(name));
  for (const name of PROJECT_PARAMS) note(projects, name, searchParams.get(name));
  if (variants.some((path) => PROJECT_ID_ENDPOINTS.has(path))) note(projects, 'id', searchParams.get('id'));
  if (variants.some((path) => WORKSPACE_ID_ENDPOINTS.has(path))) note(workspaces, 'id', searchParams.get('id'));

  // The router matches the decoded path, so that is the one whose ids count (an encoded digit is the digit)
  const routed = variants[variants.length - 1];
  const inPath = /^\/(?:api\/)?(projects|workspaces)\/([^/]+)(?:\/|$)/.exec(routed);
  if (inPath && !(inPath[1] === 'projects' && inPath[2] === 'new')) {
    note(inPath[1] === 'projects' ? projects : workspaces, 'path', inPath[2]); // 'new' is the new-project page, which has no id
  }

  return { projects: [...new Set(projects)], workspaces: [...new Set(workspaces)], malformed: [...malformed] };
}
