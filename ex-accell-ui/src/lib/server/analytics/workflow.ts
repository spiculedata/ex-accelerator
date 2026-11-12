import { json } from '@sveltejs/kit';
import { executeQuery } from './executeQuery';
import { WORKFLOW_DATASET_COUNT_QUERIES, buildWorkflowDatasets, type WorkflowDatasetCounts } from '$lib/server/workflowDatasets';
import { isMissingRelationError, queryErrorResponse } from '$lib/server/queryErrors';
import type { AnalyticsContext, AnalyticsHandler } from './types';

async function workflowDatasets(_ctx: AnalyticsContext): Promise<Response> {
  try {
    // The counts are independent, so run them together; a module whose table does not exist yet has no data
    const entries = await Promise.all(
      Object.entries(WORKFLOW_DATASET_COUNT_QUERIES).map(async ([key, sql]) => {
        try {
          const [row] = await executeQuery(sql);
          return [key, Number(row?.count) || 0] as const;
        } catch (error) {
          if (!isMissingRelationError(error)) throw error;
          return [key, 0] as const;
        }
      })
    );
    const counts = Object.fromEntries(entries) as unknown as WorkflowDatasetCounts;
    return json({ success: true, data: buildWorkflowDatasets(counts) });
  } catch (error) {
    return queryErrorResponse('Workflow datasets', error, []);
  }
}

export const workflowHandlers: Record<string, AnalyticsHandler> = {
  'workflow-datasets': workflowDatasets
};
