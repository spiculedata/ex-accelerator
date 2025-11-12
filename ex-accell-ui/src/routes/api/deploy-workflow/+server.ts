// Workflow Deployment API
// Handles deploying workflow code to the runtime environment

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * POST /api/deploy-workflow
 * Deploy workflow code for execution
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { workflowId, workflowName, code, definition } = body;

    if (!workflowId || !workflowName || !code) {
      return error(400, 'Missing required fields: workflowId, workflowName, code');
    }

    // Create workflows directory if it doesn't exist
    const workflowsDir = join(process.cwd(), 'deployed-workflows');
    try {
      await mkdir(workflowsDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    // Write workflow code to file
    const workflowFile = join(workflowsDir, `${workflowId}.py`);
    await writeFile(workflowFile, code);

    // Write workflow metadata
    const metadataFile = join(workflowsDir, `${workflowId}.json`);
    await writeFile(metadataFile, JSON.stringify({
      workflowId,
      workflowName,
      definition,
      deployedAt: new Date().toISOString(),
      filePath: workflowFile
    }, null, 2));

    console.log(`Workflow ${workflowName} deployed to ${workflowFile}`);

    return json({
      success: true,
      message: 'Workflow deployed successfully',
      deployedFile: workflowFile
    });

  } catch (err) {
    console.error('Error deploying workflow:', err);
    return error(500, `Failed to deploy workflow: ${err instanceof Error ? err.message : String(err)}`);
  }
};