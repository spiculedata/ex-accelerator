import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ success: false, data: null, error: 'Authentication required' }, { status: 401 });
  }
  return json({ success: true, data: { user: locals.user }, error: null });
};
