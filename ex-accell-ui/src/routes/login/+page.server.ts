import type { PageServerLoad } from './$types';
import { safeRedirectTarget } from '$lib/server/auth/guard';

export const load: PageServerLoad = ({ url }) => ({
  next: safeRedirectTarget(url.searchParams.get('next'))
});
