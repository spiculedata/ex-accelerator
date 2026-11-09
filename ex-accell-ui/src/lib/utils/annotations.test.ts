import { describe, it, expect } from 'vitest';
import { parseAnnotations } from './annotations';

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
