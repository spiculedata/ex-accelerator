// Pearson correlation between daily series: +1 when two series rise and fall together, -1 when one rises as the
// other falls, near 0 when they are unrelated. A comparison needs at least three days that actually vary.

const MIN_POINTS = 3;

export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length;
  if (n !== ys.length || n < MIN_POINTS) return null;
  const meanX = xs.reduce((sum, v) => sum + v, 0) / n;
  const meanY = ys.reduce((sum, v) => sum + v, 0) / n;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let i = 0; i < n; i++) {
    covariance += (xs[i] - meanX) * (ys[i] - meanY);
    varianceX += (xs[i] - meanX) ** 2;
    varianceY += (ys[i] - meanY) ** 2;
  }
  if (varianceX === 0 || varianceY === 0) return null;
  return covariance / Math.sqrt(varianceX * varianceY);
}

export interface CorrelationMatrix {
  labels: string[];
  values: (number | null)[][];
}

/** Every pair of series, computed once so the matrix is symmetric; a series with no variation has no correlation. */
export function correlationMatrix(series: Readonly<Record<string, readonly number[]>>): CorrelationMatrix {
  const labels = Object.keys(series);
  const values: (number | null)[][] = labels.map(() => labels.map(() => null));
  labels.forEach((a, i) => {
    labels.forEach((b, j) => {
      if (j < i) return;
      const value = i === j ? (pearson(series[a], series[a]) === null ? null : 1) : pearson(series[a], series[b]);
      values[i][j] = value;
      values[j][i] = value;
    });
  });
  return { labels, values };
}
