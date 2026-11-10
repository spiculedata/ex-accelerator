// Workflow Deployment API
// Handles deploying workflow code to the runtime environment

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { isSafeIdentifier, resolveWithin } from '$lib/utils/pathSafety';

const DEPLOY_DIR_NAME = 'deployed-workflows';

/**
 * POST /api/deploy-workflow
 * Deploy workflow code for execution
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Request body must be valid JSON');
  }

  const { workflowId, workflowName, code, definition } = body;

  if (!workflowId || !workflowName || !code) {
    throw error(400, 'Missing required fields: workflowId, workflowName, code');
  }
  if (!isSafeIdentifier(workflowId)) {
    throw error(400, 'Invalid workflowId: use letters, digits, "-" or "_" only (max 128 characters)');
  }
  if (typeof code !== 'string') {
    throw error(400, 'code must be a string');
  }

  try {
    const workflowsDir = join(process.cwd(), DEPLOY_DIR_NAME);
    await mkdir(workflowsDir, { recursive: true });

    const workflowFile = resolveWithin(workflowsDir, `${workflowId}.py`);
    const metadataFile = resolveWithin(workflowsDir, `${workflowId}.json`);

    await writeFile(workflowFile, code);
    await writeFile(
      metadataFile,
      JSON.stringify(
        {
          workflowId,
          workflowName,
          definition,
          deployedAt: new Date().toISOString(),
          filePath: workflowFile
        },
        null,
        2
      )
    );

    return json({
      success: true,
      message: 'Workflow deployed successfully',
      workflowId
    });
  } catch (err) {
    console.error('Error deploying workflow:', err);
    throw error(500, 'Failed to deploy workflow');
  }
};
