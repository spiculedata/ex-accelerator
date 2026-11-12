import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Ratchet for issue #52. Every API route answers with the envelope `{ success, data, error }` (see
// `$lib/server/apiResponse.ts`), sends the client a generic message on a 500 and logs the detail. Routes not yet migrated
// are listed below with exact counts, so the numbers can only go down: lower a baseline (or delete a list entry) in the same
// change that fixes the route; the test fails when it is too high or too low.
//
// Allowed exceptions, none of which count as debt:
//   - health/+server.ts is a liveness probe whose plain body is read by orchestrators, not the UI.
//   - A `.message` that is deliberately client-safe because the error class is ours and carries user-facing text
//     (BodyTooLargeError, DataSharingError and the other typed data-sharing errors, the "No such user" check). Those files are
//     in CLIENT_SAFE_FILES and not counted.

const API_DIR = join('src', 'routes', 'api');

// SvelteKit `error(status, ...)` throws a non-envelope body and, returned inside a `try`, turns a 4xx into a 500.
const SVELTEKIT_ERROR_BASELINE = 25;
const SVELTEKIT_ERROR = /(?<![.\w])error\(\s*\d{3}/g;

// A non-logging line that reads `err.message`: the text is about to reach the client or the response shape.
const LEAKED_MESSAGE_BASELINE = 21;
const LEAKED_MESSAGE = /\b(?:err|error|e)\??\.message/;
const LOGGING_LINE = /\b(?:console|log|logger)\.\w+\(/;
const CLIENT_SAFE_FILES = [/data-sharing\/\+server\.ts$/, /workflows\/\[id\]\/\+server\.ts$/, /users\/\[id\]\/\+server\.ts$/];

// Routes whose responses do not mention `success` (or apiOk/apiFail) at all. Exact: remove an entry when the route is migrated.
const NON_ENVELOPE_ROUTES: string[] = ['gdelt/+server.ts', 'gdelt/mentions/+server.ts', 'health/+server.ts', 'job-monitor/+server.ts'];

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === '+server.ts' ? [path] : [];
  });
}

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
    const count = files
      .filter((file) => !CLIENT_SAFE_FILES.some((pattern) => pattern.test(file.path)))
      .reduce((total, file) => total + file.text.split('\n').filter((line) => LEAKED_MESSAGE.test(line) && !LOGGING_LINE.test(line)).length, 0);
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
