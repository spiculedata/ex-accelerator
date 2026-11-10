import { formatNumber } from './formatUtils';

/** What the badge on an image module card says: a real count, or the honest reason there is none. */
export function moduleBadge(statKey: string | null, stats: Record<string, number | undefined>, unavailable: boolean): string {
  if (!statKey) return 'Preview';
  if (unavailable) return 'Needs setup';
  const count = stats[statKey] ?? 0;
  return count > 0 ? formatNumber(count) : 'No results yet';
}
