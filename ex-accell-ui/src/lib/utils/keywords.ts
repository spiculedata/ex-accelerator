/**
 * Adds the text still sitting in a keyword field to the keyword list: comma-separated, trimmed, with blanks
 * and repeats skipped. Used when a form is submitted, so a keyword typed but not yet confirmed is kept.
 */
export function commitKeywords(existing: readonly string[], pendingInput: string): string[] {
  const added = pendingInput
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword, index, all) => keyword.length > 0 && !existing.includes(keyword) && all.indexOf(keyword) === index);
  return [...existing, ...added];
}
