// Who is in a project. Members can see the project and what is in it; only its creator or an admin can change the list.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canManageProject, parseResourceId } from '$lib/server/auth/access';
import { forgetProjectAccess } from '$lib/server/auth/accessCheck';
import { refuseIfNoAccess } from '$lib/server/auth/accessGuard';
import { loadProjectAccessInfo } from '$lib/server/auth/accessRepo';
import { isEmail } from '$lib/server/auth/userInput';
import { projectsDb } from '$lib/services/projectsDb';

const failure = (error: string, status: number) => json({ success: false, data: null, error }, { status });

/** The project id as a positive whole number, or null when it is missing or not a plain one. */
function projectIdOf(value: unknown): number | null {
  const id = parseResourceId(value);
  return typeof id === 'number' ? id : null;
}

/** GET /api/project-members?project_id=N: the members, the creator, and whether the caller may change the list. */
export const GET: RequestHandler = async ({ url, locals }) => {
  const projectId = projectIdOf(url.searchParams.get('project_id'));
  if (projectId === null) return failure('project_id must be a whole number', 400);
  if (!locals.user) return failure('Authentication required', 401);
  try {
    const refused = await refuseIfNoAccess(locals.user, { projects: [projectId] });
    if (refused) return refused;
    const info = await loadProjectAccessInfo(projectId);
    if (!info) return failure('Project not found', 404);
    const members = await projectsDb.getProjectMembers(projectId);
    return json({
      success: true,
      data: {
        members: members.map((member) => ({ email: member.email, role: member.role, addedAt: member.added_at })),
        createdBy: info.createdBy,
        canManage: canManageProject(locals.user, info)
      },
      error: null
    });
  } catch (error) {
    console.error('GET /api/project-members error:', error instanceof Error ? error.message : String(error));
    return failure('Could not load the members. Try again.', 500);
  }
};

/** Loads the project and checks the caller may change its members. Returns a refusal, or the project's access info. */
async function authoriseManager(user: { email: string; role: string } | null | undefined, projectId: number) {
  if (!user) return { refusal: failure('Authentication required', 401) };
  const info = await loadProjectAccessInfo(projectId);
  if (!info) return { refusal: failure('Project not found', 404) };
  if (!canManageProject(user as Parameters<typeof canManageProject>[0], info)) {
    return { refusal: failure('Only the project creator or an admin can change its members', 403) };
  }
  return { info };
}

/** POST /api/project-members {project_id, email}: adds a member. */
export const POST: RequestHandler = async ({ request, locals }) => {
  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return failure('Send a JSON body', 400);
  }
  const projectId = projectIdOf(body.project_id);
  if (projectId === null) return failure('project_id must be a whole number', 400);
  if (!isEmail(typeof body.email === 'string' ? body.email.trim() : body.email)) return failure('Enter a valid email address', 400);
  const email = (body.email as string).trim().toLowerCase();

  try {
    const { refusal } = await authoriseManager(locals.user, projectId);
    if (refusal) return refusal;
    if (!(await projectsDb.addProjectMember(projectId, email, 'member'))) return failure('Could not add the member. Try again.', 500);
    forgetProjectAccess(projectId);
    return json({ success: true, data: null, error: null });
  } catch (error) {
    console.error('POST /api/project-members error:', error instanceof Error ? error.message : String(error));
    return failure('Could not add the member. Try again.', 500);
  }
};

/** DELETE /api/project-members?project_id=N&email=...: removes a member. The creator always keeps access. */
export const DELETE: RequestHandler = async ({ url, locals }) => {
  const projectId = projectIdOf(url.searchParams.get('project_id'));
  if (projectId === null) return failure('project_id must be a whole number', 400);
  const rawEmail = url.searchParams.get('email')?.trim();
  if (!isEmail(rawEmail)) return failure('Enter a valid email address', 400);
  const email = rawEmail.toLowerCase();

  try {
    const { refusal, info } = await authoriseManager(locals.user, projectId);
    if (refusal) return refusal;
    if (info?.createdBy?.toLowerCase() === email) return failure('The person who created the project always has access', 400);
    if (!(await projectsDb.removeProjectMember(projectId, email))) return failure('Could not remove the member. Try again.', 500);
    forgetProjectAccess(projectId);
    return json({ success: true, data: null, error: null });
  } catch (error) {
    console.error('DELETE /api/project-members error:', error instanceof Error ? error.message : String(error));
    return failure('Could not remove the member. Try again.', 500);
  }
};
