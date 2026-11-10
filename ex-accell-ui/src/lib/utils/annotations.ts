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
  // Counted in characters, not UTF-16 units, so an emoji is never cut in half
  const characters = [...oneLine(text)];
  const excerpt = characters.length > EXCERPT_LENGTH ? `${characters.slice(0, EXCERPT_LENGTH).join('').trimEnd()}…` : characters.join('');
  return { id, text: `“${excerpt}” [${citation}]`, timestamp };
}

/** Whether the notes already hold this post, so adding it twice can be refused. The whole note must match, so text that
 * merely quotes a citation, or posts without an id, are not mistaken for it. */
export function isPostNoted(annotations: readonly Annotation[], post: SocialPost): boolean {
  const text = noteFromPost(post, '', '').text;
  return annotations.some((note) => note.text === text);
}

/** The notes as a Markdown list, oldest first, for sharing or pasting into a report. */
export function notesToMarkdown(investigationName: string, annotations: readonly Annotation[]): string {
  const heading = `# ${oneLine(investigationName)}: notes\n\n`;
  if (annotations.length === 0) return `${heading}No notes yet.\n`;
  const ordered = [...annotations].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const lines = ordered.map((note) => `- ${oneLine(note.text)}${note.timestamp ? ` (${note.timestamp.slice(0, 10)})` : ''}`);
  return `${heading}${lines.join('\n')}\n`;
}
