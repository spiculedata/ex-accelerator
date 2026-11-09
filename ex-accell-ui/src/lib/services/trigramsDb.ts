import { currentRangeQuery } from '$lib/utils/filterRange';
export interface TrigramData {
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

export interface TrigramFilters {
  platform?: string;
  timeRange?: string;
  minFrequency?: number;
  maxResults?: number;
  searchQuery?: string;
  sentimentRange?: [number, number];
}

export interface TrigramStats {
  totalTrigrams: number;
  uniqueTrigrams: number;
  averageFrequency: number;
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  trendDistribution: { up: number; stable: number; down: number };
}

const SENTIMENT_THRESHOLD = 0.3;
const API_URL = '/api/unified-analytics';

/** Quotes a CSV field, doubling any embedded quote. */
const csvField = (value: string): string => `"${value.replace(/"/g, '""')}"`;

export interface TrigramsResult {
  data: TrigramData[];
  /** True when the server stopped scanning at its post limit, so older posts are not reflected. */
  truncated: boolean;
}

const sentimentLabel = (sentiment: number): string =>
  sentiment > SENTIMENT_THRESHOLD ? 'Positive' : sentiment < -SENTIMENT_THRESHOLD ? 'Negative' : 'Neutral';

/** Headline numbers for a list of phrases. */
export function summarizeTrigrams(data: readonly TrigramData[]): TrigramStats {
  const totalTrigrams = data.reduce((sum, item) => sum + item.frequency, 0);
  const sentimentDistribution = { positive: 0, neutral: 0, negative: 0 };
  const trendDistribution = { up: 0, stable: 0, down: 0 };

  for (const item of data) {
    const label = sentimentLabel(item.sentiment).toLowerCase() as keyof typeof sentimentDistribution;
    sentimentDistribution[label]++;
    trendDistribution[item.trend]++;
  }

  return {
    totalTrigrams,
    uniqueTrigrams: data.length,
    averageFrequency: data.length > 0 ? Math.round(totalTrigrams / data.length) : 0,
    sentimentDistribution,
    trendDistribution
  };
}

/** Client for the server-side trigram analysis. Failures throw so the page can show an error. */
class TrigramsDatabase {
  async getTrigramsData(filters: TrigramFilters = {}, workspaceId?: string): Promise<TrigramData[]> {
    return (await this.getTrigramsResult(filters, workspaceId)).data;
  }

  async getTrigramsResult(filters: TrigramFilters = {}, workspaceId?: string): Promise<TrigramsResult> {
    const params = new URLSearchParams({ type: 'trigrams' });
    const optional: Record<string, string | number | undefined> = {
      platform: filters.platform,
      timeRange: filters.timeRange,
      minFrequency: filters.minFrequency,
      maxResults: filters.maxResults,
      search: filters.searchQuery || undefined,
      minSentiment: filters.sentimentRange?.[0],
      maxSentiment: filters.sentimentRange?.[1],
      workspace_id: workspaceId
    };
    for (const [key, value] of Object.entries({ ...optional, ...currentRangeQuery() })) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }

    const response = await fetch(`${API_URL}?${params}`);
    // An error page from a proxy is not JSON; report the status instead of a parse error
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) throw new Error(body.error || `Trigram request failed (${response.status})`);
    return { data: body.data as TrigramData[], truncated: body.meta?.truncated === true };
  }

  async exportTrigramsData(filters: TrigramFilters = {}, workspaceId?: string): Promise<string> {
    const data = await this.getTrigramsData(filters, workspaceId);
    const header = 'Trigram,Frequency,Sentiment,Sentiment Label,Platforms,Trend,First Seen,Last Seen,Average Engagement';
    const rows = data.map((item) =>
      [
        csvField(item.trigram),
        item.frequency,
        item.sentiment.toFixed(2),
        sentimentLabel(item.sentiment),
        csvField(item.platforms.join('; ')),
        item.trend,
        item.firstSeen,
        item.lastSeen,
        item.averageEngagement.toFixed(1)
      ].join(',')
    );
    return [header, ...rows].join('\n');
  }
}

export const trigramsDb = new TrigramsDatabase();
