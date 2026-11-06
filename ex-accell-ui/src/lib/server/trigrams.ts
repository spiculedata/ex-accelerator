/** Three-word phrase analysis over posts. Pure; the endpoint supplies the posts. */

export interface TrigramPost {
  id: number | string;
  text: string;
  platform: string;
  createdAt: Date;
  sentiment: string | null;
  engagementRate: number;
}

export interface TrigramResult {
  trigram: string;
  frequency: number;
  sentiment: number;
  platforms: string[];
  trend: 'up' | 'down' | 'stable';
  firstSeen: string;
  lastSeen: string;
  averageEngagement: number;
  topPosts: string[];
}

export interface TrigramOptions {
  now: Date;
  days: number;
  minFrequency: number;
  maxResults: number;
  search?: string;
  sentimentRange?: readonly [number, number];
}

const DAY_MS = 86_400_000;
const TOP_POST_COUNT = 3;
const TREND_RATIO = 1.5;

const SENTIMENT_SCORES: Readonly<Record<string, number>> = {
  'Very Positive': 1,
  Positive: 0.5,
  Neutral: 0,
  Negative: -0.5,
  'Very Negative': -1
};

const STOP_WORDS = new Set(
  ('a an and are as at be been but by for from had has have he her his i if in into is it its me my no not of on or our she so that the their them then there these they this to too us was we were what when where which who will with would you your ' +
    'de la le les un une des du et en el los las y que por con para ' +
    'der die das und ist nicht ein eine zu von mit auf').split(' ')
);

export function sentimentScore(category: string | null): number {
  return (category !== null && SENTIMENT_SCORES[category]) || 0;
}

export function tokenize(text: string): string[] {
  const withoutUrls = text.toLowerCase().replace(/https?:\/\/\S+/g, ' ');
  return withoutUrls.match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu) ?? [];
}

/** Distinct phrases in a text whose first and last words are meaningful. */
function phrasesIn(text: string): Set<string> {
  const tokens = tokenize(text);
  const phrases = new Set<string>();
  for (let i = 0; i + 2 < tokens.length; i++) {
    if (STOP_WORDS.has(tokens[i]) || STOP_WORDS.has(tokens[i + 2])) continue;
    phrases.add(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }
  return phrases;
}

interface Accumulator {
  posts: TrigramPost[];
}

const mean = (values: number[]): number => (values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length);
const round2 = (value: number): number => Math.round(value * 100) / 100;

function trendOf(posts: TrigramPost[], now: Date, days: number): 'up' | 'down' | 'stable' {
  const midpoint = now.getTime() - (days * DAY_MS) / 2;
  const recent = posts.filter((p) => p.createdAt.getTime() >= midpoint).length;
  const early = posts.length - recent;
  if (recent - early >= 1 && recent > early * TREND_RATIO) return 'up';
  if (early - recent >= 1 && early > recent * TREND_RATIO) return 'down';
  return 'stable';
}

function summarise(trigram: string, { posts }: Accumulator, options: TrigramOptions): TrigramResult {
  const times = posts.map((p) => p.createdAt.getTime());
  const byEngagement = [...posts].sort((a, b) => b.engagementRate - a.engagementRate);
  return {
    trigram,
    frequency: posts.length,
    sentiment: round2(mean(posts.map((p) => sentimentScore(p.sentiment)))),
    platforms: [...new Set(posts.map((p) => p.platform))].sort(),
    trend: trendOf(posts, options.now, options.days),
    firstSeen: new Date(Math.min(...times)).toISOString(),
    lastSeen: new Date(Math.max(...times)).toISOString(),
    averageEngagement: round2(mean(posts.map((p) => p.engagementRate))),
    topPosts: byEngagement.slice(0, TOP_POST_COUNT).map((p) => p.text)
  };
}

export function computeTrigrams(posts: readonly TrigramPost[], options: TrigramOptions): TrigramResult[] {
  const groups = new Map<string, Accumulator>();
  for (const post of posts) {
    for (const phrase of phrasesIn(post.text)) {
      const group = groups.get(phrase) ?? { posts: [] };
      group.posts.push(post);
      groups.set(phrase, group);
    }
  }

  const search = options.search?.trim().toLowerCase();
  const [minSentiment, maxSentiment] = options.sentimentRange ?? [-1, 1];

  return [...groups.entries()]
    .filter(([trigram, group]) => group.posts.length >= options.minFrequency && (!search || trigram.includes(search)))
    .map(([trigram, group]) => summarise(trigram, group, options))
    .filter((row) => row.sentiment >= minSentiment && row.sentiment <= maxSentiment)
    .sort((a, b) => b.frequency - a.frequency || a.trigram.localeCompare(b.trigram))
    .slice(0, options.maxResults);
}
