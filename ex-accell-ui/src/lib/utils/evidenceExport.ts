// Turning workbench posts into evidence a researcher can cite and share. Posts carry no permalink in this
// data, so a record gives the platform, post id, author and an ISO 8601 UTC time, which is enough to find it again.

export interface SocialPost {
  id: number | string;
  text?: string | null;
  timestamp?: string | number | null;
  platform?: string | null;
  author?: string | null;
  sentiment_category?: string | null;
  confidence_score?: number | string | null;
  emotions?: string | null;
  engagement_likes?: number | null;
  engagement_shares?: number | null;
  engagement_comments?: number | null;
}

export interface PostRecord {
  id: number | string;
  platform: string;
  author: string;
  posted_at: string;
  text: string;
  sentiment: string;
  confidence: number | null;
  emotions: string;
  likes: number | null;
  shares: number | null;
  comments: number | null;
  citation: string;
}

const isoFromEpochMs = (value: SocialPost['timestamp']): string => {
  const ms = typeof value === 'string' ? Number(value) : value;
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '';
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

export function socialPostRecord(post: SocialPost): PostRecord {
  const platform = post.platform ?? '';
  const author = post.author ?? '';
  const posted_at = isoFromEpochMs(post.timestamp);
  const confidence = post.confidence_score === null || post.confidence_score === undefined ? null : Number(post.confidence_score);
  const citation = `${platform} post #${post.id}${author ? ` by ${author}` : ''}${posted_at ? `, ${posted_at}` : ''}`;
  return {
    id: post.id,
    platform,
    author,
    posted_at,
    text: post.text ?? '',
    sentiment: post.sentiment_category ?? '',
    confidence: confidence !== null && Number.isFinite(confidence) ? confidence : null,
    emotions: post.emotions ?? '',
    likes: post.engagement_likes ?? null,
    shares: post.engagement_shares ?? null,
    comments: post.engagement_comments ?? null,
    citation
  };
}

// A spreadsheet runs a cell that starts with one of these as a formula, so exported text is prefixed with '
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with CRLF line endings. Cells that a spreadsheet would run as formulas are neutralised. */
export function toCsv<T extends object>(rows: readonly T[], columns: readonly (keyof T & string)[]): string {
  const lines = [columns.join(','), ...rows.map((row) => columns.map((column) => cell(row[column as keyof T])).join(','))];
  return lines.join('\r\n') + '\r\n';
}
