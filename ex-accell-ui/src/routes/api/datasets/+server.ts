// Dataset API Endpoints
// RESTful API for managing datasets, permissions, and workspace associations

import { refuseIfNoAccess } from '$lib/server/auth/accessGuard';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { datasetsDb } from '$lib/services/datasetsDb';

/**
 * GET /api/datasets
 * List all available datasets with optional filters
 *
 * Query params:
 * - dataset_type: Filter by type (social_media, gdelt_events, analytics)
 * - source_platform: Filter by platform (twitter, telegram, facebook, etc.)
 * - status: Filter by status (available, processing, archived, error)
 * - visibility: Filter by visibility (private, public, restricted)
 * - tags: Filter by tags (comma-separated)
 * - user_email: Filter by user access
 * - workspace_id: Get datasets for a specific workspace
 * - search: Search by name or description
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const datasetType = url.searchParams.get('dataset_type') || undefined;
    const sourcePlatform = url.searchParams.get('source_platform') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const visibility = url.searchParams.get('visibility') || undefined;
    const tagsParam = url.searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',') : undefined;
    const userEmail = url.searchParams.get('user_email') || undefined;
    const workspaceId = url.searchParams.get('workspace_id');
    const search = url.searchParams.get('search');

    // If workspace_id is provided, get datasets for that workspace
    if (workspaceId) {
      const datasets = await datasetsDb.getWorkspaceDatasets(parseInt(workspaceId));
      return json({
        success: true,
        datasets,
        count: datasets.length
      });
    }

    // If search term is provided, search datasets
    if (search) {
      const datasets = await datasetsDb.searchDatasets(search, {
        dataset_type: datasetType,
        source_platform: sourcePlatform,
        status,
        visibility,
        tags
      });
      return json({
        success: true,
        datasets,
        count: datasets.length
      });
    }

    // If user_email is provided, get accessible datasets for that user
    if (userEmail) {
      const datasets = await datasetsDb.getAccessibleDatasets(userEmail, {
        dataset_type: datasetType,
        source_platform: sourcePlatform,
        status,
        visibility,
        tags
      });
      return json({
        success: true,
        datasets,
        count: datasets.length
      });
    }

    // Otherwise, get all datasets with filters
    const datasets = await datasetsDb.getDatasets({
      dataset_type: datasetType,
      source_platform: sourcePlatform,
      status,
      visibility,
      tags
    });

    return json({
      success: true,
      datasets,
      count: datasets.length
    });
  } catch (error: any) {
    console.error('Error fetching datasets:', error);
    return json(
      {
        success: false,
        error: 'Failed to fetch datasets',
        message: error.message
      },
      { status: 500 }
    );
  }
};

/**
 * POST /api/datasets
 * Link a dataset to a workspace or grant permissions
 *
 * Body (link dataset to workspace):
 * {
 *   "action": "link",
 *   "workspace_id": 1,
 *   "dataset_id": 1,
 *   "settings": {}
 * }
 *
 * Body (grant permission):
 * {
 *   "action": "grant_permission",
 *   "dataset_id": 1,
 *   "user_email": "user@example.com",
 *   "access_level": "read",
 *   "expires_at": "2025-12-31T23:59:59Z"
 * }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'link') {
      const { workspace_id, dataset_id, settings } = body;
      // Who is linking comes from the session, never from the request body
      const addedBy = locals.user?.email;
      // Datasets are linked only into a workspace of a project the person belongs to
      const refused = await refuseIfNoAccess(locals.user, { workspaces: [workspace_id] });
      if (refused) return refused;

      if (!workspace_id || !dataset_id || !addedBy) {
        return json(
          {
            success: false,
            error: 'Missing required fields: workspace_id, dataset_id'
          },
          { status: 400 }
        );
      }

      // Admins may use any dataset; everyone else needs access to it
      const isAdmin = locals.user?.role === 'admin';
      const { hasAccess } = isAdmin ? { hasAccess: true } : await datasetsDb.checkUserAccess(dataset_id, addedBy);

      if (!hasAccess) {
        return json(
          {
            success: false,
            error: 'Access denied: User does not have permission to use this dataset'
          },
          { status: 403 }
        );
      }

      const workspaceDataset = await datasetsDb.linkDatasetToWorkspace(
        workspace_id,
        dataset_id,
        addedBy,
        settings || {}
      );

      return json({
        success: true,
        workspace_dataset: workspaceDataset,
        message: 'Dataset linked to workspace successfully'
      });
    } else if (action === 'grant_permission') {
      const { dataset_id, user_email, access_level, expires_at } = body;

      // Granting access to a dataset is an administrator action
      if (locals.user?.role !== 'admin') {
        return json({ success: false, error: 'Only administrators can grant dataset access' }, { status: 403 });
      }

      if (!dataset_id || !user_email) {
        return json(
          {
            success: false,
            error: 'Missing required fields: dataset_id, user_email'
          },
          { status: 400 }
        );
      }

      const permission = await datasetsDb.grantDatasetPermission(
        dataset_id,
        user_email,
        access_level || 'read',
        locals.user.email,
        expires_at ? new Date(expires_at) : null
      );

      return json({
        success: true,
        permission,
        message: 'Permission granted successfully'
      });
    } else {
      return json(
        {
          success: false,
          error: 'Invalid action. Supported actions: link, grant_permission'
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error in POST /api/datasets:', error);
    return json(
      {
        success: false,
        error: 'Failed to process request',
        message: error.message
      },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/datasets
 * Unlink a dataset from a workspace or revoke permissions
 *
 * Query params:
 * - action: "unlink" or "revoke_permission"
 * - workspace_id: Workspace ID (for unlink)
 * - dataset_id: Dataset ID (required)
 * - user_email: User email (for revoke_permission)
 */
export const DELETE: RequestHandler = async ({ url }) => {
  try {
    const action = url.searchParams.get('action');
    const datasetId = url.searchParams.get('dataset_id');

    if (!datasetId) {
      return json(
        {
          success: false,
          error: 'Missing required parameter: dataset_id'
        },
        { status: 400 }
      );
    }

    const datasetIdNum = parseInt(datasetId);

    if (action === 'unlink') {
      const workspaceId = url.searchParams.get('workspace_id');

      if (!workspaceId) {
        return json(
          {
            success: false,
            error: 'Missing required parameter: workspace_id'
          },
          { status: 400 }
        );
      }

      await datasetsDb.unlinkDatasetFromWorkspace(parseInt(workspaceId), datasetIdNum);

      return json({
        success: true,
        message: 'Dataset unlinked from workspace successfully'
      });
    } else if (action === 'revoke_permission') {
      const userEmail = url.searchParams.get('user_email');

      if (!userEmail) {
        return json(
          {
            success: false,
            error: 'Missing required parameter: user_email'
          },
          { status: 400 }
        );
      }

      await datasetsDb.revokeDatasetPermission(datasetIdNum, userEmail);

      return json({
        success: true,
        message: 'Permission revoked successfully'
      });
    } else {
      return json(
        {
          success: false,
          error: 'Invalid action. Supported actions: unlink, revoke_permission'
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error in DELETE /api/datasets:', error);
    return json(
      {
        success: false,
        error: 'Failed to process request',
        message: error.message
      },
      { status: 500 }
    );
  }
};
