// Building the requests the investigation workbench makes, and reading their answers.

import type { TimelineEntry } from '$lib/components/investigation/SwimLaneTimeline.svelte';

/** The analytics URL for one investigation query type; keywords and dates are left out when empty. */
export function buildInvestigationQuery(type: string, keywords: string[], dateStart: string, dateEnd: string, limit?: number): string {
  const params = new URLSearchParams({ type, ...(limit === undefined ? {} : { limit: String(limit) }) });
  if (keywords.length) params.set('keywords', keywords.join(','));
  if (dateStart) params.set('date_start', dateStart);
  if (dateEnd) params.set('date_end', dateEnd);
  return `/api/unified-analytics?${params}`;
}

/** Day rows from the timeline query, with dates cut to the day and every count made a number. */
export function normalizeTimeline(raw: Array<Record<string, any>>): TimelineEntry[] {
  return raw.map((d) => ({
    date: typeof d.date === 'string' && d.date.includes('T') ? d.date.split('T')[0] : d.date,
    gdelt_events: Number(d.gdelt_events ?? d.events ?? 0),
    gdelt_avg_goldstein: Number(d.gdelt_avg_goldstein ?? d.avg_goldstein ?? 0),
    gdelt_avg_tone: Number(d.gdelt_avg_tone ?? d.avg_tone ?? 0),
    radio_segments: Number(d.radio_segments ?? 0),
    radio_positive: Number(d.radio_positive ?? 0),
    radio_negative: Number(d.radio_negative ?? 0),
    radio_neutral: Number(d.radio_neutral ?? 0),
    social_posts: Number(d.social_posts ?? 0),
    social_positive: Number(d.social_positive ?? 0),
    social_negative: Number(d.social_negative ?? 0),
    social_neutral: Number(d.social_neutral ?? 0)
  }));
}
