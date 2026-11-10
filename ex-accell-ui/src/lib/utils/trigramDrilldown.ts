import { filtersFromParams, type PostFilters } from '$lib/services/postsApi';

const MS_PER_DAY = 86_400_000;

interface Options {
  /** The phrase as the page counted it. */
  phrase: string;
  /** The page's query parameters (workspace and the date bar's range). */
  params: Record<string, string>;
  /** The platform chosen on the page, or `all`. */
  platform: string;
  /** How many days back the counts reach when no date range is chosen. */
  defaultDays: number;
  now?: Date;
}

/**
 * The posts to open for a counted phrase: the same words, in the same period and platform as the count, so the number on
 * the page and the list behind it agree. The period is the date bar's range, or the last `defaultDays` days.
 */
export function trigramDrilldownFilters({ phrase, params, platform, defaultDays, now = new Date() }: Options): PostFilters {
  const chosen = filtersFromParams(params);
  const hasRange = chosen.dateStart !== undefined || chosen.dateEnd !== undefined;
  return {
    phrase,
    ...(chosen.workspaceId ? { workspaceId: chosen.workspaceId } : {}),
    ...(platform !== 'all' ? { platforms: [platform] } : {}),
    ...(chosen.dateStart ? { dateStart: chosen.dateStart } : {}),
    ...(chosen.dateEnd ? { dateEnd: chosen.dateEnd } : {}),
    ...(!hasRange ? { dateStart: new Date(now.getTime() - defaultDays * MS_PER_DAY).toISOString() } : {})
  };
}
