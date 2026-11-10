import { describe, it, expect } from 'vitest';
import { csvEscape, parseCsv, toCsvLine } from './csv';

describe('csvEscape', () => {
  it('leaves plain values alone and blanks null', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('writes dates as ISO 8601, binary as Postgres hex and JSON columns as JSON, without stray quotes', () => {
    expect(csvEscape(new Date('2024-05-01T12:00:00Z'))).toBe('2024-05-01T12:00:00.000Z');
    expect(csvEscape(Buffer.from([0xde, 0xad]))).toBe('\\xdead');
    expect(csvEscape({ a: 1 })).toBe('"{""a"":1}"');
    expect(csvEscape([1, 2])).toBe('"[1,2]"');
  });

  it('quotes values holding a comma, a quote, a newline or a carriage return', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
});

describe('parseCsv', () => {
  it('splits simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3']
    ]);
  });

  it('round-trips what csvEscape wrote, including commas, quotes and newlines inside a field', () => {
    const values = ['plain', 'a,b', 'say "hi"', 'line1\nline2', ''];
    const line = toCsvLine(values);

    expect(parseCsv(line)).toEqual([values]);
  });

  it('accepts CRLF line endings and skips blank lines', () => {
    expect(parseCsv('a,b\r\n1,2\r\n\r\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4']
    ]);
  });

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n\n')).toEqual([]);
  });

  it('keeps a single-column row whose value is empty or quoted-empty, so row counts stay right', () => {
    expect(parseCsv('note\n""\nx\n')).toEqual([['note'], [''], ['x']]);
    expect(parseCsv('a,b\n,\n')).toEqual([
      ['a', 'b'],
      ['', '']
    ]);
  });

  it('stops after maxRows rows so a huge file cannot fill memory', () => {
    const text = Array.from({ length: 10 }, (_, i) => `${i}`).join('\n');

    expect(parseCsv(text, { maxRows: 3 })).toHaveLength(3);
  });
});
