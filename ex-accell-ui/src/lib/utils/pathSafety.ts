import { resolve, sep } from 'path';

const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/** True when the value is a string safe to use as a single path segment or process argument. */
export function isSafeIdentifier(value: unknown): value is string {
  return typeof value === 'string' && SAFE_IDENTIFIER.test(value);
}

/** Returns the id unchanged, or throws naming the offending field. */
export function assertSafeIdentifier(value: unknown, field: string): string {
  if (!isSafeIdentifier(value)) {
    throw new Error(
      `Invalid ${field}: must be 1-128 characters of letters, digits, '-' or '_', starting with a letter or digit`
    );
  }
  return value;
}

/** Resolves `child` against `base`, throwing if the result escapes `base`. */
export function resolveWithin(base: string, child: string): string {
  const resolvedBase = resolve(base);
  const resolvedPath = resolve(resolvedBase, child);
  if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(resolvedBase + sep)) {
    throw new Error(`Path ${child} resolves outside ${resolvedBase}`);
  }
  return resolvedPath;
}
