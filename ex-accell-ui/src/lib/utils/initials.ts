/** Up to two capital letters for an avatar: the first letters of the first and last words of the name. */
export function initials(name: string, email = ''): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const source = words.length > 0 ? words : email.trim() ? [email.trim()] : [];
  if (source.length === 0) return '?';
  const first = source[0][0];
  const last = source.length > 1 ? source[source.length - 1][0] : '';
  return (first + last).toUpperCase();
}
