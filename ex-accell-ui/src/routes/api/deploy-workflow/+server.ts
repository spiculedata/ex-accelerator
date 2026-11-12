// Workflow Deployment API
// Handles deploying workflow code to the runtime environment

import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { apiFail, apiOk, apiServerError, readJsonObject } from '$lib/server/apiResponse';
import { isSafeIdentifier, resolveWithin } from '$lib/utils/pathSafety';

const DEPLOY_DIR_NAME = 'deployed-workflows';
const MAX_DEPLOY_BODY_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/deploy-workflow
 * Deploy workflow code for execution
 */
export const POST: RequestHandler = async ({ request }) => {
  const parsed = await readJsonObject(request, MAX_DEPLOY_BODY_BYTES);
  if ('failure' in parsed) return parsed.failure;
  const { workflowId, workflowName, code, definition } = parsed.body;

  if (!workflowId || !workflowName || !code) return apiFail('Missing required fields: workflowId, workflowName, code', 400);
  if (!isSafeIdentifier(workflowId)) {
    return apiFail('Invalid workflowId: use letters, digits, "-" or "_" only (max 128 characters)', 400);
  }
  if (typeof code !== 'string') return apiFail('code must be a string', 400);

  try {
    const workflowsDir = join(process.cwd(), DEPLOY_DIR_NAME);
    await mkdir(workflowsDir, { recursive: true });

    const workflowFile = resolveWithin(workflowsDir, `${workflowId}.py`);
    const metadataFile = resolveWithin(workflowsDir, `${workflowId}.json`);

    await writeFile(workflowFile, code);
    await writeFile(
      metadataFile,
      JSON.stringify({ workflowId, workflowName, definition, deployedAt: new Date().toISOString(), filePath: workflowFile }, null, 2)
    );

    return apiOk({ workflowId }, { message: 'Workflow deployed successfully', workflowId });
  } catch (err) {
    return apiServerError('POST /api/deploy-workflow', err, 'Failed to deploy workflow');
  }
};
