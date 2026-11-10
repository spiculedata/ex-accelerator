import { CONTENT_TYPES, LANGUAGES, SOURCES } from './content';
import type { DemoTable } from './types';

/** Lookup tables: sources, crawlers, languages and content types. */
export function referenceTables(now: Date): DemoTable[] {
  return [
    {
      name: 'data_sources',
      columns: ['id', 'name', 'platform', 'status', 'health_score', 'last_sync'],
      rows: SOURCES.map((s, i) => [s.id, s.name, s.platform, 'active', 96 - i * 3, now])
    },
    {
      name: 'crawlers',
      columns: ['id', 'name', 'data_source_id', 'status', 'processing_rate', 'last_run'],
      rows: SOURCES.map((s, i) => [s.id, `Demo ${s.platform} crawler`, s.id, 'active', 120 + i * 45, now])
    },
    {
      name: 'languages',
      columns: ['id', 'code', 'name', 'native_name', 'script', 'direction'],
      rows: LANGUAGES.map((l) => [l.id, l.code, l.name, l.nativeName, 'Latin', 'ltr'])
    },
    {
      name: 'content_types',
      columns: ['id', 'name', 'description', 'avg_engagement_rate'],
      rows: CONTENT_TYPES.map((c) => [c.id, c.name, c.description, 4.5])
    }
  ];
}
