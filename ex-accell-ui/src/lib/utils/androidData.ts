// Pure helpers for the Android pages: whether anything is loaded, and the figures the research
// page derives from real rows. Nothing here makes a number up; with no rows there is no output.

import type {
  AppTransition,
  AttentionSpan,
  BehaviouralMetrics,
  TemporalAppUsage,
  TemporalUsagePattern
} from '$lib/services/types/androidResearchTypes';

const HOURS_IN_DAY = 24;
const SECONDS_PER_MINUTE = 60;

/** Either a service result or a plain row list. */
export type DataPresence = { hasData: boolean } | readonly unknown[];

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);
const roundTo1dp = (value: number): number => Math.round(value * 10) / 10;

/** True when any part has rows, so the page shows the dashboard instead of the empty state. */
export function hasAndroidData(parts: readonly DataPresence[]): boolean {
  return parts.some((part) => (Array.isArray(part) ? part.length > 0 : (part as { hasData: boolean }).hasData));
}

interface TimedSession {
  app: string;
  duration: number;
  timestamp: number;
}

/** Every session with a real start time, tagged with its app. */
function timedSessions(spans: readonly AttentionSpan[]): TimedSession[] {
  return spans.flatMap((span) =>
    span.sessions
      .filter((session) => session.timestamp > 0)
      .map((session) => ({ app: span.app, duration: session.duration, timestamp: session.timestamp }))
  );
}

const utcHour = (timestamp: number): number => new Date(timestamp).getUTCHours();

/**
 * Minutes spent in each app during each UTC hour, from the attention-span sessions. Empty when no
 * session has a start time, so nothing is drawn from nothing.
 */
export function temporalUsageFromSessions(spans: readonly AttentionSpan[]): TemporalUsagePattern[] {
  const sessions = timedSessions(spans);
  if (sessions.length === 0) return [];

  const apps = [...new Set(sessions.map((session) => session.app))];

  return Array.from({ length: HOURS_IN_DAY }, (_, hour) => {
    const appUsage: TemporalAppUsage[] = apps.map((app) => {
      const durations = sessions
        .filter((session) => session.app === app && utcHour(session.timestamp) === hour)
        .map((session) => session.duration);
      const totalSeconds = sum(durations);
      return {
        app,
        hour,
        usage: totalSeconds / SECONDS_PER_MINUTE,
        sessions: durations.length,
        avgDuration: durations.length === 0 ? 0 : totalSeconds / durations.length
      };
    });

    return { hour, apps: appUsage, totalUsage: sum(appUsage.map((entry) => entry.usage)) };
  });
}

/** Headline figures from the loaded sessions and transitions, or null when there are no sessions. */
export function behaviouralMetrics(
  temporal: readonly TemporalUsagePattern[],
  spans: readonly AttentionSpan[],
  transitions: readonly AppTransition[]
): BehaviouralMetrics | null {
  const durations = spans.flatMap((span) => span.sessions.map((session) => session.duration));
  if (durations.length === 0) return null;

  const peak = temporal.reduce<TemporalUsagePattern | null>(
    (best, hour) => (best === null || hour.totalUsage > best.totalUsage ? hour : best),
    null
  );

  return {
    totalDailyUsage: Math.round(sum(temporal.map((hour) => hour.totalUsage))),
    peakUsageHour: peak?.hour ?? null,
    avgSessionLength: Math.round(sum(durations) / durations.length),
    appSwitchingRate: roundTo1dp(sum(transitions.map((transition) => transition.value)) / HOURS_IN_DAY)
  };
}

function reaches(links: readonly AppTransition[], from: string, to: string, seen: ReadonlySet<string> = new Set()): boolean {
  if (from === to) return true;
  if (seen.has(from)) return false;
  const visited = new Set(seen).add(from);
  return links.filter((link) => link.source === from).some((link) => reaches(links, link.target, to, visited));
}

/**
 * The links a Sankey diagram can draw: no self-loops and no cycles. Links are kept strongest
 * first, so a cycle loses its weakest link.
 */
export function acyclicTransitions(transitions: readonly AppTransition[]): AppTransition[] {
  const strongestFirst = transitions.filter((link) => link.source !== link.target).sort((a, b) => b.value - a.value);

  return strongestFirst.reduce<AppTransition[]>(
    (kept, link) => (reaches(kept, link.target, link.source) ? kept : [...kept, link]),
    []
  );
}
