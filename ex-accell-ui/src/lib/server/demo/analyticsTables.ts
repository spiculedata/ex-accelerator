import { TOPICS, bandOf } from './content';
import type { Rng } from './rng';
import type { Cell, DemoTable, PostDraft } from './types';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const round = (value: number, places: number) => Number(value.toFixed(places));

/** Topic, trend and keyword tables derived from the generated posts. */
export function analyticsTables(posts: PostDraft[], rng: Rng, windowStart: Date, now: Date): DemoTable[] {
  return [
    ...topicTables(posts, rng),
    hourlyTrends(posts),
    keywordTable(posts, rng, windowStart, now),
    topicTrends(posts, windowStart, now),
    activityLog(now)
  ];
}

function topicTables(posts: PostDraft[], rng: Rng): DemoTable[] {
  const counts = TOPICS.map((topic) => posts.filter((p) => p.topic === topic).length);
  const keywordRows: Cell[][] = [];
  TOPICS.forEach((topic, index) =>
    topic.keywords.forEach((keyword, rank) =>
      keywordRows.push([keywordRows.length + 1, index + 1, keyword, round(0.9 - rank * 0.12, 4), rank + 1])
    )
  );
  return [
    {
      name: 'topics',
      columns: ['id', 'topic_id', 'name', 'category', 'category_color', 'size', 'weight', 'coherence_score'],
      rows: TOPICS.map((t, i) => [i + 1, `topic-${t.key}`, t.name, t.category, t.color, counts[i], round(counts[i] / posts.length, 3), round(0.5 + rng.next() * 0.35, 3)])
    },
    { name: 'topic_keywords', columns: ['id', 'topic_id', 'keyword', 'weight', 'rank_position'], rows: keywordRows },
    { name: 'topic_relationships', columns: ['id', 'topic1_id', 'topic2_id', 'similarity_score', 'relationship_type', 'strength'], rows: relatedTopics() }
  ];
}

function hourlyTrends(posts: PostDraft[]): DemoTable {
  const buckets = new Map<string, { date: string; hour: number; platform: string; pos: number; neg: number; neu: number }>();
  for (const post of posts) {
    const date = dateOnly(post.createdAt);
    const hour = post.createdAt.getUTCHours();
    const key = `${date}|${hour}|${post.source.platform}`;
    const bucket = buckets.get(key) ?? { date, hour, platform: post.source.platform, pos: 0, neg: 0, neu: 0 };
    const band = bandOf(post.sentiment);
    if (band === 'positive') bucket.pos++;
    else if (band === 'negative') bucket.neg++;
    else bucket.neu++;
    buckets.set(key, bucket);
  }
  const rows = [...buckets.values()]
    .sort((a, b) => `${a.date}${String(a.hour).padStart(2, '0')}${a.platform}`.localeCompare(`${b.date}${String(b.hour).padStart(2, '0')}${b.platform}`))
    .map((b, i): Cell[] => [i + 1, b.date, b.hour, b.platform, b.pos, b.neg, b.neu, b.pos + b.neg + b.neu, 0.86]);
  return {
    name: 'sentiment_temporal_trends',
    columns: ['id', 'analysis_date', 'analysis_hour', 'platform', 'positive_count', 'negative_count', 'neutral_count', 'total_posts', 'avg_confidence'],
    rows
  };
}

function keywordTable(posts: PostDraft[], rng: Rng, windowStart: Date, now: Date): DemoTable {
  const rows: Cell[][] = [];
  TOPICS.forEach((topic) => {
    const inTopic = posts.filter((p) => p.topic === topic);
    const negative = inTopic.filter((p) => bandOf(p.sentiment) === 'negative').length;
    const positive = inTopic.filter((p) => bandOf(p.sentiment) === 'positive').length;
    const type = positive >= negative ? 'positive' : 'negative';
    const platforms = JSON.stringify([...new Set(inTopic.map((p) => p.source.platform))]);
    topic.keywords.slice(0, 4).forEach((keyword, rank) =>
      rows.push([rows.length + 1, keyword, type, Math.round(inTopic.length * (0.5 - rank * 0.1)), round(8 - rank * 1.2 + rng.next(), 2), platforms, dateOnly(windowStart), dateOnly(now)])
    );
  });
  return { name: 'sentiment_keywords', columns: ['id', 'keyword', 'sentiment_type', 'frequency', 'impact_score', 'platforms', 'analysis_period_start', 'analysis_period_end'], rows };
}

function topicTrends(posts: PostDraft[], windowStart: Date, now: Date): DemoTable {
  const weeks = Math.ceil((now.getTime() - windowStart.getTime()) / WEEK_MS);
  const rows: Cell[][] = [];
  TOPICS.forEach((topic, index) => {
    let previous = 0;
    for (let week = 0; week < weeks; week++) {
      const from = windowStart.getTime() + week * WEEK_MS;
      const count = posts.filter((p) => p.topic === topic && p.createdAt.getTime() >= from && p.createdAt.getTime() < from + WEEK_MS).length;
      const growth = previous === 0 ? 0 : round(((count - previous) / previous) * 100, 3);
      rows.push([rows.length + 1, index + 1, dateOnly(new Date(from)), count, round(3 + count / 20, 2), growth, growth > 10 ? 'RISING' : growth < -10 ? 'FALLING' : 'STABLE']);
      previous = count;
    }
  });
  return { name: 'topic_trends', columns: ['id', 'topic_id', 'analysis_date', 'document_count', 'average_engagement', 'growth_rate', 'trend_direction'], rows };
}

function activityLog(now: Date): DemoTable {
  const events = [
    ['crawl', 'Demo Telegram crawl completed', 'success', 1], ['crawl', 'Demo YouTube crawl completed', 'success', 2],
    ['crawl', 'Demo Bluesky crawl completed', 'success', 3], ['analysis', 'Sentiment analysis refreshed', 'info', 1],
    ['analysis', 'Topic model updated', 'info', 2], ['system', 'Demo dataset loaded', 'info', 1]
  ] as const;
  return {
    name: 'activity_logs',
    columns: ['id', 'activity_type', 'message', 'status', 'data_source_id', 'created_at'],
    rows: events.map(([type, message, status, source], i) => [i + 1, type, message, status, source, new Date(now.getTime() - i * 3_600_000)])
  };
}

/** Topic pairs that plausibly overlap (by topic order in content.ts). */
function relatedTopics(): Cell[][] {
  const pairs: Array<[string, string, number, string]> = [
    ['transit', 'cycling', 0.62, 'SIMILAR'], ['heat', 'water', 0.55, 'OVERLAPPING'], ['festival', 'business', 0.58, 'SIMILAR'],
    ['housing', 'business', 0.41, 'OVERLAPPING'], ['schools', 'housing', 0.37, 'OVERLAPPING'], ['cycling', 'heat', 0.33, 'OVERLAPPING']
  ];
  const index = (key: string) => TOPICS.findIndex((t) => t.key === key) + 1;
  return pairs.map(([a, b, score, type], i) => [i + 1, index(a), index(b), score, type, round(score, 2)]);
}
