import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORICAL, CHART } from './chartColors';
import {
  NEUTRAL_BADGE,
  categoryBadgeClass,
  dataSourceBadgeClass,
  gdeltMentionTypeBadgeClass,
  platformBadgeClass,
  platformColour,
  platformDotClass,
  workspaceTypeBadgeClass
} from './categoryColours';

// After the Tailwind remap, blue, sky, cyan, teal, indigo, violet, purple, fuchsia and pink all resolve to primary, so a
// badge built from those names no longer tells categories apart. Categories take the eight categorical tokens instead.
const MAIN_PLATFORMS = ['telegram', 'twitter', 'facebook', 'youtube', 'instagram', 'linkedin', 'reddit', 'tiktok'];

describe('categoryBadgeClass', () => {
  it('tints the fill and ring with a categorical token and keeps the label in ink', () => {
    expect(categoryBadgeClass(1)).toBe('bg-cat-1/15 text-ink-900 ring-1 ring-cat-1/50');
    expect(categoryBadgeClass(8)).toContain('ring-cat-8/50');
  });
});

describe('platform colours', () => {
  it('give the eight main platforms eight different badges', () => {
    const classes = MAIN_PLATFORMS.map((p) => platformBadgeClass(p));
    expect(new Set(classes).size).toBe(MAIN_PLATFORMS.length);
    for (const cls of classes) expect(cls).toMatch(/^bg-cat-[1-8]\/15 text-ink-900 ring-1 ring-cat-[1-8]\/50$/);
  });

  it('use the same categorical hex in a chart as in the badge', () => {
    for (const platform of MAIN_PLATFORMS) {
      const index = Number(platformBadgeClass(platform).match(/bg-cat-(\d)/)?.[1]);
      expect(platformColour(platform)).toBe(CATEGORICAL[index - 1]);
      expect(platformDotClass(platform)).toBe(`bg-cat-${index}`);
    }
  });

  it('treat x as twitter, ignore case, and fall back to neutral', () => {
    expect(platformBadgeClass('X')).toBe(platformBadgeClass('twitter'));
    expect(platformBadgeClass('Telegram')).toBe(platformBadgeClass('telegram'));
    expect(platformBadgeClass('bluesky')).not.toBe(NEUTRAL_BADGE);
    expect(platformBadgeClass(undefined)).toBe(NEUTRAL_BADGE);
    expect(platformColour('unknown')).toBe(CHART.ink500);
    expect(platformDotClass(undefined)).toBe('bg-ink-400');
  });

  it('never use a platform brand colour or a sentiment colour', () => {
    for (const platform of MAIN_PLATFORMS) {
      expect(platformColour(platform)).not.toMatch(/^#(1da1f2|1877f2|0088cc|e4405f)$/i);
    }
  });
});

describe('data source badges', () => {
  it('keep social, GDELT, radio and Android apart', () => {
    const classes = ['social_media', 'gdelt_events', 'radio', 'android'].map((t) => dataSourceBadgeClass(t));
    expect(new Set(classes).size).toBe(4);
  });

  it('accept the short names the investigations list uses', () => {
    expect(dataSourceBadgeClass('social')).toBe(dataSourceBadgeClass('social_media'));
    expect(dataSourceBadgeClass('gdelt')).toBe(dataSourceBadgeClass('gdelt_events'));
  });

  it('send a platform name to the platform badge and anything else to neutral', () => {
    expect(dataSourceBadgeClass('telegram')).toBe(platformBadgeClass('telegram'));
    expect(dataSourceBadgeClass('imported')).toBe(NEUTRAL_BADGE);
    expect(dataSourceBadgeClass(undefined)).toBe(NEUTRAL_BADGE);
  });
});

describe('workspace type badges', () => {
  it('keep analysis, exploration and reporting apart without state colours', () => {
    const classes = ['analysis', 'exploration', 'reporting'].map((t) => workspaceTypeBadgeClass(t));
    expect(new Set(classes).size).toBe(3);
    for (const cls of classes) expect(cls).not.toMatch(/success|danger|signal|emerald|amber|indigo/);
    expect(workspaceTypeBadgeClass('other')).toBe(NEUTRAL_BADGE);
  });
});

describe('GDELT mention type badges', () => {
  it('no longer colour web and broadcast news alike', () => {
    expect(gdeltMentionTypeBadgeClass(1)).not.toBe(gdeltMentionTypeBadgeClass(3));
    expect(gdeltMentionTypeBadgeClass(2)).toBe(NEUTRAL_BADGE);
    expect(gdeltMentionTypeBadgeClass(9)).toBe(NEUTRAL_BADGE);
  });
});

// Every category badge in the app comes from this module, and sentiment badges from getSentimentColor
describe('category badges in pages and components', () => {
  it.each([
    ['src/lib/components/investigation/SocialPostPanel.svelte', 'platformBadgeClass('],
    ['src/lib/components/investigation/SocialPostPanel.svelte', "getSentimentColor("],
    ['src/lib/components/investigation/RadioTranscriptPanel.svelte', "getSentimentColor("],
    ['src/routes/workspaces/[id]/+page.svelte', 'platformBadgeClass('],
    ['src/routes/workspaces/[id]/+page.svelte', 'workspaceTypeBadgeClass('],
    ['src/routes/projects/[id]/+page.svelte', 'workspaceTypeBadgeClass('],
    ['src/routes/investigations/+page.svelte', 'dataSourceBadgeClass('],
    ['src/lib/components/ui/FilterBar.svelte', 'dataSourceBadgeClass('],
    ['src/lib/components/Navigation.svelte', 'dataSourceBadgeClass('],
    ['src/routes/gdelt/+page.svelte', 'gdeltMentionTypeBadgeClass('],
    ['src/lib/services/overviewDb.ts', 'platformColour('],
    ['src/lib/services/engagementAnalysisDb.ts', 'platformColour(']
  ])('%s uses %s', (path, call) => {
    expect(readFileSync(path, 'utf8')).toContain(call);
  });
});
