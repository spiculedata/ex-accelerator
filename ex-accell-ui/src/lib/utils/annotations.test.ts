import { describe, it, expect } from 'vitest';
import { isPostNoted, noteFromPost, notesToMarkdown, parseAnnotations } from './annotations';

const note = { id: 'a1', text: 'Delays peak after the timetable change', timestamp: '2026-11-09T10:00:00.000Z' };

describe('parseAnnotations', () => {
  it('returns a stored array as it is', () => {
    expect(parseAnnotations([note])).toEqual([note]);
  });

  it('parses a JSON string of an array', () => {
    expect(parseAnnotations(JSON.stringify([note]))).toEqual([note]);
  });

  it('parses a double-encoded string, which earlier saves produced', () => {
    expect(parseAnnotations(JSON.stringify(JSON.stringify([note])))).toEqual([note]);
  });

  it.each([[null], [undefined], [''], ['not json'], [42], [{}], ['{"a":1}']])('returns an empty list for %j', (raw) => {
    expect(parseAnnotations(raw)).toEqual([]);
  });

  it('drops entries without text and fills a missing id or timestamp', () => {
    const result = parseAnnotations([{ text: 'kept' }, { id: 'x' }, { text: '   ' }, null, 'str']);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ text: 'kept', timestamp: '' });
    expect(typeof result[0].id).toBe('string');
    expect(result[0].id.length).toBeGreaterThan(0);
  });

  it('makes duplicate ids unique so removing one note cannot remove another', () => {
    const result = parseAnnotations([{ id: 'same', text: 'one' }, { id: 'same', text: 'two' }]);

    expect(new Set(result.map((n) => n.id)).size).toBe(2);
  });
});

describe('noteFromPost', () => {
  const post = { id: 42, text: 'Another morning of tram delays and no information at the stop.', platform: 'telegram', author: 'marlow_commuter', timestamp: Date.UTC(2026, 10, 9, 7, 30) };

  it('quotes the post and cites it so it can be found again', () => {
    const made = noteFromPost(post, 'n1', '2026-11-10T09:00:00.000Z');
    expect(made).toEqual({
      id: 'n1',
      text: '“Another morning of tram delays and no information at the stop.” [telegram post #42 by marlow_commuter, 2026-11-09T07:30:00.000Z]',
      timestamp: '2026-11-10T09:00:00.000Z'
    });
  });

  it('shortens a long post to an excerpt but keeps the whole citation', () => {
    const made = noteFromPost({ ...post, text: 'x'.repeat(500) }, 'n1', 't');
    expect(made.text.length).toBeLessThan(300);
    expect(made.text).toContain('…”');
    expect(made.text.endsWith('[telegram post #42 by marlow_commuter, 2026-11-09T07:30:00.000Z]')).toBe(true);
  });

  it('never cuts an emoji in half when shortening', () => {
    const made = noteFromPost({ ...post, text: '😀'.repeat(300) }, 'n1', 't');
    expect(made.text).toMatch(/^“(😀)+…” \[/u);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(made.text)).toBe(false);
  });

  it('collapses line breaks so a note stays on one line', () => {
    expect(noteFromPost({ ...post, text: 'one\n\ntwo' }, 'n1', 't').text).toContain('“one two”');
  });
});

describe('isPostNoted', () => {
  const post = { id: 42, text: 'hello', platform: 'telegram', author: 'a', timestamp: 0 };

  it('is true once a note cites that post, and false for another post', () => {
    const notes = [noteFromPost(post, 'n1', 't')];
    expect(isPostNoted(notes, post)).toBe(true);
    expect(isPostNoted(notes, { ...post, id: 43 })).toBe(false);
  });

  it('is not fooled by another note that merely quotes the citation text', () => {
    const spoof = [{ id: 's', text: '“look at [telegram post #42 by a, 1970-01-01T00:00:00.000Z] here”', timestamp: 't' }];
    expect(isPostNoted(spoof, post)).toBe(false);
  });

  it('tells apart posts that have no id', () => {
    const a = { text: 'first', platform: 'x' };
    const b = { text: 'second', platform: 'x' };
    const notes = [noteFromPost(a, 'n1', 't')];
    expect(isPostNoted(notes, a)).toBe(true);
    expect(isPostNoted(notes, b)).toBe(false);
  });

  it('does not confuse post #4 with post #42', () => {
    const notes = [noteFromPost({ ...post, id: 42 }, 'n1', 't')];
    expect(isPostNoted(notes, { ...post, id: 4 })).toBe(false);
  });
});

describe('notesToMarkdown', () => {
  it('lists the notes under the investigation name, oldest first, with their dates', () => {
    const md = notesToMarkdown('Tram delays', [
      { id: 'b', text: 'Second', timestamp: '2026-11-10T10:00:00.000Z' },
      { id: 'a', text: 'First', timestamp: '2026-11-09T10:00:00.000Z' }
    ]);
    expect(md).toBe('# Tram delays: notes\n\n- First (2026-11-09)\n- Second (2026-11-10)\n');
  });

  it('says so when there are no notes, and keeps notes without a date', () => {
    expect(notesToMarkdown('Empty', [])).toBe('# Empty: notes\n\nNo notes yet.\n');
    expect(notesToMarkdown('X', [{ id: 'a', text: 'Undated', timestamp: '' }])).toBe('# X: notes\n\n- Undated\n');
  });

  it('keeps multi-line note text on one list item', () => {
    expect(notesToMarkdown('X', [{ id: 'a', text: 'one\ntwo', timestamp: '' }])).toContain('- one two\n');
  });
});
