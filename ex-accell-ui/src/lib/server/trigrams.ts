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
  /** Start of the period the posts cover; the trend compares its two halves. */
  windowStart: Date;
  minFrequency: number;
  maxResults: number;
  search?: string;
  sentimentRange?: readonly [number, number];
}

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
  return (category !== null ? SENTIMENT_SCORES[category] : undefined) ?? 0;
}

export function tokenize(text: string): string[] {
  const withoutUrls = text.toLowerCase().replace(/https?:\/\/\S+/g, ' ');
  return withoutUrls.match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu) ?? [];
}

/**
 * Distinct phrases in a text. Only the first and last word must be meaningful, so phrases such as
 * "state of emergency" survive while "this is the" does not.
 */
function phrasesIn(text: string): Set<string> {
  const tokens = tokenize(text);
  const phrases = new Set<string>();
  for (let i = 0; i + 2 < tokens.length; i++) {
    if (STOP_WORDS.has(tokens[i]) || STOP_WORDS.has(tokens[i + 2])) continue;
    phrases.add(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }
  return phrases;
}

const mean = (values: number[]): number => (values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length);
const round2 = (value: number): number => Math.round(value * 100) / 100;

function trendOf(posts: TrigramPost[], windowStart: Date, now: Date): 'up' | 'down' | 'stable' {
  const midpoint = windowStart.getTime() + (now.getTime() - windowStart.getTime()) / 2;
  const recent = posts.filter((p) => p.createdAt.getTime() >= midpoint).length;
  const early = posts.length - recent;
  if (recent - early >= 1 && recent > early * TREND_RATIO) return 'up';
  if (early - recent >= 1 && early > recent * TREND_RATIO) return 'down';
  return 'stable';
}

function summarise(trigram: string, posts: TrigramPost[], options: TrigramOptions): TrigramResult {
  const times = posts.map((p) => p.createdAt.getTime());
  const byEngagement = [...posts].sort((a, b) => b.engagementRate - a.engagementRate);
  return {
    trigram,
    frequency: posts.length,
    sentiment: meanSentiment(posts),
    platforms: [...new Set(posts.map((p) => p.platform))].sort(),
    trend: trendOf(posts, options.windowStart, options.now),
    firstSeen: new Date(Math.min(...times)).toISOString(),
    lastSeen: new Date(Math.max(...times)).toISOString(),
    averageEngagement: round2(mean(posts.map((p) => p.engagementRate))),
    topPosts: byEngagement.slice(0, TOP_POST_COUNT).map((p) => p.text)
  };
}

const meanSentiment = (posts: TrigramPost[]): number => round2(mean(posts.map((p) => sentimentScore(p.sentiment))));

export function computeTrigrams(posts: readonly TrigramPost[], options: TrigramOptions): TrigramResult[] {
  const groups = new Map<string, TrigramPost[]>();
  for (const post of posts) {
    for (const phrase of phrasesIn(post.text)) {
      const group = groups.get(phrase);
      if (group) group.push(post);
      else groups.set(phrase, [post]);
    }
  }

  const search = options.search?.trim().toLowerCase();
  const [minSentiment, maxSentiment] = options.sentimentRange ?? [-1, 1];

  // Cheap filters first; the full summary is built only for the rows that are returned
  return [...groups.entries()]
    .filter(([trigram, group]) => group.length >= options.minFrequency && (!search || trigram.includes(search)))
    .filter(([, group]) => {
      const sentiment = meanSentiment(group);
      return sentiment >= minSentiment && sentiment <= maxSentiment;
    })
    .sort(([nameA, a], [nameB, b]) => b.length - a.length || nameA.localeCompare(nameB))
    .slice(0, options.maxResults)
    .map(([trigram, group]) => summarise(trigram, group, options));
}

/**
 * The period phrase trends are measured over. A chosen date range is that range; otherwise it is the last
 * `days`. When the scan hit its cap, or only an end date is set, the oldest post kept is the true start.
 */
export function trendWindow(
  chosen: { start: string | null; end: string | null },
  days: number,
  now: Date,
  oldestKeptMs: number,
  truncated: boolean
): { start: Date; end: Date } {
  const end = chosen.end ? new Date(chosen.end) : now;
  const hasRange = chosen.start !== null || chosen.end !== null;
  if (truncated || (hasRange && !chosen.start)) return { start: new Date(oldestKeptMs), end };
  const start = chosen.start ? new Date(chosen.start) : new Date(now.getTime() - days * 86_400_000);
  return { start, end };
}
