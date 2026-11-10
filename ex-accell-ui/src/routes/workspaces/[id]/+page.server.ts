import { error } from '@sveltejs/kit';
import { projectsDb } from '$lib/services/projectsDb';
import type { PageServerLoad } from './$types';

// An id that names no workspace is a real 404 (with links onward), not a page that loads and shows a Retry button.
export const load: PageServerLoad = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) error(404, 'Workspace not found');
  if (!(await projectsDb.getWorkspaceById(id))) error(404, 'Workspace not found');
  return {};
};
