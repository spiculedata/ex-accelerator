// Badge classes and chart colours for things that are categories rather than states or sentiment: platforms, data
// sources, workspace types, GDELT mention types. Each category takes one of the eight colour-blind-safe categorical
// tokens (--se-cat-1 to --se-cat-8, docs-site/brand/data-visualisation), so two categories never share a hue now that
// the Tailwind remap folds blue, sky, cyan, teal, indigo, violet, purple, fuchsia and pink into primary. Colour is never
// the only cue: a badge always carries its label.
import { CATEGORICAL, CHART } from './chartColors';

export type CategoryIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// Written out in full so Tailwind's scanner sees every class
const BADGE_CLASSES = [
  'bg-cat-1/15 text-ink-900 ring-1 ring-cat-1/50',
  'bg-cat-2/15 text-ink-900 ring-1 ring-cat-2/50',
  'bg-cat-3/15 text-ink-900 ring-1 ring-cat-3/50',
  'bg-cat-4/15 text-ink-900 ring-1 ring-cat-4/50',
  'bg-cat-5/15 text-ink-900 ring-1 ring-cat-5/50',
  'bg-cat-6/15 text-ink-900 ring-1 ring-cat-6/50',
  'bg-cat-7/15 text-ink-900 ring-1 ring-cat-7/50',
  'bg-cat-8/15 text-ink-900 ring-1 ring-cat-8/50'
] as const;
const DOT_CLASSES = ['bg-cat-1', 'bg-cat-2', 'bg-cat-3', 'bg-cat-4', 'bg-cat-5', 'bg-cat-6', 'bg-cat-7', 'bg-cat-8'] as const;

/** A category that has no colour of its own, or is not known. */
export const NEUTRAL_BADGE = 'bg-ink-100 text-ink-700 ring-1 ring-ink-300';
const NEUTRAL_DOT = 'bg-ink-400';
// Bluesky is the ninth platform, so it takes the brand accent rather than a ninth categorical colour
const PRIMARY_BADGE = 'bg-primary-500/15 text-ink-900 ring-1 ring-primary-500/50';
const PRIMARY_DOT = 'bg-primary-500';

/** A tinted badge with dark text: the hue sits in the fill and ring, so the label keeps full contrast. */
export function categoryBadgeClass(index: CategoryIndex): string {
  return BADGE_CLASSES[index - 1];
}

/** A small solid swatch for a list row or legend. */
export function categoryDotClass(index: CategoryIndex): string {
  return DOT_CLASSES[index - 1];
}

/** The categorical hex for charts, canvas and SVG, matching the badge of the same index. */
export function categoryColour(index: CategoryIndex): string {
  return CATEGORICAL[index - 1];
}

// Eight platforms, eight colours, in the order the engagement charts already used. Brand colours (Telegram blue,
// YouTube red) are not used: they clash with each other and with the sentiment scale.
const PLATFORM_INDEX: Record<string, CategoryIndex> = {
  linkedin: 1,
  facebook: 2,
  telegram: 3,
  instagram: 4,
  twitter: 5,
  x: 5,
  youtube: 6,
  reddit: 7,
  tiktok: 8
};

function platformKey(platform?: string): string {
  return (platform ?? '').toLowerCase().trim();
}

export function platformBadgeClass(platform?: string): string {
  const key = platformKey(platform);
  if (key === 'bluesky') return PRIMARY_BADGE;
  const index = PLATFORM_INDEX[key];
  return index ? categoryBadgeClass(index) : NEUTRAL_BADGE;
}

export function platformDotClass(platform?: string): string {
  const key = platformKey(platform);
  if (key === 'bluesky') return PRIMARY_DOT;
  const index = PLATFORM_INDEX[key];
  return index ? categoryDotClass(index) : NEUTRAL_DOT;
}

export function platformColour(platform?: string): string {
  const key = platformKey(platform);
  if (key === 'bluesky') return CHART.primary500;
  const index = PLATFORM_INDEX[key];
  return index ? categoryColour(index) : CHART.ink500;
}

// Data sources: the dataset types a workspace can hold. Short names are what the investigations list sends.
const SOURCE_INDEX: Record<string, CategoryIndex> = {
  social: 1,
  social_media: 1,
  gdelt: 2,
  gdelt_events: 2,
  android: 3,
  radio: 4
};

export function dataSourceBadgeClass(type?: string): string {
  const key = platformKey(type);
  const index = SOURCE_INDEX[key];
  if (index) return categoryBadgeClass(index);
  if (PLATFORM_INDEX[key] || key === 'bluesky') return platformBadgeClass(key);
  return NEUTRAL_BADGE;
}

// Workspace and project types
const WORKSPACE_TYPE_INDEX: Record<string, CategoryIndex> = {
  analysis: 1,
  exploration: 3,
  reporting: 2
};

export function workspaceTypeBadgeClass(type?: string): string {
  const index = WORKSPACE_TYPE_INDEX[platformKey(type)];
  return index ? categoryBadgeClass(index) : NEUTRAL_BADGE;
}

// GDELT mention types: 1 web news, 2 print, 3 broadcast
const MENTION_TYPE_INDEX: Record<number, CategoryIndex> = { 1: 1, 3: 5 };

export function gdeltMentionTypeBadgeClass(mentionType: number): string {
  const index = MENTION_TYPE_INDEX[mentionType];
  return index ? categoryBadgeClass(index) : NEUTRAL_BADGE;
}
