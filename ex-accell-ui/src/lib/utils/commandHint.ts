/** The shell command mentioned in an error message such as "run `npm run jupyter:bootstrap` first", if any. */
export function extractCommand(message: string): string | null {
  const match = /`((?:npm|npx|docker|poetry|git)\s[^`]+)`/.exec(message);
  return match ? match[1].trim() : null;
}
