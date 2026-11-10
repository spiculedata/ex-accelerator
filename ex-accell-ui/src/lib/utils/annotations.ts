import { socialPostRecord, type SocialPost } from './evidenceExport';

export interface Annotation {
  id: string;
  text: string;
  timestamp: string;
}

/**
 * Reads investigation notes from whatever the API returned. Notes are stored as a JSON array, but saves
 * made before this was fixed were encoded twice, so a string (even a string of a string) is accepted too.
 * Anything unusable gives an empty list rather than an error: a broken note must not stop the page loading.
 */
export function parseAnnotations(raw: unknown): Annotation[] {
  let value: unknown = raw;
  // Up to three decodes: a plain array, text, or text of text (the double-encoded saves). More is junk.
  for (let depth = 0; depth < 3 && typeof value === 'string'; depth++) {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const { id, text, timestamp } = entry as Record<string, unknown>;
    if (typeof text !== 'string' || !text.trim()) return [];
    let noteId = typeof id === 'string' && id ? id : `note-${index}`;
    while (seen.has(noteId)) noteId = `${noteId}-${index}`;
    seen.add(noteId);
    return [{
      id: noteId,
      text,
      timestamp: typeof timestamp === 'string' ? timestamp : ''
    }];
  });
}

const EXCERPT_LENGTH = 200;
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

/** A note quoting a post, ending in its citation (platform, post id, author, time) so the post can be found again. */
export function noteFromPost(post: SocialPost, id: string, timestamp: string): Annotation {
  const { citation, text } = socialPostRecord(post);
  const flat = oneLine(text);
  const excerpt = flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}…` : flat;
  return { id, text: `“${excerpt}” [${citation}]`, timestamp };
}

/** Whether a note already cites this post, so adding it twice can be refused. */
export function isPostNoted(annotations: readonly Annotation[], post: SocialPost): boolean {
  const marker = `[${socialPostRecord(post).citation}]`;
  return annotations.some((note) => note.text.includes(marker));
}

/** The notes as a Markdown list, oldest first, for sharing or pasting into a report. */
export function notesToMarkdown(investigationName: string, annotations: readonly Annotation[]): string {
  const heading = `# ${oneLine(investigationName)}: notes\n\n`;
  if (annotations.length === 0) return `${heading}No notes yet.\n`;
  const ordered = [...annotations].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const lines = ordered.map((note) => `- ${oneLine(note.text)}${note.timestamp ? ` (${note.timestamp.slice(0, 10)})` : ''}`);
  return `${heading}${lines.join('\n')}\n`;
}
