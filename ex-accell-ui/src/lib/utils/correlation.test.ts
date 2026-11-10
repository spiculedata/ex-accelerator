import { describe, expect, it } from 'vitest';
import { correlationMatrix, pearson } from './correlation';

describe('pearson', () => {
  it('is 1 for series that rise together and -1 for opposite ones', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it('is null when there is nothing to compare: too few days or a flat series', () => {
    expect(pearson([1, 2], [3, 4])).toBeNull();
    expect(pearson([5, 5, 5, 5], [1, 2, 3, 4])).toBeNull();
    expect(pearson([1, 2, 3], [1, 2])).toBeNull();
  });
});

describe('correlationMatrix', () => {
  const matrix = correlationMatrix({ a: [1, 2, 3, 5], b: [2, 1, 4, 3], c: [9, 7, 4, 1] });

  it('is symmetric with 1 on the diagonal', () => {
    expect(matrix.labels).toEqual(['a', 'b', 'c']);
    matrix.values.forEach((row, i) => {
      expect(row[i]).toBe(1);
      row.forEach((value, j) => expect(value).toBe(matrix.values[j][i]));
    });
  });

  it('keeps a flat series as null, including on its own diagonal', () => {
    const flat = correlationMatrix({ a: [1, 2, 3], flat: [4, 4, 4] });
    expect(flat.values[1][1]).toBeNull();
    expect(flat.values[0][1]).toBeNull();
  });
});
