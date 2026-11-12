import type { WorkspaceDataScope } from '$lib/services/workspaceContextResolver';

/** What a unified-analytics handler gets: the request URL, the resolved workspace scope and the requested (non-empty) type. */
export interface AnalyticsContext {
  url: URL;
  scope: WorkspaceDataScope | null;
  type: string;
}

/** A handler owns one `type` of /api/unified-analytics and returns the finished HTTP response. */
export type AnalyticsHandler = (context: AnalyticsContext) => Promise<Response>;
