// Consolidated formatting utilities — consistent number, date, and percentage formatting

/**
 * Format a number for display: 1234 → "1.2K", 1234567 → "1.2M"
 */
export function formatNumber(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Safe division — returns fallback instead of NaN/Infinity
 */
export function safeDiv(numerator: number, denominator: number, fallback: number = 0): number {
  if (!denominator || !isFinite(numerator / denominator)) return fallback;
  return numerator / denominator;
}

/**
 * Format a percentage from a count and total — safe against division by zero
 */
export function formatPercentage(count: number, total: number, decimals: number = 1): string {
  if (!total || total === 0) return '0%';
  return `${(safeDiv(count, total) * 100).toFixed(decimals)}%`;
}

/**
 * Format a date for consistent display
 */
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '—';
  }
}

/**
 * Format a timestamp for consistent display
 */
export function formatTimestamp(date: string | number | Date | undefined | null): string {
  if (date === undefined || date === null || date === '') return '—';
  // The posts view stores times as epoch milliseconds (13 digits today), which arrive as a number or a numeric string; shorter digit strings are not treated as times
  const value = typeof date === 'string' && /^\d{12,}$/.test(date.trim()) ? Number(date) : date;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format a relative time: "2 hours ago", "3 days ago"
 */
export function formatRelativeTime(date: string | Date | undefined | null): string {
  if (!date) return '—';
  try {
    const now = Date.now();
    const then = new Date(date).getTime();
    const diffMs = now - then;

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;

    return `${Math.floor(months / 12)}y ago`;
  } catch {
    return '—';
  }
}

/**
 * Safely coerce a value to a number, returning fallback for non-numeric values
 */
export function toNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return isFinite(n) ? n : fallback;
  }
  return fallback;
}
