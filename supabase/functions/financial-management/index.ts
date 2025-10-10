/**
 * Financial Management Edge Function
 * Handles all financial operations including transactions, OCR, and calculations
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import {
  createOcrJobSchema,
  createTransactionSchema,
  getOcrJobsQuerySchema,
  getTransactionsQuerySchema,
  sanitizeString,
  updateTransactionSchema,
  uuidSchema,
  validateBody,
  validateQuery,
} from "../_shared/validation.ts";
import {
  createdResponse,
  errorResponse,
  handleCors,
  handleError,
  paginatedResponse,
  successResponse,
} from "../_shared/responses.ts";

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCors();
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    const method = req.method;

    // Route handling for transactions
    if (method === "GET" && lastSegment === "transactions") {
      return await getTransactions(req);
    }

    if (method === "POST" && lastSegment === "transactions") {
      return await createTransaction(req);
    }

    if (method === "PATCH" && pathSegments.includes("transactions")) {
      return await updateTransaction(req);
    }

    if (method === "DELETE" && pathSegments.includes("transactions")) {
      return await deleteTransaction(req);
    }

    // Route handling for financial calculations
    if (method === "GET" && lastSegment === "summary") {
      return await getFinancialSummary(req);
    }

    // Route handling for OCR operations
    if (method === "POST" && lastSegment === "ocr") {
      return await processOcrJob(req);
    }

    if (method === "GET" && pathSegments.includes("ocr")) {
      return await getOcrJobs(req);
    }

    return errorResponse("NOT_FOUND", "Endpoint not found", 404);
  } catch (error) {
    return handleError(error);
  }
};

/**
 * Get user's financial transactions
 * GET /financial-management/transactions
 */
async function getTransactions(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);

  const url = new URL(req.url);
  const query = validateQuery(url, getTransactionsQuerySchema);
  const {
    page,
    limit,
    type,
    category,
    currency,
    date_from,
    date_to,
    min_amount,
    max_amount,
    sort_by,
    sort_order,
  } = query;

  const offset = (page - 1) * limit;

  // Build query
  let dbQuery = supabase
    .from("financial_transactions")
    .select("*", { count: "exact" })
    .eq("user_id", user.id);

  // Apply filters
  if (type) {
    dbQuery = dbQuery.eq("transaction_type", type);
  }

  if (category) {
    dbQuery = dbQuery.eq("category", category);
  }

  if (currency) {
    dbQuery = dbQuery.eq("currency", currency);
  }

  if (date_from) {
    dbQuery = dbQuery.gte("transaction_date", date_from);
  }

  if (date_to) {
    dbQuery = dbQuery.lte("transaction_date", date_to);
  }

  if (min_amount !== undefined) {
    dbQuery = dbQuery.gte("amount", min_amount);
  }

  if (max_amount !== undefined) {
    dbQuery = dbQuery.lte("amount", max_amount);
  }

  // Apply sorting and pagination
  const { data, error, count } = await dbQuery
    .order(sort_by, { ascending: sort_order === "asc" })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  // Transform data to match frontend expectations
  const transactions = data?.map((transaction) => ({
    id: transaction.id,
    type: transaction.transaction_type,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    category: transaction.category,
    description: transaction.description,
    date: transaction.transaction_date,
    metadata: transaction.metadata,
    created_at: transaction.created_at,
  })) || [];

  return paginatedResponse(transactions, {
    page,
    limit,
    total: count || 0,
  });
}

/**
 * Create new financial transaction
 * POST /financial-management/transactions
 */
async function createTransaction(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  const transactionData = await validateBody(req, createTransactionSchema);

  // Sanitize description
  const sanitizedData = {
    ...transactionData,
    ...(transactionData.description && {
      description: sanitizeString(transactionData.description),
    }),
  };

  // Set default transaction date to today if not provided
  const transactionDate = sanitizedData.transaction_date ||
    new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("financial_transactions")
    .insert({
      user_id: user.id,
      transaction_type: sanitizedData.type,
      amount: sanitizedData.amount,
      currency: sanitizedData.currency,
      category: sanitizedData.category,
      description: sanitizedData.description,
      transaction_date: transactionDate,
      metadata: sanitizedData.metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Transform response to match frontend expectations
  const transaction = {
    id: data.id,
    type: data.transaction_type,
    amount: Number(data.amount),
    currency: data.currency,
    category: data.category,
    description: data.description,
    date: data.transaction_date,
    metadata: data.metadata,
    created_at: data.created_at,
  };

  return createdResponse(transaction);
}

/**
 * Update financial transaction
 * PATCH /financial-management/transactions/:id
 */
async function updateTransaction(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);

  const url = new URL(req.url);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const transactionId = pathSegments[pathSegments.length - 1];

  // Validate transaction ID
  uuidSchema.parse(transactionId);

  const updates = await validateBody(req, updateTransactionSchema);

  // Sanitize description if provided
  const sanitizedUpdates = {
    ...updates,
    ...(updates.description && {
      description: sanitizeString(updates.description),
    }),
  };

  // Transform frontend field names to database field names
  const dbUpdates: any = {};
  if (sanitizedUpdates.type) dbUpdates.transaction_type = sanitizedUpdates.type;
  if (sanitizedUpdates.amount !== undefined) {
    dbUpdates.amount = sanitizedUpdates.amount;
  }
  if (sanitizedUpdates.currency) dbUpdates.currency = sanitizedUpdates.currency;
  if (sanitizedUpdates.category) dbUpdates.category = sanitizedUpdates.category;
  if (sanitizedUpdates.description !== undefined) {
    dbUpdates.description = sanitizedUpdates.description;
  }
  if (sanitizedUpdates.transaction_date) {
    dbUpdates.transaction_date = sanitizedUpdates.transaction_date;
  }
  if (sanitizedUpdates.metadata) dbUpdates.metadata = sanitizedUpdates.metadata;

  const { data, error } = await supabase
    .from("financial_transactions")
    .update(dbUpdates)
    .eq("id", transactionId)
    .eq("user_id", user.id) // Ensure user owns the transaction
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Transform response
  const transaction = {
    id: data.id,
    type: data.transaction_type,
    amount: Number(data.amount),
    currency: data.currency,
    category: data.category,
    description: data.description,
    date: data.transaction_date,
    metadata: data.metadata,
    created_at: data.created_at,
  };

  return successResponse(transaction);
}

/**
 * Delete financial transaction
 * DELETE /financial-management/transactions/:id
 */
async function deleteTransaction(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);

  const url = new URL(req.url);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const transactionId = pathSegments[pathSegments.length - 1];

  // Validate transaction ID
  uuidSchema.parse(transactionId);

  const { error } = await supabase
    .from("financial_transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", user.id); // Ensure user owns the transaction

  if (error) {
    throw error;
  }

  return successResponse({
    transactionId,
    message: "Transaction deleted successfully",
  });
}

/**
 * Get financial summary with calculations
 * GET /financial-management/summary
 */
async function getFinancialSummary(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);

  const url = new URL(req.url);
  const currency = url.searchParams.get("currency") || "KES";
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");

  // Build query for calculations
  let query = supabase
    .from("financial_transactions")
    .select("transaction_type, amount, category")
    .eq("user_id", user.id)
    .eq("currency", currency);

  if (dateFrom) {
    query = query.gte("transaction_date", dateFrom);
  }

  if (dateTo) {
    query = query.lte("transaction_date", dateTo);
  }

  const { data: transactions, error } = await query;

  if (error) {
    throw error;
  }

  // Calculate totals
  const incomeTransactions =
    transactions?.filter((t) => t.transaction_type === "income") || [];
  const expenseTransactions =
    transactions?.filter((t) => t.transaction_type === "expense") || [];

  const totalIncome = incomeTransactions.reduce(
    (sum, t) => sum + Number(t.amount),
    0,
  );
  const totalExpenses = expenseTransactions.reduce(
    (sum, t) => sum + Number(t.amount),
    0,
  );
  const netProfit = totalIncome - totalExpenses;

  // Calculate category breakdowns
  const incomeByCategory = incomeTransactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const expensesByCategory = expenseTransactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  return successResponse({
    currency,
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      netProfit,
      profitMargin: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
    },
    breakdown: {
      incomeByCategory,
      expensesByCategory,
    },
    transactionCounts: {
      income: incomeTransactions.length,
      expenses: expenseTransactions.length,
      total: transactions?.length || 0,
    },
  });
}

/**
 * Process OCR job for receipt/document
 * POST /financial-management/ocr
 */
async function processOcrJob(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);
  const ocrData = await validateBody(req, createOcrJobSchema);

  // Create OCR job record
  const { data: ocrJob, error: insertError } = await supabase
    .from("ocr_jobs")
    .insert({
      user_id: user.id,
      file_path: ocrData.file_path,
      status: "pending",
      expected_type: ocrData.expected_type,
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  // TODO: Implement actual OCR processing
  // For now, return the job with pending status
  // In a real implementation, you would:
  // 1. Queue the job for async processing
  // 2. Call external OCR service (Tesseract, AWS Textract, etc.)
  // 3. Update job status and results

  return createdResponse({
    id: ocrJob.id,
    status: ocrJob.status,
    file_path: ocrJob.file_path,
    expected_type: ocrJob.expected_type,
    message: "OCR job created and queued for processing",
  });
}

/**
 * Get user's OCR jobs
 * GET /financial-management/ocr
 */
async function getOcrJobs(req: Request): Promise<Response> {
  const { user, supabase } = await getUserFromRequest(req);

  const url = new URL(req.url);
  const query = validateQuery(url, getOcrJobsQuerySchema);
  const { page, limit, status, date_from, date_to } = query;

  const offset = (page - 1) * limit;

  // Build query
  let dbQuery = supabase
    .from("ocr_jobs")
    .select("*", { count: "exact" })
    .eq("user_id", user.id);

  // Apply filters
  if (status) {
    dbQuery = dbQuery.eq("status", status);
  }

  if (date_from) {
    dbQuery = dbQuery.gte("created_at", date_from);
  }

  if (date_to) {
    dbQuery = dbQuery.lte("created_at", date_to);
  }

  // Apply pagination and sorting
  const { data, error, count } = await dbQuery
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return paginatedResponse(data || [], {
    page,
    limit,
    total: count || 0,
  });
}

serve(handler);
