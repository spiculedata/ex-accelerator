const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

const MARK_CLASS = 'bg-amber-500/30 text-amber-200 rounded px-0.5';

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns HTML that is safe for `{@html}`: all input text is escaped, and only
 * the <mark> wrappers added here are markup. Each segment is escaped on its own
 * so keywords can never match inside an escaped entity such as `&lt;`.
 */
export function highlightKeywords(text: string, keywords: readonly string[]): string {
  const terms = keywords.filter((keyword) => keyword.length > 0).map(escapeRegExp);
  if (terms.length === 0) return escapeHtml(text);

  const matcher = new RegExp(`(${terms.join('|')})`, 'gi');
  return text
    .split(matcher)
    .map((part, index) =>
      index % 2 === 1 ? `<mark class="${MARK_CLASS}">${escapeHtml(part)}</mark>` : escapeHtml(part)
    )
    .join('');
}
