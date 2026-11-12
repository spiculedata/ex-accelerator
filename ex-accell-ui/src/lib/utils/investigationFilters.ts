// Narrowing the loaded records to the active cross-filter and time range.

import type { CrossFilter } from '$lib/stores/investigationStore';
import type { GdeltEvent, RadioSegment, WorkbenchPost } from './investigationTypes';

const NEUTRAL_TONE_LIMIT = 1;

const includesText = (haystack: string | undefined, needle: string): boolean =>
  (haystack || '').toLowerCase().includes(needle.toLowerCase());

/** Keeps the days inside the chosen range; the full range, or no range, keeps everything. */
export function filterTimelineToRange<T extends { date: string }>(
  timeline: T[],
  range: { start: string; end: string } | null,
  fullStart: string,
  fullEnd: string
): T[] {
  if (!range || (range.start === fullStart && range.end === fullEnd)) return timeline;
  return timeline.filter((d) => d.date >= range.start && d.date <= range.end);
}

export function filterGdeltByCrossFilter(events: GdeltEvent[], filter: CrossFilter | null): GdeltEvent[] {
  if (!filter) return events;
  switch (filter.dimension) {
    case 'actor':
      return events.filter((e) => includesText(e.actor1name, filter.value) || includesText(e.actor2name, filter.value));
    case 'location':
      return events.filter((e) => includesText(e.actiongeo_fullname, filter.value));
    case 'keyword':
      return events.filter((e) =>
        includesText(`${e.actor1name || ''} ${e.actor2name || ''} ${e.actiongeo_fullname || ''}`, filter.value)
      );
    case 'sentiment':
      return events.filter((e) => {
        const tone = e.avgtone ?? e.avg_tone ?? 0;
        if (filter.value === 'positive') return tone > NEUTRAL_TONE_LIMIT;
        if (filter.value === 'negative') return tone < -NEUTRAL_TONE_LIMIT;
        return tone >= -NEUTRAL_TONE_LIMIT && tone <= NEUTRAL_TONE_LIMIT; // neutral
      });
    case 'date':
      return events.filter((e) => {
        const s = String(e.sqldate);
        const eventDate = s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
        return eventDate === filter.value;
      });
    default:
      return events;
  }
}

export function filterRadioByCrossFilter(segments: RadioSegment[], filter: CrossFilter | null): RadioSegment[] {
  if (!filter) return segments;
  switch (filter.dimension) {
    case 'keyword':
      return segments.filter((s) => includesText(s.transcript, filter.value));
    case 'sentiment':
      return segments.filter((s) => (s.sentiment || '').toLowerCase() === filter.value);
    case 'date':
      return segments.filter((s) => (s.segment_start || '').split('T')[0] === filter.value);
    default:
      return segments;
  }
}

export function filterSocialByCrossFilter(posts: WorkbenchPost[], filter: CrossFilter | null): WorkbenchPost[] {
  if (!filter) return posts;
  switch (filter.dimension) {
    case 'keyword':
      return posts.filter((p) => includesText(p.text, filter.value));
    case 'sentiment':
      return posts.filter((p) => (p.sentiment_category || '').toLowerCase() === filter.value);
    case 'date':
      return posts.filter((p) => (p.timestamp || '').split('T')[0] === filter.value);
    default:
      return posts;
  }
}
