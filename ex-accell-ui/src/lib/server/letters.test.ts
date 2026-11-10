import { describe, expect, it } from 'vitest';
import { LETTER_RANGES, WORD_RANGES } from './letters';

const BMP = Array.from({ length: 0x10000 }, (_, code) => String.fromCharCode(code)).filter((ch) => !/[\uD800-\uDFFF]/.test(ch));
const inClass = (ranges: string) => new RegExp(`[${ranges}]`);

describe('letter sets for the database', () => {
  it('count exactly the characters the phrase tokenizer calls letters or marks, so counts and drill-downs agree', () => {
    const isLetter = inClass(LETTER_RANGES);
    const wrong = BMP.filter((ch) => isLetter.test(ch) !== /[\p{L}\p{M}]/u.test(ch));
    expect(wrong).toEqual([]);
  });

  it('count letters, marks, digits of any script and the underscore as part of a hashtag or word', () => {
    const isWord = inClass(WORD_RANGES);
    const wrong = BMP.filter((ch) => isWord.test(ch) !== /[\p{L}\p{M}\p{N}_]/u.test(ch));
    expect(wrong).toEqual([]);
  });

  it('never treat punctuation, symbols or spaces as letters, in any script', () => {
    const isLetter = inClass(LETTER_RANGES);
    for (const ch of ['،', '؛', '؟', '۔', '।', '॥', '־', '։', '“', '”', '…', '—', ' ', '.', ',', '!', '#', '_', '5', '٣']) {
      expect(isLetter.test(ch)).toBe(false);
    }
  });

  it('are compact enough to send with every query', () => {
    expect(LETTER_RANGES.length).toBeLessThan(12_000);
    expect(WORD_RANGES.length).toBeLessThan(12_000);
  });

  it('spell characters as escapes a database understands, never literally', () => {
    expect(LETTER_RANGES).not.toMatch(/[^\x20-\x7E]/);
    expect(LETTER_RANGES).toContain('\\u00C0');
  });
});
