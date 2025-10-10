/**
 * Validation schemas using Zod
 * Centralizes input validation for all edge functions
 */

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ==========================================
// Common validation schemas
// ==========================================

export const uuidSchema = z.string().uuid("Invalid UUID format");
export const emailSchema = z.string().email("Invalid email format");
export const nonEmptyStringSchema = z.string().min(1, "Field cannot be empty");
export const positiveNumberSchema = z.number().positive(
  "Must be a positive number",
);
export const currencyAmountSchema = z.number().min(
  0,
  "Amount must be non-negative",
);

// Pagination schemas
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

// ==========================================
// User Management Schemas
// ==========================================

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  account_type: z.enum(["business", "organization", "individual"]).optional(),
  country: z.string().length(2).optional(), // ISO 3166-1 alpha-2
  organization_name: z.string().max(200).optional(),
});

export const updateUserRoleSchema = z.object({
  userId: uuidSchema,
  role: z.enum(["entrepreneur", "hub_manager", "admin", "super_admin"]),
  action: z.enum(["add", "remove"]),
  // Optional hub context for hub-scoped roles
  hub_id: z.string().uuid().optional(),
});

export const getUsersQuerySchema = z.object({
  ...paginationSchema.shape,
  search: z.string().optional(),
  role: z.enum(["entrepreneur", "hub_manager", "admin", "super_admin"])
    .optional(),
  accountType: z.enum(["business", "organization", "individual"]).optional(),
  // Optional hub scoping (UUID)
  hubId: z.string().uuid().optional(),
});

// ==========================================
// Financial Transaction Schemas
// ==========================================

export const transactionTypeSchema = z.enum(["income", "expense"]);
export const transactionCategorySchema = z.object({
  income: z.enum(["Cash", "Bank Transfer", "Mobile Money", "Card Payment"]),
  expense: z.enum([
    "Operational",
    "Marketing",
    "Equipment",
    "Supplies",
    "Transportation",
  ]),
});

export const createTransactionSchema = z.object({
  type: transactionTypeSchema,
  amount: currencyAmountSchema,
  currency: z.string().length(3), // ISO 4217 currency code
  category: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  transaction_date: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const getTransactionsQuerySchema = z.object({
  ...paginationSchema.shape,
  type: transactionTypeSchema.optional(),
  category: z.string().optional(),
  currency: z.string().length(3).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  min_amount: currencyAmountSchema.optional(),
  max_amount: currencyAmountSchema.optional(),
  sort_by: z.enum(["transaction_date", "amount", "created_at"]).default(
    "transaction_date",
  ),
  sort_order: sortOrderSchema,
});

export const updateTransactionSchema = createTransactionSchema.partial();

// ==========================================
// OCR Schemas
// ==========================================

export const ocrJobStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const createOcrJobSchema = z.object({
  file_path: z.string().min(1),
  file_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  expected_type: z.enum(["receipt", "invoice", "document"]).default("receipt"),
});

export const getOcrJobsQuerySchema = z.object({
  ...paginationSchema.shape,
  status: ocrJobStatusSchema.optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
});

// ==========================================
// Authentication Schemas
// ==========================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(2).max(100),
  account_type: z.enum(["business", "organization"]).default("business"),
  invite_code: z.string().optional(),
  country: z.string().length(2).optional(),
  organization_name: z.string().max(200).optional(),
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
});

// ==========================================
// Invite Code Schemas
// ==========================================

export const createInviteCodeSchema = z.object({
  invited_email: emailSchema,
  account_type: z.enum(["business", "organization"]).default("business"),
  // Optional hub context; when provided, associates the invite with a hub
  hub_id: z.string().uuid().nullable().optional(),
  // Optional explicit expiry in ISO string; default will be applied server-side
  expires_at: z.string().datetime().optional(),
});

export const validateInviteCodeQuerySchema = z.object({
  code: z.string().min(6),
});

export const consumeInviteCodeSchema = z.object({
  code: z.string().min(6),
  user_id: uuidSchema,
});

// ==========================================
// Subscription & Payments Schemas
// ==========================================

export const subscriptionPlanSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default("KES"),
  billing_cycle: z.enum(["monthly", "yearly"]).default("monthly"),
  features: z.record(z.unknown()).default({}),
  is_active: z.boolean().default(true),
});

export const updateSubscriptionPlanSchema = subscriptionPlanSchema.partial();

export const assignSubscriptionSchema = z.object({
  user_id: uuidSchema,
  plan_id: uuidSchema,
});

// Paystack initiation schema
export const paystackInitiateSchema = z.object({
  plan_id: uuidSchema,
  callback_url: z.string().url().optional(),
});

// ==========================================
// Utility functions
// ==========================================

/**
 * Validate request body against schema
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError("Invalid request body", error.errors);
    }
    throw new ValidationError("Invalid JSON in request body");
  }
}

/**
 * Validate query parameters against schema
 */
export function validateQuery<T>(url: URL, schema: z.ZodSchema<T>): T {
  try {
    const params: Record<string, unknown> = {};

    for (const [key, value] of url.searchParams.entries()) {
      // Handle numeric values
      if (!isNaN(Number(value)) && value !== "") {
        params[key] = Number(value);
      } else {
        params[key] = value;
      }
    }

    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError("Invalid query parameters", error.errors);
    }
    throw new ValidationError("Invalid query parameters");
  }
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  constructor(message: string, public errors?: z.ZodIssue[]) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Sanitize HTML and prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
}
