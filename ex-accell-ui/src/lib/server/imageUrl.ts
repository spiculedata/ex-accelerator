/** Why an image address cannot be analysed, in words for the person who pasted it, or null when it can. */
export function imageUrlProblem(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return 'Paste the address of an image.';
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return 'That is not a web address. It must start with http:// or https://.';
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? null : 'Only http:// and https:// addresses can be analysed.';
}
