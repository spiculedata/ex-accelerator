import { error } from '@sveltejs/kit';
import { projectsDb } from '$lib/services/projectsDb';
import type { PageServerLoad } from './$types';

// An id that names no project is a real 404 (with links onward), not a page that loads and shows a Retry button.
// A database failure is left to surface as a 500.
export const load: PageServerLoad = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) error(404, 'Project not found');
  if (!(await projectsDb.getProjectById(id))) error(404, 'Project not found');
  return {};
};
