import { describe, it, expect } from 'vitest';
import { buildWorkflowDatasets, type WorkflowDatasetCounts } from './workflowDatasets';

const none: WorkflowDatasetCounts = { posts: 0, sentiment: 0, topics: 0, language: 0, engagement: 0, android: 0 };

describe('buildWorkflowDatasets', () => {
  it('returns nothing when no analytics tables hold data', () => {
    expect(buildWorkflowDatasets(none)).toEqual([]);
  });

  it('describes each table that has data, with its real count', () => {
    const datasets = buildWorkflowDatasets({ ...none, posts: 1500, engagement: 1200 });

    const byId = Object.fromEntries(datasets.map((d) => [d.id, d]));
    expect(byId.social_posts).toMatchObject({ table: 'posts', type: 'social_media' });
    expect(byId.social_posts.description).toContain('1,500 posts');
    expect(byId.engagement_data.description).toContain('1,200 engagement records');
    expect(byId.sentiment_data).toBeUndefined();
  });

  it('adds the combined view first when anything is available', () => {
    const datasets = buildWorkflowDatasets({ ...none, topics: 8 });

    expect(datasets[0]).toMatchObject({ id: 'unified_analysis', table: 'unified_post_analysis', type: 'unified' });
    expect(datasets.map((d) => d.id)).toContain('topic_data');
  });

  it('describes Android data by the number of devices', () => {
    const datasets = buildWorkflowDatasets({ ...none, android: 3 });

    expect(datasets.find((d) => d.id === 'android_data')?.description).toBe('3 devices tracked');
  });
});
