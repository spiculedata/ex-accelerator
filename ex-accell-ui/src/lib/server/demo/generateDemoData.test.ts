import { describe, it, expect } from 'vitest';
import { migrationColumns } from '../../../test/migrationSchema';
import { generateDemoData, type DemoTable } from './generateDemoData';

const NOW = new Date('2026-06-15T12:00:00Z');
const data = generateDemoData({ seed: 7, now: NOW, days: 60, postCount: 600 });
const table = (name: string): DemoTable => {
  const found = data.tables.find((t) => t.name === name);
  if (!found) throw new Error(`missing table ${name}`);
  return found;
};
const column = (t: DemoTable, name: string) => t.rows.map((row) => row[t.columns.indexOf(name)]);

describe('generateDemoData', () => {
  it('is deterministic for a given seed and clock', () => {
    const again = generateDemoData({ seed: 7, now: NOW, days: 60, postCount: 600 });

    expect(again).toEqual(data);
  });

  it('differs for a different seed', () => {
    const other = generateDemoData({ seed: 8, now: NOW, days: 60, postCount: 600 });

    expect(other).not.toEqual(data);
  });

  it('creates the requested number of posts inside the time window', () => {
    const posts = table('posts');
    const created = column(posts, 'created_at').map((value) => (value as Date).getTime());

    expect(posts.rows).toHaveLength(600);
    expect(Math.min(...created)).toBeGreaterThanOrEqual(NOW.getTime() - 60 * 86_400_000);
    expect(Math.max(...created)).toBeLessThanOrEqual(NOW.getTime());
  });

  it('uses unique ids in every table', () => {
    for (const t of data.tables.filter((x) => x.columns.includes('id'))) {
      const ids = column(t, 'id');
      expect(new Set(ids).size, t.name).toBe(ids.length);
    }
  });

  it('only references posts, sources and topics that exist', () => {
    const postIds = new Set(column(table('posts'), 'id'));
    const sourceIds = new Set(column(table('data_sources'), 'id'));
    const topicIds = new Set(column(table('topics'), 'id'));

    for (const name of ['sentiment_classifications', 'emotion_analysis', 'document_topics', 'language_detection', 'post_engagement']) {
      expect(column(table(name), 'post_id').every((id) => postIds.has(id)), name).toBe(true);
    }
    expect(column(table('posts'), 'data_source_id').every((id) => sourceIds.has(id))).toBe(true);
    expect(column(table('document_topics'), 'topic_id').every((id) => topicIds.has(id))).toBe(true);
  });

  it('gives every post one sentiment, one primary topic and one language detection', () => {
    expect(table('sentiment_classifications').rows).toHaveLength(600);
    expect(table('language_detection').rows).toHaveLength(600);
    const primary = table('document_topics');
    expect(column(primary, 'is_primary').filter(Boolean)).toHaveLength(600);
  });

  it('produces a realistic spread rather than a single value', () => {
    const sentiments = new Set(column(table('sentiment_classifications'), 'sentiment_category'));
    const platforms = new Set(column(table('data_sources'), 'platform'));
    const languages = new Set(column(table('posts'), 'language'));

    expect(sentiments.size).toBeGreaterThanOrEqual(4);
    expect(platforms.size).toBeGreaterThanOrEqual(3);
    expect(languages.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps hourly sentiment trends consistent with the posts', () => {
    const trends = table('sentiment_temporal_trends');
    const total = column(trends, 'total_posts').reduce((sum, n) => sum + (n as number), 0);

    expect(total).toBe(600);
  });

  it('keeps dataset record counts consistent with the posts', () => {
    const datasets = table('datasets');
    const counted = column(datasets, 'record_count').reduce((sum, n) => sum + (n as number), 0);

    expect(counted).toBe(600);
  });

  it('contains no real-looking personal data', () => {
    const text = JSON.stringify(data.tables.map((t) => t.rows));

    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/\+?\d[\d\s-]{9,}\d/);
    const emails = text.match(/[\w.-]+@[\w.-]+/g) ?? [];
    expect(emails.every((email) => email.endsWith('@example.com') || email.endsWith('@example.org'))).toBe(true);
  });

  it('makes the demo datasets public so any signed-in user can add them to a workspace', () => {
    expect(column(table('datasets'), 'visibility').every((visibility) => visibility === 'public')).toBe(true);
  });

  it('labels every data source as demo data', () => {
    expect(column(table('data_sources'), 'name').every((name) => String(name).startsWith('Demo'))).toBe(true);
  });
});

describe('generateDemoData against the schema', () => {
  it('only inserts into tables and columns that the migrations define', () => {
    const schema = migrationColumns();

    for (const t of data.tables) {
      const known = schema.get(t.name);
      expect(known, `table ${t.name} is not defined in db/migrations`).toBeDefined();
      for (const columnName of t.columns) expect(known!.has(columnName), `${t.name}.${columnName}`).toBe(true);
    }
  });

  it('references only topics that exist in every topic table', () => {
    const topicIds = new Set(column(table('topics'), 'id'));

    expect(column(table('topic_keywords'), 'topic_id').every((id) => topicIds.has(id))).toBe(true);
    expect(column(table('topic_trends'), 'topic_id').every((id) => topicIds.has(id))).toBe(true);
    for (const name of ['topic1_id', 'topic2_id']) {
      expect(column(table('topic_relationships'), name).every((id) => topicIds.has(id)), name).toBe(true);
    }
  });

  it('falls back to defaults when options are explicitly undefined', () => {
    const result = generateDemoData({ seed: undefined, now: undefined, days: undefined, postCount: 20 });

    expect(table_(result, 'posts').rows).toHaveLength(20);
  });
});

function table_(result: { tables: DemoTable[] }, name: string): DemoTable {
  return result.tables.find((t) => t.name === name)!;
}
