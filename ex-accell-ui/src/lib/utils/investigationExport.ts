// Building the files a researcher can download from the investigation workbench.

import type { Annotation } from './annotations';
import { CSV_BOM, socialPostRecord, toCsv } from './evidenceExport';
import type { GdeltEvent, RadioSegment, WorkbenchPost } from './investigationTypes';

const GDELT_SAMPLE_SIZE = 50;
const RADIO_SAMPLE_SIZE = 20;
const REVOKE_DELAY_MS = 1000;

// Text starting with = + - @ gets a leading ' so a spreadsheet cannot run it; the JSON export holds the verbatim text
export const POST_CSV_COLUMNS = ['id', 'platform', 'author', 'posted_at', 'text', 'sentiment', 'confidence', 'emotions', 'likes', 'shares', 'comments', 'citation'] as const;

export interface ReportInput {
  name: string | undefined;
  keywords: string[];
  dateStart: string;
  dateEnd: string;
  annotations: Annotation[];
  gdeltEvents: GdeltEvent[];
  radioSegments: RadioSegment[];
  socialPosts: WorkbenchPost[];
  timelineDays: number;
  now?: Date;
}

/** Every post that was loaded (up to 200), not a sample, with the fields needed to cite and find each one again. */
export function buildInvestigationReport(input: ReportInput) {
  const { socialPosts } = input;
  return {
    investigation: { name: input.name, keywords: input.keywords, dateStart: input.dateStart, dateEnd: input.dateEnd },
    annotations: input.annotations,
    summary: {
      gdelt_events: input.gdeltEvents.length,
      radio_segments: input.radioSegments.length,
      social_posts: socialPosts.length,
      timeline_days: input.timelineDays
    },
    gdelt_sample: input.gdeltEvents.slice(0, GDELT_SAMPLE_SIZE),
    radio_sample: input.radioSegments.slice(0, RADIO_SAMPLE_SIZE),
    social_posts: socialPosts.map(socialPostRecord),
    note: `Posts carry no permalink in this data. Each has a citation (platform, post id, author, ISO 8601 UTC time) to find it again. This export holds the ${socialPosts.length} posts loaded for this investigation (the workbench loads at most 200) and ignores any cross-filter on screen.`,
    exported_at: (input.now ?? new Date()).toISOString()
  };
}

export function buildPostsCsv(posts: WorkbenchPost[]): string {
  return CSV_BOM + toCsv(posts.map(socialPostRecord), POST_CSV_COLUMNS);
}

export function exportFileName(investigationName: string | undefined, extension: string, now: Date = new Date()): string {
  return `investigation-${(investigationName ?? 'export').replace(/\s+/g, '-')}-${now.toISOString().split('T')[0]}.${extension}`;
}

/** Hands the browser a file to save. */
export function downloadFile(contents: string, type: string, fileName: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
