import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Ratchet for issue #52. Every API route answers with the envelope `{ success, data, error }` (see
// `$lib/server/apiResponse.ts`), sends the client a generic message on a 500 and logs the detail. Routes not yet migrated
// are listed below with exact counts, so the numbers can only go down: lower a baseline (or delete a list entry) in the same
// change that fixes the route; the test fails when it is too high or too low.
//
// Allowed exceptions, none of which count as debt:
//   - health/+server.ts is a liveness probe whose plain body is read by orchestrators, not the UI. It is exempt from the
//     envelope check only: its `detail: err.message` is counted in the leak baseline until it is changed.
//   - A `.message` that is deliberately client-safe because the error class is ours and carries user-facing text
//     (BodyTooLargeError, DataSharingError and the other typed data-sharing errors) or the line only compares it
//     (`message === 'No such user'`). CLIENT_SAFE_LINE matches those lines, so a new leak in the same file is still counted.

const API_DIR = join('src', 'routes', 'api');
// The unified-analytics handlers live here, not in the route: their responses are API responses too.
const ANALYTICS_HANDLERS_DIR = join('src', 'lib', 'server', 'analytics');

// SvelteKit `error(status, ...)` throws a non-envelope body and, returned inside a `try`, turns a 4xx into a 500.
const SVELTEKIT_ERROR_BASELINE = 0;
const SVELTEKIT_ERROR = /(?<![.\w])error\(\s*\d{3}/g;

// A non-logging line that reads `err.message`: the text is about to reach the client or the response shape.
// Includes unified-analytics/query, which sends a Postgres syntax error (SQLSTATE 42601) to the admin who wrote the SQL, on purpose.
const LEAKED_MESSAGE_BASELINE = 7;
const LEAKED_MESSAGE = /\b(?:err|error|e)\??\.message/;
const LOGGING_LINE = /\b(?:console|log|logger)\.\w+\(/;
// `x instanceof SomethingError` (not plain Error) names one of our typed errors; `.message ===` and `.test(err.message)` are comparisons, not sends
const CLIENT_SAFE_LINE = /instanceof (?!Error\b)[A-Z]\w*Error|\.message\s*===|\.test\(\w+\.message\)/;

// Routes whose responses do not mention `success` (or apiOk/apiFail) at all. Exact: remove an entry when the route is migrated.
const NON_ENVELOPE_ROUTES: string[] = ['health/+server.ts'];

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === '+server.ts' ? [path] : [];
  });
}

const handlerFiles = readdirSync(ANALYTICS_HANDLERS_DIR)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .map((name) => join(ANALYTICS_HANDLERS_DIR, name));

const files = routeFiles(API_DIR).map((path) => ({ path: path.split(sep).join('/'), text: readFileSync(path, 'utf8') }));

describe('API response envelope ratchet', () => {
  it('finds the API routes', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('does not add SvelteKit error() responses', () => {
    const count = files.reduce((total, file) => total + (file.text.match(SVELTEKIT_ERROR)?.length ?? 0), 0);
    expect(count, `error(status, ...) calls: found ${count}, baseline ${SVELTEKIT_ERROR_BASELINE}. Use apiFail / apiServerError.`).toBe(SVELTEKIT_ERROR_BASELINE);
  });

  it('does not add routes that read err.message outside a log call', () => {
    const isLeak = (line: string) => LEAKED_MESSAGE.test(line) && !LOGGING_LINE.test(line) && !CLIENT_SAFE_LINE.test(line);
    const scanned = [...files, ...handlerFiles.map((path) => ({ path, text: readFileSync(path, 'utf8') }))];
    const count = scanned.reduce((total, file) => total + file.text.split('\n').filter(isLeak).length, 0);
    expect(count, `err.message reads outside logging: found ${count}, baseline ${LEAKED_MESSAGE_BASELINE}. Log the detail and send a generic message.`).toBe(LEAKED_MESSAGE_BASELINE);
  });

  it('keeps every route on the envelope except the listed ones', () => {
    const bare = files
      .filter((file) => !/\bsuccess\b|apiOk|apiFail|apiServerError|queryErrorResponse/.test(file.text))
      .map((file) => relative(API_DIR, file.path).split(sep).join('/'))
      .sort();
    expect(bare).toEqual([...NON_ENVELOPE_ROUTES].sort());
  });
});
