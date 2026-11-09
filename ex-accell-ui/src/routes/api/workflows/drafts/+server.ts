// Saves a workflow built in the workflow builder as a draft (no code generation, no publishing)

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

/**
 * POST /api/workflows/drafts
 * Body: { id?, workflowDefinition, name?, description? }. Pass the id from an earlier save to update that
 * draft. The creator is the signed-in user.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Send a JSON body' }, { status: 400 });
  }

  const definition = body?.workflowDefinition;
  if (!definition || typeof definition !== 'object' || !Array.isArray(definition.steps)) {
    return json({ success: false, error: 'workflowDefinition must include a steps list' }, { status: 400 });
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled workflow';
  const description = typeof body.description === 'string' ? body.description : '';
  const existingId = typeof body.id === 'string' && body.id ? body.id : undefined;

  try {
    const workflow = await serverWorkflowService.saveDraft(
      definition,
      { name, description, createdBy: locals.user?.email ?? 'unknown' },
      existingId
    );
    return json({ success: true, workflow });
  } catch (err) {
    console.error('POST /api/workflows/drafts error:', err);
    return json({ success: false, error: 'Could not save the workflow' }, { status: 500 });
  }
};
