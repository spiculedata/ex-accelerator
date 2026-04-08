import {
  createSuccessResponse, createMessageResponse, createPaginatedResponse, createListResponse,
  createErrorResponse, createValidationError, createNotFoundError, createUnauthorizedError,
  createForbiddenError, createConflictError, createBadRequestError, createServerError,
  calculatePagination, extractPaginationParams,
  wrapServiceCall, wrapServiceCallWithHandler,
  transformDbResult, cleanResponseData, withDefaults,
  validateRequiredFields, createMissingFieldsError,
  getHttpStatusForError, isErrorResponse, isSuccessResponse
} from './apiHelpers';

// Mock uuid to produce deterministic IDs
vi.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

describe('createSuccessResponse', () => {
  it('wraps data with success and meta', () => {
    const res = createSuccessResponse({ foo: 'bar' });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ foo: 'bar' });
    expect(res.meta?.requestId).toBe('test-uuid-1234');
    expect(res.meta?.timestamp).toBeDefined();
  });

  it('merges additional meta', () => {
    const res = createSuccessResponse('data', { requestId: 'custom' });
    expect(res.meta?.requestId).toBe('custom');
  });
});

describe('createMessageResponse', () => {
  it('creates response with message in data', () => {
    const res = createMessageResponse('done');
    expect(res.success).toBe(true);
    expect(res.data.message).toBe('done');
  });

  it('merges additional data', () => {
    const res = createMessageResponse('ok', { count: 5 });
    expect(res.data.count).toBe(5);
  });
});

describe('createPaginatedResponse', () => {
  it('includes items, pagination, and computes hasNext/hasPrevious', () => {
    const pagination = { page: 2, limit: 10, total: 30, totalPages: 3 };
    const res = createPaginatedResponse([1, 2, 3], pagination);
    expect(res.success).toBe(true);
    expect(res.data.items).toEqual([1, 2, 3]);
    expect(res.data.pagination.hasNext).toBe(true);
    expect(res.data.pagination.hasPrevious).toBe(true);
  });

  it('sets hasNext false on last page', () => {
    const pagination = { page: 3, limit: 10, total: 30, totalPages: 3 };
    const res = createPaginatedResponse([], pagination);
    expect(res.data.pagination.hasNext).toBe(false);
  });
});

describe('createListResponse', () => {
  it('creates response with items', () => {
    const res = createListResponse([1, 2]);
    expect(res.data.items).toEqual([1, 2]);
  });

  it('includes summary when provided', () => {
    const res = createListResponse([], { total: 0 });
    expect(res.data.summary).toEqual({ total: 0 });
  });
});

describe('createErrorResponse', () => {
  it('handles string error', () => {
    const res = createErrorResponse('bad input');
    expect(res.success).toBe(false);
    expect(res.error).toBe('bad input');
  });

  it('handles Error object', () => {
    const res = createErrorResponse(new Error('oops'));
    expect(res.error).toBe('oops');
  });

  it('includes details and code when provided', () => {
    const res = createErrorResponse('err', { field: 'x' }, 'ERR_CODE');
    expect(res.details).toEqual({ field: 'x' });
    expect(res.code).toBe('ERR_CODE');
  });

  it('omits details and code when not provided', () => {
    const res = createErrorResponse('err');
    expect(res).not.toHaveProperty('details');
    expect(res).not.toHaveProperty('code');
  });
});

describe('specialized error responses', () => {
  it('createValidationError', () => {
    const res = createValidationError({ name: ['required'] });
    expect(res.code).toBe('VALIDATION_ERROR');
    expect(res.error).toBe('Validation failed');
    expect(res.details?.fields).toEqual({ name: ['required'] });
  });

  it('createNotFoundError with id', () => {
    const res = createNotFoundError('User', 42);
    expect(res.error).toBe('User with ID 42 not found');
    expect(res.code).toBe('NOT_FOUND');
  });

  it('createNotFoundError without id', () => {
    const res = createNotFoundError('User');
    expect(res.error).toBe('User not found');
  });

  it('createUnauthorizedError', () => {
    expect(createUnauthorizedError().code).toBe('UNAUTHORIZED');
    expect(createUnauthorizedError('custom msg').error).toBe('custom msg');
  });

  it('createForbiddenError', () => {
    expect(createForbiddenError().code).toBe('FORBIDDEN');
  });

  it('createConflictError with field', () => {
    const res = createConflictError('User', 'email');
    expect(res.error).toBe('User with this email already exists');
    expect(res.code).toBe('CONFLICT');
  });

  it('createConflictError without field', () => {
    expect(createConflictError('User').error).toBe('User already exists');
  });

  it('createBadRequestError', () => {
    const res = createBadRequestError('invalid', { hint: 'fix it' });
    expect(res.code).toBe('BAD_REQUEST');
    expect(res.details?.hint).toBe('fix it');
  });

  it('createServerError with Error', () => {
    const res = createServerError(new Error('boom'));
    expect(res.error).toBe('boom');
    expect(res.code).toBe('INTERNAL_ERROR');
  });

  it('createServerError without Error', () => {
    expect(createServerError().error).toBe('Internal server error');
  });

  it('createServerError includes stack when requested', () => {
    const err = new Error('boom');
    const res = createServerError(err, true);
    expect(res.details?.stack).toBeDefined();
  });
});

describe('calculatePagination', () => {
  it('calculates correct pagination', () => {
    const p = calculatePagination(100, 2, 20);
    expect(p.total).toBe(100);
    expect(p.totalPages).toBe(5);
    expect(p.hasNext).toBe(true);
    expect(p.hasPrevious).toBe(true);
  });

  it('clamps page to minimum 1', () => {
    const p = calculatePagination(10, -1, 5);
    expect(p.page).toBe(1);
  });

  it('sets hasNext false on last page', () => {
    const p = calculatePagination(10, 2, 5);
    expect(p.hasNext).toBe(false);
  });

  it('uses defaults', () => {
    const p = calculatePagination(50);
    expect(p.page).toBe(1);
    expect(p.limit).toBe(20);
  });
});

describe('extractPaginationParams', () => {
  function makeUrl(params: Record<string, string> = {}): URL {
    const url = new URL('http://localhost/api');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url;
  }

  it('extracts page and limit from URL', () => {
    const result = extractPaginationParams(makeUrl({ page: '3', limit: '50' }));
    expect(result).toEqual({ page: 3, limit: 50, offset: 100 });
  });

  it('uses defaults when params missing', () => {
    const result = extractPaginationParams(makeUrl());
    expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('clamps limit to max 100', () => {
    const result = extractPaginationParams(makeUrl({ limit: '999' }));
    expect(result.limit).toBe(100);
  });

  it('clamps page to min 1', () => {
    const result = extractPaginationParams(makeUrl({ page: '0' }));
    expect(result.page).toBe(1);
  });
});

describe('wrapServiceCall', () => {
  it('wraps successful call', async () => {
    const res = await wrapServiceCall(() => Promise.resolve(42));
    expect(res.success).toBe(true);
    expect(res.data).toBe(42);
  });

  it('wraps failed call with error message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await wrapServiceCall(() => Promise.reject(new Error('fail')));
    expect(res.success).toBe(false);
  });
});

describe('wrapServiceCallWithHandler', () => {
  it('wraps successful call', async () => {
    const res = await wrapServiceCallWithHandler(
      () => Promise.resolve('ok'),
      () => createErrorResponse('handled')
    );
    expect(res.success).toBe(true);
  });

  it('calls error handler on failure', async () => {
    const res = await wrapServiceCallWithHandler(
      () => Promise.reject(new Error('boom')),
      (err) => createErrorResponse(err.message)
    );
    expect(res.success).toBe(false);
  });
});

describe('transformDbResult', () => {
  const double = (n: number) => n * 2;

  it('transforms array', () => {
    expect(transformDbResult([1, 2, 3], double)).toEqual([2, 4, 6]);
  });

  it('transforms single item', () => {
    expect(transformDbResult(5, double)).toBe(10);
  });
});

describe('cleanResponseData', () => {
  it('removes null and undefined values', () => {
    expect(cleanResponseData({ a: 1, b: null, c: undefined, d: 'ok' }))
      .toEqual({ a: 1, d: 'ok' });
  });

  it('keeps falsy non-null values', () => {
    expect(cleanResponseData({ a: 0, b: '', c: false }))
      .toEqual({ a: 0, b: '', c: false });
  });
});

describe('withDefaults', () => {
  it('merges partial data over defaults', () => {
    expect(withDefaults({ a: 10 }, { a: 1, b: 2 })).toEqual({ a: 10, b: 2 });
  });

  it('ignores null values in partial data', () => {
    expect(withDefaults({ a: null as any }, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
  });
});

describe('validateRequiredFields', () => {
  it('passes when all fields present', () => {
    const result = validateRequiredFields({ name: 'Tom', age: 30 }, ['name', 'age']);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('fails when fields missing or empty', () => {
    const result = validateRequiredFields({ name: '', age: null }, ['name', 'age', 'email']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['name', 'age', 'email']);
  });
});

describe('createMissingFieldsError', () => {
  it('creates validation error with field messages', () => {
    const res = createMissingFieldsError(['name', 'email']);
    expect(res.code).toBe('VALIDATION_ERROR');
    expect(res.details?.fields.required).toEqual([
      'name is required',
      'email is required'
    ]);
  });
});

describe('getHttpStatusForError', () => {
  it.each([
    ['VALIDATION_ERROR', 400],
    ['BAD_REQUEST', 400],
    ['UNAUTHORIZED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['INTERNAL_ERROR', 500],
  ])('maps %s to %d', (code, status) => {
    const err = createErrorResponse('test', undefined, code);
    expect(getHttpStatusForError(err)).toBe(status);
  });

  it('defaults to 500 for unknown code', () => {
    const err = createErrorResponse('test', undefined, 'UNKNOWN');
    expect(getHttpStatusForError(err)).toBe(500);
  });

  it('defaults to 500 when no code', () => {
    const err = createErrorResponse('test');
    expect(getHttpStatusForError(err)).toBe(500);
  });
});

describe('isErrorResponse / isSuccessResponse', () => {
  it('identifies error responses', () => {
    const err = createErrorResponse('fail');
    expect(isErrorResponse(err)).toBe(true);
    expect(isSuccessResponse(err)).toBe(false);
  });

  it('identifies success responses', () => {
    const ok = createSuccessResponse('data');
    expect(isSuccessResponse(ok)).toBe(true);
    expect(isErrorResponse(ok)).toBe(false);
  });
});
