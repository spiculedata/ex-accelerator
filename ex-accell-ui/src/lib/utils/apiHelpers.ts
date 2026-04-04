/**
 * API Response Helpers
 *
 * Utility functions for creating standardized API responses across
 * all endpoints. Ensures consistent response format and error handling.
 *
 * Usage in API endpoints:
 * ```typescript
 * import { createSuccessResponse, createErrorResponse } from '$lib/utils/apiHelpers';
 *
 * export const GET: RequestHandler = async () => {
 *   try {
 *     const data = await someService.getData();
 *     return json(createSuccessResponse(data));
 *   } catch (error) {
 *     return json(createErrorResponse(error), { status: 500 });
 *   }
 * };
 * ```
 */

import type { ApiResponse, ErrorResponse, PaginationMeta, ResponseMeta } from '$lib/types/apiTypes';
import { v4 as uuidv4 } from 'uuid';

// ===================================================================
// Success Response Builders
// ===================================================================

/**
 * Create a standard success response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Partial<ResponseMeta>
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
      ...meta
    }
  };
}

/**
 * Create a success response with a message
 */
export function createMessageResponse(
  message: string,
  additionalData?: Record<string, any>
): ApiResponse {
  return createSuccessResponse({
    message,
    ...additionalData
  });
}

/**
 * Create a paginated success response
 */
export function createPaginatedResponse<T>(
  items: T[],
  pagination: PaginationMeta,
  additionalData?: Record<string, any>
): ApiResponse<{ items: T[]; pagination: PaginationMeta }> {
  return {
    success: true,
    data: {
      items,
      pagination: {
        ...pagination,
        hasNext: pagination.page < pagination.totalPages,
        hasPrevious: pagination.page > 1
      },
      ...additionalData
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
      pagination
    }
  };
}

/**
 * Create a response with list and metadata
 */
export function createListResponse<T>(
  items: T[],
  summary?: Record<string, any>
): ApiResponse<{ items: T[]; summary?: Record<string, any> }> {
  return createSuccessResponse({
    items,
    ...(summary && { summary })
  });
}

// ===================================================================
// Error Response Builders
// ===================================================================

/**
 * Create a standard error response
 */
export function createErrorResponse(
  error: string | Error,
  details?: Record<string, any>,
  code?: string
): ErrorResponse {
  const errorMessage = error instanceof Error ? error.message : error;

  return {
    success: false,
    error: errorMessage,
    ...(details && { details }),
    ...(code && { code }),
    meta: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4()
    }
  };
}

/**
 * Create a validation error response
 */
export function createValidationError(
  fieldErrors: Record<string, string[]>
): ErrorResponse {
  return createErrorResponse(
    'Validation failed',
    { fields: fieldErrors },
    'VALIDATION_ERROR'
  );
}

/**
 * Create a not found error response
 */
export function createNotFoundError(
  resource: string,
  id?: string | number
): ErrorResponse {
  const message = id
    ? `${resource} with ID ${id} not found`
    : `${resource} not found`;

  return createErrorResponse(
    message,
    { resource, id },
    'NOT_FOUND'
  );
}

/**
 * Create an unauthorized error response
 */
export function createUnauthorizedError(
  message = 'Unauthorized access'
): ErrorResponse {
  return createErrorResponse(
    message,
    undefined,
    'UNAUTHORIZED'
  );
}

/**
 * Create a forbidden error response
 */
export function createForbiddenError(
  message = 'Access forbidden'
): ErrorResponse {
  return createErrorResponse(
    message,
    undefined,
    'FORBIDDEN'
  );
}

/**
 * Create a conflict error response
 */
export function createConflictError(
  resource: string,
  conflictingField?: string
): ErrorResponse {
  const message = conflictingField
    ? `${resource} with this ${conflictingField} already exists`
    : `${resource} already exists`;

  return createErrorResponse(
    message,
    { resource, field: conflictingField },
    'CONFLICT'
  );
}

/**
 * Create a bad request error response
 */
export function createBadRequestError(
  message: string,
  details?: Record<string, any>
): ErrorResponse {
  return createErrorResponse(
    message,
    details,
    'BAD_REQUEST'
  );
}

/**
 * Create a server error response
 */
export function createServerError(
  error?: Error,
  includeStack = false
): ErrorResponse {
  const details = includeStack && error?.stack
    ? { stack: error.stack }
    : undefined;

  return createErrorResponse(
    error?.message || 'Internal server error',
    details,
    'INTERNAL_ERROR'
  );
}

// ===================================================================
// Pagination Helpers
// ===================================================================

/**
 * Calculate pagination metadata from query params
 */
export function calculatePagination(
  total: number,
  page: number = 1,
  limit: number = 20
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page: Math.max(1, page),
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1
  };
}

/**
 * Extract pagination params from URL
 */
export function extractPaginationParams(
  url: URL,
  defaults: { page?: number; limit?: number } = {}
): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || String(defaults.page || 1)));
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || String(defaults.limit || 20))));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

// ===================================================================
// Response Wrapper Helpers
// ===================================================================

/**
 * Wrap a service call with standard error handling
 */
export async function wrapServiceCall<T>(
  serviceCall: () => Promise<T>,
  errorMessage = 'Operation failed'
): Promise<ApiResponse<T>> {
  try {
    const data = await serviceCall();
    return createSuccessResponse(data);
  } catch (error) {
    console.error(`[API] ${errorMessage}:`, error);
    return createErrorResponse(
      error instanceof Error ? error : new Error(errorMessage)
    ) as any; // Type cast needed due to success: false
  }
}

/**
 * Wrap a service call with custom error handler
 */
export async function wrapServiceCallWithHandler<T>(
  serviceCall: () => Promise<T>,
  errorHandler: (error: Error) => ErrorResponse
): Promise<ApiResponse<T>> {
  try {
    const data = await serviceCall();
    return createSuccessResponse(data);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return errorHandler(err) as any;
  }
}

// ===================================================================
// Data Transformation Helpers
// ===================================================================

/**
 * Transform database result to API response format
 */
export function transformDbResult<T, R>(
  result: T | T[],
  transformer: (item: T) => R
): R | R[] {
  if (Array.isArray(result)) {
    return result.map(transformer);
  }
  return transformer(result);
}

/**
 * Filter null/undefined values from response data
 */
export function cleanResponseData<T extends Record<string, any>>(
  data: T
): Partial<T> {
  const cleaned: Partial<T> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      cleaned[key as keyof T] = value;
    }
  }

  return cleaned;
}

/**
 * Merge default values with partial data
 */
export function withDefaults<T extends Record<string, any>>(
  data: Partial<T>,
  defaults: T
): T {
  return {
    ...defaults,
    ...cleanResponseData(data)
  } as T;
}

// ===================================================================
// Validation Helpers
// ===================================================================

/**
 * Validate required fields are present
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  const missing = requiredFields.filter(field => {
    const value = data[field];
    return value === null || value === undefined || value === '';
  });

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Create error response for missing required fields
 */
export function createMissingFieldsError(
  missingFields: string[]
): ErrorResponse {
  return createValidationError({
    required: missingFields.map(field => `${field} is required`)
  });
}

// ===================================================================
// HTTP Status Helpers
// ===================================================================

/**
 * Get appropriate HTTP status code for error response
 */
export function getHttpStatusForError(error: ErrorResponse): number {
  const statusMap: Record<string, number> = {
    'VALIDATION_ERROR': 400,
    'BAD_REQUEST': 400,
    'UNAUTHORIZED': 401,
    'FORBIDDEN': 403,
    'NOT_FOUND': 404,
    'CONFLICT': 409,
    'INTERNAL_ERROR': 500
  };

  return error.code ? (statusMap[error.code] || 500) : 500;
}

/**
 * Check if response is an error
 */
export function isErrorResponse(
  response: ApiResponse | ErrorResponse
): response is ErrorResponse {
  return response.success === false;
}

/**
 * Check if response is successful
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T> | ErrorResponse
): response is ApiResponse<T> {
  return response.success === true;
}
