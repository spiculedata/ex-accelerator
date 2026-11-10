// Which characters count as letters, for patterns the database runs. The phrase counts split text with
// /[\p{L}\p{M}]+/u, and a hashtag may hold letters, marks, digits and underscores. A database has its own idea of "letter"
// that follows its locale ([[:alpha:]] in a C-locale database ignores non-ASCII), so the sets are spelled out here from
// the same Unicode tables the counts use and sent as \uXXXX escapes, which makes the drill-down match the counts exactly.
// Only the Basic Multilingual Plane is covered; letters outside it are treated as separators.

const BMP_SIZE = 0x10000;
const SURROGATES = /[\uD800-\uDFFF]/;
const hex = (code: number) => `\\u${code.toString(16).toUpperCase().padStart(4, '0')}`;

function rangesOf(test: RegExp): string {
  const parts: string[] = [];
  let start = -1;
  for (let code = 0; code <= BMP_SIZE; code++) {
    const ch = code < BMP_SIZE ? String.fromCharCode(code) : '';
    const inSet = code < BMP_SIZE && !SURROGATES.test(ch) && test.test(ch);
    if (inSet && start === -1) start = code;
    if (!inSet && start !== -1) {
      const end = code - 1;
      parts.push(start === end ? hex(start) : `${hex(start)}-${hex(end)}`);
      start = -1;
    }
  }
  return parts.join('');
}

/** Letters and combining marks: the characters a phrase's words are made of. For use inside [ ] in a Postgres pattern. */
export const LETTER_RANGES = rangesOf(/[\p{L}\p{M}]/u);

/** Letters, marks, digits of any script and the underscore: the characters a hashtag is made of. */
export const WORD_RANGES = rangesOf(/[\p{L}\p{M}\p{N}_]/u);
