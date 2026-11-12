// Saves a workflow built in the workflow builder as a draft (no code generation, no publishing)

import { apiFail, apiOk, apiServerError, readJsonObject } from '$lib/server/apiResponse';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

// A workflow definition is a list of steps and their settings; a megabyte is far more than any real one
const MAX_WORKFLOW_BODY_BYTES = 1024 * 1024;

/**
 * POST /api/workflows/drafts
 * Body: { id?, workflowDefinition, name?, description? }. Pass the id from an earlier save to update that
 * draft. The creator is the signed-in user.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const parsed = await readJsonObject(request, MAX_WORKFLOW_BODY_BYTES);
  if ('failure' in parsed) return parsed.failure;
  const body = parsed.body as any;

  const definition = body.workflowDefinition;
  if (!definition || typeof definition !== 'object' || !Array.isArray(definition.steps)) {
    return apiFail('workflowDefinition must include a steps list', 400);
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
    return apiOk(workflow, { workflow });
  } catch (err) {
    return apiServerError('POST /api/workflows/drafts', err, 'Could not save the workflow');
  }
};
