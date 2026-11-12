import { gdeltDateToInputDate } from '$lib/utils/gdeltDates';

export type GdeltMention = Record<string, any>;

export type SortDirection = 'asc' | 'desc';

export interface MentionsView {
  searchTerm: string;
  /** '' for every type, otherwise the mention type number as text */
  typeFilter: string;
  sortField: string;
  sortDirection: SortDirection;
}

const MENTION_TYPE_LABELS: Record<number, string> = {
  1: 'Web News',
  2: 'Print News',
  3: 'Broadcast News'
};

export function getMentionTypeLabel(mentionType: number): string {
  return MENTION_TYPE_LABELS[mentionType] || `Type ${mentionType}`;
}

/** Turns an average tone score into a plain-language description. */
export function getToneDescription(toneScore: number): string {
  if (toneScore >= 5) return 'Very Positive';
  if (toneScore >= 2) return 'Positive';
  if (toneScore >= 0.5) return 'Slightly Positive';
  if (toneScore > -0.5) return 'Neutral';
  if (toneScore > -2) return 'Slightly Negative';
  if (toneScore > -5) return 'Negative';
  return 'Very Negative';
}

function compareMentions(a: GdeltMention, b: GdeltMention, field: string, direction: SortDirection): number {
  let aVal = a[field];
  let bVal = b[field];

  // Null and undefined values sort first when ascending and last when descending
  if (aVal == null && bVal == null) return 0;
  if (aVal == null) return direction === 'asc' ? -1 : 1;
  if (bVal == null) return direction === 'asc' ? 1 : -1;

  if (typeof aVal === 'string') aVal = aVal.toLowerCase();
  if (typeof bVal === 'string') bVal = bVal.toLowerCase();

  const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  return direction === 'asc' ? comparison : -comparison;
}

/** Applies the search, type filter and sort to the mentions without changing the input. */
export function filterAndSortMentions(mentions: GdeltMention[], view: MentionsView): GdeltMention[] {
  let filtered = [...mentions];

  if (view.searchTerm) {
    const searchLower = view.searchTerm.toLowerCase();
    filtered = filtered.filter(
      (mention) =>
        mention.mentionSourceName?.toLowerCase().includes(searchLower) ||
        mention.mentionIdentifier?.toLowerCase().includes(searchLower)
    );
  }

  if (view.typeFilter) {
    filtered = filtered.filter((mention) => mention.mentionType?.toString() === view.typeFilter);
  }

  filtered.sort((a, b) => compareMentions(a, b, view.sortField, view.sortDirection));
  return filtered;
}

export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  const startIndex = (page - 1) * perPage;
  return items.slice(startIndex, startIndex + perPage);
}

const CSV_HEADERS = [
  'Event ID',
  'Source Name',
  'Type',
  'Mention Date',
  'Confidence',
  'Doc Tone',
  'Doc Length',
  'Identifier',
  'Event Time Date',
  'Sentence ID',
  'In Raw Text',
  'Translation Info'
];

/** Quotes a field that holds a comma, a quote or a line break. */
function escapeCsvField(field: unknown): string {
  const stringField = String(field);
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
}

export function buildMentionsCsv(mentions: GdeltMention[]): string {
  const rows = mentions.map((mention) => [
    mention.globalEventId || '',
    mention.mentionSourceName || '',
    getMentionTypeLabel(mention.mentionType) || '',
    gdeltDateToInputDate(mention.mentionTimeDate) || '',
    mention.confidence || '',
    mention.mentionDocTone || '',
    mention.mentionDocLen || '',
    mention.mentionIdentifier || '',
    gdeltDateToInputDate(mention.eventTimeDate) || '',
    mention.sentenceId || '',
    mention.inRawText || '',
    mention.mentionDocTranslationInfo || ''
  ]);
  return [CSV_HEADERS.join(','), ...rows.map((row) => row.map(escapeCsvField).join(','))].join('\n');
}

/** gdelt-mentions-{event-ID | filtered-events}-{timestamp}.csv, with the time safe for a file name. */
export function mentionsCsvFilename(selectedEventId: number | null, now: Date = new Date()): string {
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  const eventContext = selectedEventId ? `event-${selectedEventId}` : 'filtered-events';
  return `gdelt-mentions-${eventContext}-${timestamp}.csv`;
}

/** Saves the CSV text as a download through a temporary link. */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
