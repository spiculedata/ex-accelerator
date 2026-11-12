import type { CrossFilter } from '$lib/stores/investigationStore';

/**
 * Cross-filter helper functions for computing highlight sets across portal dimensions.
 * These mine the already-loaded gdeltEvents array to find relationships between
 * actors, locations, and keywords — enabling cross-dimensional highlighting
 * without additional API calls.
 */

/** The GDELT event fields the cross-filter reads; rows carry many more, and either tone spelling can appear. */
export interface GdeltEventRow {
  actor1name?: string | null;
  actor2name?: string | null;
  actiongeo_fullname?: string | null;
  sqldate?: string | number | null;
  avgtone?: number | string | null;
  avg_tone?: number | string | null;
}

/** One day of the fused timeline, with the per-source counts the sentiment fusion reads. */
export interface TimelineDayRow {
  date: string;
  gdelt_events?: number | null;
  gdelt_avg_tone?: number | null;
  radio_segments?: number | null;
  radio_positive?: number | null;
  radio_negative?: number | null;
  social_posts?: number | null;
  social_positive?: number | null;
  social_negative?: number | null;
}

function normalizeForMatch(value?: string | null): string {
  return (value || '').toLowerCase().trim();
}

function actorMatches(event: GdeltEventRow, actor: string): boolean {
  const norm = normalizeForMatch(actor);
  return normalizeForMatch(event.actor1name).includes(norm) ||
         normalizeForMatch(event.actor2name).includes(norm);
}

function locationMatches(event: GdeltEventRow, location: string): boolean {
  return normalizeForMatch(event.actiongeo_fullname).includes(normalizeForMatch(location));
}

function keywordMatches(event: GdeltEventRow, keyword: string): boolean {
  const norm = normalizeForMatch(keyword);
  const text = `${event.actor1name || ''} ${event.actor2name || ''} ${event.actiongeo_fullname || ''}`.toLowerCase();
  return text.includes(norm);
}

function eventDate(event: GdeltEventRow): string {
  const s = String(event.sqldate || '');
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s.split('T')[0];
}

function eventSentiment(event: GdeltEventRow): string {
  const tone = Number(event.avgtone ?? event.avg_tone ?? 0);
  if (tone > 1) return 'positive';
  if (tone < -1) return 'negative';
  return 'neutral';
}

/** Given an actor, find all locations where they appear in GDELT events */
export function extractActorLocations(gdeltEvents: GdeltEventRow[], actor: string): Set<string> {
  const locations = new Set<string>();
  for (const e of gdeltEvents) {
    if (actorMatches(e, actor) && e.actiongeo_fullname) {
      locations.add(e.actiongeo_fullname);
    }
  }
  return locations;
}

/** Given an actor, find co-occurring terms (other actors + locations) */
export function extractActorKeywords(gdeltEvents: GdeltEventRow[], actor: string): Set<string> {
  const terms = new Set<string>();
  for (const e of gdeltEvents) {
    if (!actorMatches(e, actor)) continue;
    if (e.actor1name && !normalizeForMatch(e.actor1name).includes(normalizeForMatch(actor))) {
      terms.add(e.actor1name);
    }
    if (e.actor2name && !normalizeForMatch(e.actor2name).includes(normalizeForMatch(actor))) {
      terms.add(e.actor2name);
    }
    if (e.actiongeo_fullname) terms.add(e.actiongeo_fullname);
  }
  return terms;
}

/** Given a location, find all actors present there */
export function extractLocationActors(gdeltEvents: GdeltEventRow[], location: string): Set<string> {
  const actors = new Set<string>();
  for (const e of gdeltEvents) {
    if (!locationMatches(e, location)) continue;
    if (e.actor1name) actors.add(e.actor1name);
    if (e.actor2name) actors.add(e.actor2name);
  }
  return actors;
}

/** Given a location, find co-occurring terms (actors at that location) */
export function extractLocationKeywords(gdeltEvents: GdeltEventRow[], location: string): Set<string> {
  const terms = new Set<string>();
  for (const e of gdeltEvents) {
    if (!locationMatches(e, location)) continue;
    if (e.actor1name) terms.add(e.actor1name);
    if (e.actor2name) terms.add(e.actor2name);
  }
  return terms;
}

/** Given a keyword, find actors from events mentioning it */
export function extractKeywordActors(gdeltEvents: GdeltEventRow[], keyword: string): Set<string> {
  const actors = new Set<string>();
  for (const e of gdeltEvents) {
    if (!keywordMatches(e, keyword)) continue;
    if (e.actor1name) actors.add(e.actor1name);
    if (e.actor2name) actors.add(e.actor2name);
  }
  return actors;
}

/** Given a keyword, find locations from events mentioning it */
export function extractKeywordLocations(gdeltEvents: GdeltEventRow[], keyword: string): Set<string> {
  const locations = new Set<string>();
  for (const e of gdeltEvents) {
    if (!keywordMatches(e, keyword)) continue;
    if (e.actiongeo_fullname) locations.add(e.actiongeo_fullname);
  }
  return locations;
}

/** Given a date, extract all entities active on that date */
export function extractDateEntities(gdeltEvents: GdeltEventRow[], date: string): { actors: Set<string>; locations: Set<string> } {
  const actors = new Set<string>();
  const locations = new Set<string>();
  for (const e of gdeltEvents) {
    if (eventDate(e) !== date) continue;
    if (e.actor1name) actors.add(e.actor1name);
    if (e.actor2name) actors.add(e.actor2name);
    if (e.actiongeo_fullname) locations.add(e.actiongeo_fullname);
  }
  return { actors, locations };
}

/** Given a sentiment bucket, extract all entities matching that sentiment */
export function extractSentimentEntities(gdeltEvents: GdeltEventRow[], sentiment: string): { actors: Set<string>; locations: Set<string>; keywords: Set<string> } {
  const actors = new Set<string>();
  const locations = new Set<string>();
  const keywords = new Set<string>();
  for (const e of gdeltEvents) {
    if (eventSentiment(e) !== sentiment) continue;
    if (e.actor1name) { actors.add(e.actor1name); keywords.add(e.actor1name); }
    if (e.actor2name) { actors.add(e.actor2name); keywords.add(e.actor2name); }
    if (e.actiongeo_fullname) { locations.add(e.actiongeo_fullname); keywords.add(e.actiongeo_fullname); }
  }
  return { actors, locations, keywords };
}

/** Given a date, extract keywords (actor names + locations) active on that date */
export function extractDateKeywords(gdeltEvents: GdeltEventRow[], date: string): Set<string> {
  const keywords = new Set<string>();
  for (const e of gdeltEvents) {
    if (eventDate(e) !== date) continue;
    if (e.actor1name) keywords.add(e.actor1name);
    if (e.actor2name) keywords.add(e.actor2name);
    if (e.actiongeo_fullname) keywords.add(e.actiongeo_fullname);
  }
  return keywords;
}

/**
 * Classify a fused sentiment score (-1..+1) into a sentiment bucket.
 */
export function classifySentiment(score: number): string {
  if (score > 0.05) return 'positive';
  if (score < -0.05) return 'negative';
  return 'neutral';
}

/**
 * For timeline data, determine which days should be highlighted given the active cross-filter.
 * Returns a Set of date strings that match, or null if no day-level filtering applies.
 * null means "show all days normally" (no highlighting/dimming).
 */
export function computeTimelineHighlightDays(
  crossFilter: CrossFilter | null,
  timelineData: TimelineDayRow[],
  gdeltEvents: GdeltEventRow[]
): Set<string> | null {
  if (!crossFilter) return null;

  switch (crossFilter.dimension) {
    case 'date':
      return new Set([crossFilter.value]);

    case 'sentiment': {
      // Highlight days where fused sentiment matches the filter
      const matchingDays = new Set<string>();
      for (const d of timelineData) {
        const gdeltSent = (d.gdelt_events ?? 0) > 0 ? (d.gdelt_avg_tone ?? 0) / 10 : null;
        const radioTotal = d.radio_segments ?? 0;
        const radioSent = radioTotal > 0 ? ((d.radio_positive ?? 0) - (d.radio_negative ?? 0)) / radioTotal : null;
        const socialTotal = d.social_posts ?? 0;
        const socialSent = socialTotal > 0 ? ((d.social_positive ?? 0) - (d.social_negative ?? 0)) / socialTotal : null;
        const sources = [gdeltSent, radioSent, socialSent].filter((v): v is number => v !== null);
        const score = sources.length > 0 ? sources.reduce((a, b) => a + b, 0) / sources.length : 0;
        if (classifySentiment(score) === crossFilter.value) {
          matchingDays.add(d.date);
        }
      }
      return matchingDays;
    }

    case 'actor':
    case 'location':
    case 'keyword': {
      // Find which dates have GDELT events matching the filter
      const matchingDays = new Set<string>();
      for (const e of gdeltEvents) {
        let matches = false;
        if (crossFilter.dimension === 'actor') {
          const norm = (crossFilter.value || '').toLowerCase();
          matches = (e.actor1name || '').toLowerCase().includes(norm) ||
                    (e.actor2name || '').toLowerCase().includes(norm);
        } else if (crossFilter.dimension === 'location') {
          matches = (e.actiongeo_fullname || '').toLowerCase().includes((crossFilter.value || '').toLowerCase());
        } else {
          const text = `${e.actor1name || ''} ${e.actor2name || ''} ${e.actiongeo_fullname || ''}`.toLowerCase();
          matches = text.includes((crossFilter.value || '').toLowerCase());
        }
        if (matches) {
          const s = String(e.sqldate || '');
          const date = s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s.split('T')[0];
          matchingDays.add(date);
        }
      }
      return matchingDays.size > 0 ? matchingDays : null; // null = no GDELT data, don't dim
    }

    default:
      return null;
  }
}

/**
 * Unified highlight set computation.
 * Given the active cross-filter and target dimension, returns the set of values
 * that should be highlighted in that dimension.
 *
 * Returns empty set if no cross-filter is active or if the filter dimension
 * matches the target (handled by portal's own highlighting).
 */
export function computeHighlightSet(
  crossFilter: CrossFilter | null,
  gdeltEvents: GdeltEventRow[],
  targetDimension: 'actor' | 'location' | 'keyword'
): Set<string> {
  if (!crossFilter || gdeltEvents.length === 0) return new Set();

  const { dimension, value } = crossFilter;

  // If filtering the same dimension, the portal handles its own highlighting
  if (dimension === targetDimension) return new Set([value]);

  switch (targetDimension) {
    case 'actor':
      switch (dimension) {
        case 'location': return extractLocationActors(gdeltEvents, value);
        case 'keyword': return extractKeywordActors(gdeltEvents, value);
        case 'date': return extractDateEntities(gdeltEvents, value).actors;
        case 'sentiment': return extractSentimentEntities(gdeltEvents, value).actors;
        default: return new Set();
      }

    case 'location':
      switch (dimension) {
        case 'actor': return extractActorLocations(gdeltEvents, value);
        case 'keyword': return extractKeywordLocations(gdeltEvents, value);
        case 'date': return extractDateEntities(gdeltEvents, value).locations;
        case 'sentiment': return extractSentimentEntities(gdeltEvents, value).locations;
        default: return new Set();
      }

    case 'keyword':
      switch (dimension) {
        case 'actor': return extractActorKeywords(gdeltEvents, value);
        case 'location': return extractLocationKeywords(gdeltEvents, value);
        case 'date': return extractDateKeywords(gdeltEvents, value);
        case 'sentiment': return extractSentimentEntities(gdeltEvents, value).keywords;
        default: return new Set();
      }

    default:
      return new Set();
  }
}
