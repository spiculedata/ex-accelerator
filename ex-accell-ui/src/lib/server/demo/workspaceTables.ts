import { SOURCES } from './content';
import type { DemoTable, PostDraft } from './types';

const EMAIL = 'admin@example.com';

/** Projects, workspaces and datasets whose counts match the generated posts. */
export function workspaceTables(posts: PostDraft[], windowStart: Date, now: Date): DemoTable[] {
  const perSource = SOURCES.map((source) => posts.filter((p) => p.source === source).length);
  const festivalCounts = SOURCES.map((source) => posts.filter((p) => p.source === source && p.topic.key === 'festival').length);
  return [
    {
      name: 'projects',
      columns: ['id', 'name', 'description', 'project_type', 'created_by'],
      rows: [
        [1, 'Marlow Bay Civic Pulse', 'Demo project: what a fictional coastal city is talking about', 'social-media', EMAIL],
        [2, 'Harbor Festival Review', 'Demo project: reactions to the annual harbor festival', 'content-analysis', EMAIL]
      ]
    },
    {
      name: 'project_members',
      columns: ['id', 'project_id', 'email', 'role'],
      rows: [[1, 1, EMAIL, 'owner'], [2, 1, 'analyst@example.com', 'member'], [3, 2, EMAIL, 'owner']]
    },
    {
      name: 'workspaces',
      columns: ['id', 'project_id', 'name', 'description', 'workspace_type', 'created_by'],
      rows: [
        [1, 1, 'Telegram channels', 'Local news and community channels', 'exploration', EMAIL],
        [2, 1, 'Video and social', 'YouTube and Bluesky coverage', 'analysis', EMAIL],
        [3, 2, 'Festival coverage', 'Festival-week posts across platforms', 'reporting', EMAIL]
      ]
    },
    {
      name: 'workspace_data_sources',
      columns: ['id', 'workspace_id', 'source_type', 'source_name', 'status', 'record_count'],
      rows: [
        ...SOURCES.map((s, i) => [i + 1, i === 0 ? 1 : 2, s.platform, s.name, 'active', perSource[i]]),
        ...SOURCES.map((s, i) => [SOURCES.length + i + 1, 3, s.platform, s.name, 'active', festivalCounts[i]])
      ]
    },
    {
      name: 'datasets',
      columns: ['id', 'name', 'description', 'dataset_type', 'source_platform', 'source_database', 'schema_name', 'table_name', 'record_count', 'date_range_start', 'date_range_end', 'ingestion_method', 'status', 'visibility', 'created_by'],
      rows: SOURCES.map((s, i) => [i + 1, s.name, `Synthetic ${s.platform} posts about a fictional city`, 'social_media', s.platform, 'etl_postgres', 'public', 'posts', perSource[i], windowStart, now, 'upload', 'available', 'public', EMAIL])
    },
    {
      name: 'dataset_tags',
      columns: ['id', 'dataset_id', 'tag_name'],
      rows: SOURCES.flatMap((s, i) => [[i * 2 + 1, i + 1, 'demo'], [i * 2 + 2, i + 1, s.platform]])
    }
  ];
}
