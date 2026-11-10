// Saves a workflow built in the workflow builder as a draft (no code generation, no publishing)

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';
import { BodyTooLargeError, readJsonLimited } from '$lib/server/requestBody';

// A workflow definition is a list of steps and their settings; a megabyte is far more than any real one
const MAX_WORKFLOW_BODY_BYTES = 1024 * 1024;

/**
 * POST /api/workflows/drafts
 * Body: { id?, workflowDefinition, name?, description? }. Pass the id from an earlier save to update that
 * draft. The creator is the signed-in user.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  let body: any;
  try {
    body = await readJsonLimited(request, MAX_WORKFLOW_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return json({ success: false, error: error.message }, { status: 413 });
    return json({ success: false, error: 'Send a JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') return json({ success: false, error: 'Send a JSON object' }, { status: 400 });
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
