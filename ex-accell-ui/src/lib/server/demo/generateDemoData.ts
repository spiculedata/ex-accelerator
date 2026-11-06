import {
  CONTENT_TYPES, EMOTIONS, FOREIGN_SENTENCES, LANGUAGES, SENTIMENTS, SOURCES, TOPICS, bandOf,
  type DemoTopic, type Sentiment
} from './content';
import { createRng, type Rng } from './rng';
import { analyticsTables } from './analyticsTables';
import { referenceTables } from './referenceTables';
import type { Cell, DemoTable, PostDraft } from './types';
import { workspaceTables } from './workspaceTables';

export type { Cell, DemoTable } from './types';

export interface DemoData {
  tables: DemoTable[];
}

export interface DemoOptions {
  seed?: number;
  now?: Date;
  days?: number;
  postCount?: number;
}

const DAY_MS = 86_400_000;
const HOUR_WEIGHTS = [1, 1, 1, 1, 1, 2, 3, 5, 6, 6, 6, 6, 7, 7, 6, 6, 6, 7, 8, 8, 7, 5, 3, 2];
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const round = (value: number, places: number) => Number(value.toFixed(places));

/** Topic popularity on a given day; spikes make the timeline interesting. */
function topicWeight(topic: DemoTopic, day: number, days: number): number {
  const at = (fraction: number, width: number, boost: number) => (Math.abs(day - fraction * days) <= width ? boost : 0);
  if (topic.key === 'transit') return 1 + at(0.66, 3, 3);
  if (topic.key === 'festival') return 0.5 + at(0.33, 2, 5);
  if (topic.key === 'heat') return 0.6 + at(0.85, 3, 3);
  return 1;
}

function writeContent(rng: Rng, topic: DemoTopic, sentiment: Sentiment, languageCode: string): string {
  const band = bandOf(sentiment);
  if (languageCode !== 'en') return `${rng.pick(FOREIGN_SENTENCES[languageCode][band])} ${rng.pick(topic.hashtags)}`;
  const tags = rng.chance(0.6) ? ` ${rng.pick(topic.hashtags)}` : '';
  return `${rng.pick(topic.sentences[band])}${tags}`;
}

function draftPosts(rng: Rng, options: Required<DemoOptions>): PostDraft[] {
  const start = options.now.getTime() - options.days * DAY_MS;
  const languageWeights = LANGUAGES.map((language) => language.share);
  return Array.from({ length: options.postCount }, (_, index) => {
    const day = rng.int(0, options.days - 1);
    const topic = rng.weighted(TOPICS, TOPICS.map((t) => topicWeight(t, day, options.days)));
    const sentiment = rng.weighted(SENTIMENTS, topic.bias);
    const languageIndex = LANGUAGES.indexOf(rng.weighted(LANGUAGES, languageWeights));
    const hour = rng.weighted([...HOUR_WEIGHTS.keys()], HOUR_WEIGHTS);
    const time = Math.min(start + day * DAY_MS + hour * 3_600_000 + rng.int(0, 3_599) * 1000, options.now.getTime());
    return {
      id: index + 1,
      source: rng.weighted(SOURCES, [4, 2, 4]),
      topic, sentiment, languageIndex,
      createdAt: new Date(time),
      content: writeContent(rng, topic, sentiment, LANGUAGES[languageIndex].code),
      author: `demo_user_${String(rng.int(1, 400)).padStart(4, '0')}`
    };
  });
}

function postTables(posts: PostDraft[], rng: Rng, collectedAt: Date): DemoTable[] {
  const sentimentRows: Cell[][] = [];
  const emotionRows: Cell[][] = [];
  const languageRows: Cell[][] = [];
  const engagementRows: Cell[][] = [];
  const topicRows: Cell[][] = [];
  const hashtagRows: Cell[][] = [];

  for (const post of posts) {
    const confidence = round(0.7 + rng.next() * 0.29, 3);
    sentimentRows.push([post.id, post.id, post.sentiment, confidence, 'DEMO_MODEL', post.createdAt]);

    const emotions = EMOTIONS[bandOf(post.sentiment)];
    const emotion = rng.weighted(emotions, emotions.map((e) => e.weight)).emotion;
    emotionRows.push([post.id, post.id, emotion, round(30 + rng.next() * 65, 2), round(0.6 + rng.next() * 0.38, 3), post.createdAt]);

    languageRows.push([post.id, post.id, LANGUAGES[post.languageIndex].id, round(0.85 + rng.next() * 0.14, 3), 'demo-detector']);
    topicRows.push([post.id, post.id, TOPICS.indexOf(post.topic) + 1, round(0.55 + rng.next() * 0.4, 4), true]);

    const typeId = rng.weighted(CONTENT_TYPES, post.source.contentWeights).id;
    engagementRows.push(engagementRow(rng, post, typeId));
    if (rng.chance(0.35)) {
      const tag = post.content.match(/#\w+/)?.[0];
      if (tag) hashtagRows.push([hashtagRows.length + 1, tag, post.id, round(rng.next() * 40, 2), 1, round(rng.next() * 8, 2), round(rng.next() * 10, 2)]);
    }
  }

  return [
    { name: 'posts', columns: ['id', 'data_source_id', 'external_id', 'content', 'author', 'post_type', 'language', 'created_at', 'collected_at'],
      rows: posts.map((p) => [p.id, p.source.id, `${p.source.platform}_${String(p.id).padStart(5, '0')}`, p.content, p.author, 'post', LANGUAGES[p.languageIndex].code, p.createdAt, collectedAt]) },
    { name: 'sentiment_classifications', columns: ['id', 'post_id', 'sentiment_category', 'confidence_score', 'analysis_model', 'classification_timestamp'], rows: sentimentRows },
    { name: 'emotion_analysis', columns: ['id', 'post_id', 'emotion', 'intensity_score', 'confidence', 'created_at'], rows: emotionRows },
    { name: 'language_detection', columns: ['id', 'post_id', 'language_id', 'confidence_score', 'detection_model'], rows: languageRows },
    { name: 'document_topics', columns: ['id', 'post_id', 'topic_id', 'probability', 'is_primary'], rows: topicRows },
    { name: 'post_engagement', columns: ['id', 'post_id', 'content_type_id', 'likes_count', 'comments_count', 'shares_count', 'saves_count', 'views_count', 'reach', 'impressions', 'engagement_rate', 'click_through_rate', 'video_completion_rate', 'recorded_at'], rows: engagementRows },
    { name: 'hashtag_engagement', columns: ['id', 'hashtag', 'post_id', 'engagement_boost', 'usage_count', 'avg_engagement_rate', 'impact_score'], rows: hashtagRows }
  ];
}

function engagementRow(rng: Rng, post: PostDraft, contentTypeId: number): Cell[] {
  const reach = Math.max(20, Math.round(post.source.reach * Math.exp(rng.gauss() * 0.9) * (0.4 + rng.next())));
  const impressions = Math.round(reach * (1.1 + rng.next() * 0.6));
  const rate = 0.02 + rng.next() * 0.1 + (post.sentiment === 'Very Negative' || post.sentiment === 'Very Positive' ? 0.03 : 0);
  const total = Math.round(reach * rate);
  const likes = Math.round(total * 0.7);
  const comments = Math.round(total * 0.15);
  const shares = Math.round(total * 0.1);
  const isVideo = contentTypeId === 3;
  return [post.id, post.id, contentTypeId, likes, comments, shares, total - likes - comments - shares, impressions, reach, impressions,
    round((total / reach) * 100, 2), contentTypeId === 4 ? round(rng.next() * 6, 2) : 0, isVideo ? round(30 + rng.next() * 55, 2) : 0, post.createdAt];
}

export function generateDemoData(input: DemoOptions = {}): DemoData {
  const options = { seed: 42, now: new Date(), days: 90, postCount: 1500, ...input };
  const rng = createRng(options.seed);
  const posts = draftPosts(rng, options);
  const windowStart = new Date(options.now.getTime() - options.days * DAY_MS);

  return {
    tables: [
      ...referenceTables(options.now),
      ...postTables(posts, rng, options.now),
      ...analyticsTables(posts, rng, windowStart, options.now),
      ...workspaceTables(posts, windowStart, options.now)
    ].sort((a, b) => TABLE_ORDER.indexOf(a.name) - TABLE_ORDER.indexOf(b.name))
  };
}

/** Insert order that satisfies foreign keys. */
export const TABLE_ORDER = [
  'data_sources', 'crawlers', 'languages', 'content_types', 'topics', 'topic_keywords', 'topic_relationships', 'posts',
  'sentiment_classifications', 'emotion_analysis', 'language_detection', 'document_topics', 'post_engagement',
  'hashtag_engagement', 'sentiment_temporal_trends', 'sentiment_keywords', 'topic_trends', 'activity_logs',
  'projects', 'project_members', 'workspaces', 'workspace_data_sources', 'datasets', 'dataset_tags'
];
