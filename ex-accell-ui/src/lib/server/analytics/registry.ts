import { connectionHandlers } from './connection';
import { sentimentHandlers } from './sentiment';
import { emotionsHandlers } from './emotions';
import { topicsHandlers } from './topics';
import { languageHandlers } from './language';
import { gdeltHandlers } from './gdelt';
import { gdeltNarrativeHandlers } from './gdeltNarrative';
import { engagementAnalytics, engagementHandlers } from './engagement';
import { trigramsHandlers } from './trigrams';
import { hashtagsHandlers } from './hashtags';
import { workflowHandlers } from './workflow';
import { radioHandlers } from './radio';
import { investigationsHandlers } from './investigations';
import type { AnalyticsHandler } from './types';

const HANDLER_GROUPS: Array<Record<string, AnalyticsHandler>> = [
  connectionHandlers,
  sentimentHandlers,
  emotionsHandlers,
  topicsHandlers,
  languageHandlers,
  gdeltHandlers,
  gdeltNarrativeHandlers,
  engagementHandlers,
  trigramsHandlers,
  hashtagsHandlers,
  workflowHandlers,
  radioHandlers,
  investigationsHandlers
];

/** `type` -> handler. A Map, so a type such as `constructor` or `__proto__` can never match. */
export const ANALYTICS_HANDLERS: ReadonlyMap<string, AnalyticsHandler> = new Map(
  HANDLER_GROUPS.flatMap((group) => Object.entries(group))
);

/** Every `engagement-*` type reaches the engagement handler, which answers an unknown one with a 400. */
const ENGAGEMENT_PREFIX = 'engagement-';

/** The handler for a requested type, or undefined when the type is not served. */
export function findAnalyticsHandler(type: string): AnalyticsHandler | undefined {
  return ANALYTICS_HANDLERS.get(type) ?? (type.startsWith(ENGAGEMENT_PREFIX) ? engagementAnalytics : undefined);
}
