// Display helpers for the investigation workbench rows.

const MONTH_DAY = { month: 'short', day: 'numeric' } as const;
const MS_THRESHOLD = 1e12;
const SECONDS_THRESHOLD = 1e9;
const TONE_RANGE_OFFSET = 10;
const TONE_BAR_SCALE = 5;

export function formatGdeltDate(sqldate: string | number): string {
  const s = String(sqldate);
  if (s.length !== 8) return s;
  const d = new Date(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8)));
  return d.toLocaleDateString('en-US', MONTH_DAY);
}

/** A post time that may be an ISO string, epoch milliseconds or epoch seconds (as a number or numeric text). */
export function formatPostDate(timestamp: string | number | undefined): string {
  if (!timestamp && timestamp !== 0) return '';
  const fmt = (d: Date) => (isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', MONTH_DAY));
  if (typeof timestamp === 'number') {
    if (timestamp > MS_THRESHOLD) return fmt(new Date(timestamp));
    if (timestamp > SECONDS_THRESHOLD) return fmt(new Date(timestamp * 1000));
    return '';
  }
  // Try ISO string parse first (most common for API data)
  const d = new Date(timestamp);
  if (!isNaN(d.getTime())) return fmt(d);
  // Try numeric parse as fallback
  const ts = Number(timestamp);
  if (!isNaN(ts) && ts > MS_THRESHOLD) return fmt(new Date(ts));
  if (!isNaN(ts) && ts > SECONDS_THRESHOLD) return fmt(new Date(ts * 1000));
  return '';
}

export function goldsteinColor(val: number): string {
  if (val >= 5) return 'bg-emerald-600/80 text-emerald-100';
  if (val >= 2) return 'bg-emerald-700/60 text-emerald-200';
  if (val >= 0.5) return 'bg-emerald-800/40 text-emerald-300';
  if (val > -0.5) return 'bg-slate-700/50 text-slate-300';
  if (val > -2) return 'bg-rose-800/40 text-rose-300';
  if (val > -5) return 'bg-rose-700/60 text-rose-200';
  return 'bg-rose-600/80 text-rose-100';
}

/** Width in percent for a tone of -10 (empty) to +10 (full). */
export function toneBarWidth(tone: number): number {
  return Math.min(100, Math.max(0, (tone + TONE_RANGE_OFFSET) * TONE_BAR_SCALE));
}

export function sentimentDotColor(sentiment?: string): string {
  const s = (sentiment || 'neutral').toLowerCase();
  if (s === 'positive') return 'bg-sentiment-positive';
  if (s === 'negative') return 'bg-sentiment-negative';
  return 'bg-sentiment-neutral';
}
