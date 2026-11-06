/** The datasets offered in the workflow builder, derived from what the database holds. */

export interface WorkflowDataset {
  id: string;
  name: string;
  description: string;
  table: string;
  type: string;
}

export interface WorkflowDatasetCounts {
  posts: number;
  sentiment: number;
  topics: number;
  language: number;
  engagement: number;
  android: number;
}

/** One fixed count query per source; nothing here is built from request input. */
export const WORKFLOW_DATASET_COUNT_QUERIES: Readonly<Record<keyof WorkflowDatasetCounts, string>> = {
  posts: 'SELECT COUNT(*) AS count FROM posts',
  sentiment: 'SELECT COUNT(*) AS count FROM sentiment_classifications',
  topics: 'SELECT COUNT(DISTINCT topic_id) AS count FROM topics',
  language: 'SELECT COUNT(*) AS count FROM language_detection',
  engagement: 'SELECT COUNT(*) AS count FROM post_engagement',
  android: 'SELECT COUNT(DISTINCT device_id) AS count FROM android_devices'
};

const format = (value: number): string => value.toLocaleString('en-US');

export function buildWorkflowDatasets(counts: WorkflowDatasetCounts): WorkflowDataset[] {
  const datasets: WorkflowDataset[] = [];
  const add = (count: number, dataset: Omit<WorkflowDataset, 'description'>, describe: (n: string) => string) => {
    if (count > 0) datasets.push({ ...dataset, description: describe(format(count)) });
  };

  add(counts.posts, { id: 'social_posts', name: 'Social Media Posts', table: 'posts', type: 'social_media' }, (n) => `${n} posts from social platforms`);
  add(counts.sentiment, { id: 'sentiment_data', name: 'Sentiment Analysis Results', table: 'unified_post_analysis', type: 'analytics' }, (n) => `${n} sentiment classifications`);
  add(counts.topics, { id: 'topic_data', name: 'Topic Modeling Results', table: 'unified_post_analysis', type: 'analytics' }, (n) => `${n} discovered topics`);
  add(counts.language, { id: 'language_data', name: 'Language Detection Results', table: 'unified_post_analysis', type: 'analytics' }, (n) => `${n} language classifications`);
  add(counts.engagement, { id: 'engagement_data', name: 'Engagement Analysis Results', table: 'post_engagement', type: 'analytics' }, (n) => `${n} engagement records`);
  add(counts.android, { id: 'android_data', name: 'Android Analytics Data', table: 'android_app_usage', type: 'mobile_analytics' }, (n) => `${n} devices tracked`);

  if (datasets.length > 0) {
    datasets.unshift({
      id: 'unified_analysis',
      name: 'Unified Post Analysis',
      description: 'Combined view of all analytics (sentiment, topics, language, engagement)',
      table: 'unified_post_analysis',
      type: 'unified'
    });
  }
  return datasets;
}
