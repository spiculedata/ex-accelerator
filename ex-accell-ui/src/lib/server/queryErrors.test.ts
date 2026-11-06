import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

import { isMissingRelationError, queryErrorResponse } from './queryErrors';

describe('isMissingRelationError', () => {
  it('recognises the Postgres undefined_table code', () => {
    expect(isMissingRelationError(Object.assign(new Error('x'), { code: '42P01' }))).toBe(true);
  });

  it.each([
    'relation "radio_transcripts" does not exist',
    'Catalog Error: Table with name gdelt_events does not exist!',
    'Catalog Error: Table with name x does not exist'
  ])('recognises the message %j', (message) => {
    expect(isMissingRelationError(new Error(message))).toBe(true);
  });

  it.each([
    [Object.assign(new Error('syntax error at or near "FROM"'), { code: '42601' })],
    [new Error('connection refused')],
    [new Error('column "foo" does not exist')],
    [null],
    [undefined],
    ['relation "x" does not exist']
  ])('does not treat %j as a missing table', (error) => {
    expect(isMissingRelationError(error)).toBe(false);
  });
});

describe('queryErrorResponse', () => {
  it('returns empty data flagged unavailable when the table is missing', async () => {
    const error = Object.assign(new Error('relation "t" does not exist'), { code: '42P01' });

    const response = queryErrorResponse('Emotion stats', error, []);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: [], meta: { unavailable: true } });
  });

  it('preserves the empty shape the caller expects (object vs array)', async () => {
    const error = Object.assign(new Error('x'), { code: '42P01' });

    const body = await queryErrorResponse('Overview', error, { total: 0 }).json();

    expect(body.data).toEqual({ total: 0 });
  });

  it('returns a 500 with a generic message for real failures', async () => {
    const response = queryErrorResponse('Emotion stats', new Error('password authentication failed for user "postgres"'), []);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(/password|postgres/i);
  });
});
