/** The shell command mentioned in an error message such as "run `npm run jupyter:bootstrap` first", if any. */
export function extractCommand(message: string): string | null {
  const match = /`((?:npm|npx|docker|poetry|git)\s[^`]+)`/.exec(message);
  const command = match?.[1].trim();
  // A command that chains or substitutes (; & | ` $ < > newline) is not one to offer a one-click copy of
  return command && !/[;&|`$<>\n\\]/.test(command) ? command : null;
}
