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
