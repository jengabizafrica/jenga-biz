/**
 * Standardized HTTP response helpers
 * Ensures consistent API response format across all edge functions
 */

import { AuthError } from "./auth.ts";
import { ValidationError } from "./validation.ts";

// Standard CORS headers
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

// Response envelope interfaces
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleCors(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Success response helper
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  meta?: SuccessResponse<T>["meta"],
): Response {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

/**
 * Error response helper
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: any,
): Response {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

/**
 * Handle known errors and convert to appropriate responses
 */
export function handleError(error: unknown): Response {
  console.error("Function error:", error);

  if (error instanceof AuthError) {
    return errorResponse(
      "AUTH_ERROR",
      error.message,
      error.status,
    );
  }

  if (error instanceof ValidationError) {
    return errorResponse(
      "VALIDATION_ERROR",
      error.message,
      400,
      error.errors,
    );
  }

  // Database errors
  if (error && typeof error === "object" && "code" in error) {
    const dbError = error as any;

    // Handle common PostgreSQL errors
    switch (dbError.code) {
      case "23505": // unique_violation
        return errorResponse(
          "DUPLICATE_RECORD",
          "A record with this information already exists",
          409,
        );
      case "23503": // foreign_key_violation
        return errorResponse(
          "INVALID_REFERENCE",
          "Referenced record does not exist",
          400,
        );
      case "23502": // not_null_violation
        return errorResponse(
          "MISSING_REQUIRED_FIELD",
          "Required field is missing",
          400,
        );
      case "42501": // insufficient_privilege
        return errorResponse(
          "INSUFFICIENT_PRIVILEGES",
          "You do not have permission to perform this action",
          403,
        );
      default:
        break;
    }
  }

  // Generic server error
  return errorResponse(
    "INTERNAL_ERROR",
    "An unexpected error occurred",
    500,
  );
}

/**
 * Create paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
): Response {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return successResponse(data, 200, {
    pagination: {
      ...pagination,
      totalPages,
    },
  });
}

/**
 * No content response for successful operations with no data
 */
export function noContentResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Created response for successful resource creation
 */
export function createdResponse<T>(data: T): Response {
  return successResponse(data, 201);
}

/**
 * Common HTTP status codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;
