/**
 * Frontend API Client for Edge Functions
 * Provides typed interface to communicate with Supabase Edge Functions
 */

import { supabase } from '@/integrations/supabase/client';

// ==========================================
// Types matching the edge function schemas
// ==========================================

export interface User {
  id: string;
  email: string;
  full_name: string;
  account_type: string;
  country?: string;
  organization_name?: string;
  roles: string[];
  created_at: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category: string;
  description?: string;
  date: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface FinancialSummary {
  currency: string;
  totals: {
    income: number;
    expenses: number;
    netProfit: number;
    profitMargin: number;
  };
  breakdown: {
    incomeByCategory: Record<string, number>;
    expensesByCategory: Record<string, number>;
  };
  transactionCounts: {
    income: number;
    expenses: number;
    total: number;
  };
}

export interface OcrJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_path: string;
  expected_type: 'receipt' | 'invoice' | 'document';
  result?: Record<string, any>;
  error_message?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// ==========================================
// API Client Class
// ==========================================

class EdgeFunctionsApiClient {
  private baseUrl: string;

  constructor() {
    const root = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    // Prefer the dedicated functions domain to avoid proxy/CORS issues
    // e.g., https://<project>.supabase.co -> https://<project>.functions.supabase.co
    const functionsDomain = root.replace('https://', 'https://').replace('.supabase.co', '.functions.supabase.co');
    this.baseUrl = functionsDomain;
  }

  /**
   * Get authorization headers with current user token
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': anonKey,
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }

  /**
   * Generic API request handler
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeaders();

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/${endpoint}`, {
        ...options,
        mode: 'cors',
        cache: 'no-store',
        headers: {
          ...headers,
          ...(options.headers || {}),
        },
      });
    } catch (err) {
      throw new ApiError({
        code: 'NETWORK_ERROR',
        message: 'Failed to reach server',
        details: { endpoint, error: err instanceof Error ? err.message : String(err) }
      });
    }

    // Read response as text first to preserve raw body for better errors
    const text = await res.text();
    let data: any = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        // not JSON, keep raw text
        data = text;
      }
    }

    // If response is not ok, map common statuses and extract error details
    if (!res.ok || (data && data.success === false)) {
      const status = res.status;

      // Prefer structured error from JSON body when available
      const bodyError = (typeof data === 'object' && data !== null && (data.error || data.message || data?.data?.error))
        ? (data.error || { message: data.message } || data?.data?.error)
        : null;

      const mapped =
        status === 401 ? { code: '401', message: bodyError?.message || 'Invalid JWT' } :
        status === 403 ? { code: '403', message: bodyError?.message || 'Forbidden' } :
        status === 404 ? { code: '404', message: bodyError?.message || 'Endpoint not found' } :
        bodyError ? { code: bodyError.code || String(status), message: bodyError.message || String(bodyError) } :
        { code: String(status || 'UNKNOWN_ERROR'), message: (typeof data === 'string' ? data : (data?.message || res.statusText || 'An error occurred')) };

      // Attach endpoint and raw body for easier debugging
      (mapped as any).endpoint = endpoint;
      (mapped as any).status = status;
      (mapped as any).raw = text;

      throw new ApiError(mapped);
    }

    // Success - return parsed JSON object or empty object
    return (data ?? ({} as T));
  }

  // ==========================================
  // User Management API
  // ==========================================

  /**
   * Login via Supabase Auth and persist session
   */
  async login(email: string, password: string): Promise<{
    access_token: string;
    expires_in: number;
    refresh_token: string | null;
    user: { id: string; email: string | null };
  }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new ApiError({ code: '401', message: error?.message || 'Invalid credentials' });
    }
    return {
      access_token: data.session.access_token,
      expires_in: data.session.expires_in ?? 3600,
      refresh_token: data.session.refresh_token ?? null,
  user: { id: data.user.id, email: data.user.email ?? null },
    };
  }

  /**
   * Get current user profile and roles
   */
  async getProfile(): Promise<User> {
    const response = await this.request<ApiResponse<User>>('user-management/me');
    return response.data;
  }

  /** Alias for compatibility */
  async getCurrentUser(): Promise<User> {
    return this.getProfile();
  }

  /**
   * Update current user's profile
   */
  async updateProfile(updates: Partial<Pick<User, 'full_name' | 'account_type' | 'country' | 'organization_name'>>): Promise<User> {
    const response = await this.request<ApiResponse<User>>('user-management/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return response.data;
  }

  /** Alias for compatibility */
  async updateMyProfile(updates: Partial<Pick<User, 'full_name' | 'account_type' | 'country' | 'organization_name'>>): Promise<User> {
    return this.updateProfile(updates);
  }

  /**
   * Get users list (admin only)
   */
  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    accountType?: string;
    hubId?: string;
  } = {}): Promise<PaginatedResponse<User>> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.set(key, String(value));
    });

    // If a hubId is provided, include it as a query param for server-side scoping
    return this.request<PaginatedResponse<User>>(
      `user-management?${queryParams.toString()}`
    );
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(
    userId: string,
    role: string,
    action: 'add' | 'remove'
  ): Promise<{ message: string }> {
    // Validate required fields client-side to avoid 400s
    if (!userId || !role || !action) {
      throw new ApiError({ code: 'MISSING_REQUIRED_FIELD', message: 'userId, role and action are required' });
    }

    const response = await this.request<ApiResponse<{ message: string }>>('user-management/roles', {
      method: 'POST',
      body: JSON.stringify({ userId, role, action }),
    });
    return response.data;
  }

  /**
   * Admin update user (super admin only)
   */
  async adminUpdateUser(
    userId: string,
    updates: Partial<Pick<User, 'full_name' | 'account_type' | 'country' | 'organization_name'>>
  ): Promise<User> {
    if (!userId) {
      throw new ApiError({ code: 'MISSING_USER_ID', message: 'userId is required' });
    }

    try {
      const response = await this.request<ApiResponse<User>>(`user-management?userId=${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return response.data;
    } catch (err: any) {
      // Map PostgREST single-row coercion error to not found
      const raw = err?.error?.raw || err?.error?.raw || err?.error?.message || '';
      if (String(raw).includes('PGRST116') || String(raw).includes('Cannot coerce the result to a single JSON object')) {
        throw new ApiError({ code: '404', message: 'User not found' });
      }
      throw err;
    }
  }

  /**
   * Deactivate user (super admin only)
   */
  async deactivateUser(userId: string): Promise<{ message: string }> {
    const response = await this.request<ApiResponse<{ message: string }>>(`user-management?userId=${userId}`, {
      method: 'DELETE',
    });
    return response.data;
  }

  /**
   * Permanently delete a user (super admin only) - hard delete
   */
  async deleteUserHard(userId: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`user-management?userId=${userId}&hard=true`, {
      method: 'DELETE',
    });
    return response.data;
  }

  // ==========================================
  // Financial Management API
  // ==========================================

  /**
   * Get user's financial transactions
   */
  async getTransactions(params: {
    page?: number;
    limit?: number;
    type?: 'income' | 'expense';
    category?: string;
    currency?: string;
    date_from?: string;
    date_to?: string;
    min_amount?: number;
    max_amount?: number;
    sort_by?: 'transaction_date' | 'amount' | 'created_at';
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<PaginatedResponse<Transaction>> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.set(key, String(value));
    });

    return this.request<PaginatedResponse<Transaction>>(
      `financial-management/transactions?${queryParams.toString()}`
    );
  }

  /**
   * Create new financial transaction
   */
  async createTransaction(transaction: {
    type: 'income' | 'expense';
    amount: number;
    currency: string;
    category: string;
    description?: string;
    transaction_date?: string;
    metadata?: Record<string, any>;
  }): Promise<Transaction> {
    const response = await this.request<ApiResponse<Transaction>>('financial-management/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction),
    });
    return response.data;
  }

  /**
   * Update financial transaction
   */
  async updateTransaction(
    transactionId: string, 
    updates: Partial<Omit<Transaction, 'id' | 'created_at'>>
  ): Promise<Transaction> {
    const response = await this.request<ApiResponse<Transaction>>(`financial-management/transactions/${transactionId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return response.data;
  }

  /**
   * Delete financial transaction
   */
  async deleteTransaction(transactionId: string): Promise<{ message: string }> {
    const response = await this.request<ApiResponse<{ message: string }>>(`financial-management/transactions/${transactionId}`, {
      method: 'DELETE',
    });
    return response.data;
  }

  /**
   * Get financial summary with calculations
   */
  async getFinancialSummary(params: {
    currency?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<FinancialSummary> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.set(key, String(value));
    });

    const response = await this.request<ApiResponse<FinancialSummary>>(
      `financial-management/summary?${queryParams.toString()}`
    );
    return response.data;
  }

  /**
   * Process OCR job for receipt/document
   */
  async processOcrJob(data: {
    file_path: string;
    file_type: 'image/jpeg' | 'image/png' | 'image/webp';
    expected_type?: 'receipt' | 'invoice' | 'document';
  }): Promise<OcrJob> {
    const response = await this.request<ApiResponse<OcrJob>>('financial-management/ocr', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * Get user's OCR jobs
   */
  async getOcrJobs(params: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    date_from?: string;
    date_to?: string;
  } = {}): Promise<PaginatedResponse<OcrJob>> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.set(key, String(value));
    });

    return this.request<PaginatedResponse<OcrJob>>(
      `financial-management/ocr?${queryParams.toString()}`
    );
  }

  // ==========================================
  // Subscriptions API
  // ==========================================
  /**
   * Make a public API request without requiring authentication
   */
  public async publicRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      } as Record<string, string>;

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/${endpoint}`, {
          ...options,
          mode: 'cors',
          cache: 'no-store',
          headers: {
            ...headers,
            ...(options.headers || {}),
          },
        });
      } catch (err) {
        throw new ApiError({
          code: 'NETWORK_ERROR',
          message: 'Failed to reach server',
          details: { endpoint, error: err instanceof Error ? err.message : String(err) }
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = errorText ? JSON.parse(errorText) : null;
        } catch {
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        throw new ApiError({
          code: `http_${response.status}`,
          message: errorData?.message || errorData?.error?.message || 'Request failed',
          details: errorData
        });
      }

      const text = await response.text();
      if (!text) {
        throw new ApiError({
          code: 'empty_response',
          message: 'Received empty response from server'
        });
      }
      return JSON.parse(text);
    } catch (error) {
      console.error('Public request failed:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError({
        code: 'request_failed',
        message: error instanceof Error ? error.message : 'Request failed',
        details: error
      });
    }
  }

  /**
   * List all available subscription plans
   * This works for both authenticated and unauthenticated users
   */
  async listPlans(): Promise<Array<{
    id: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    billing_cycle: string;
    features: Record<string, any>;
    is_active: boolean;
  }>> {
    try {
      // First try public request
      const response = await this.publicRequest<{
        data: Array<{
          id: string;
          name: string;
          description?: string;
          price: number;
          currency: string;
          billing_cycle: string;
          features: Record<string, any>;
          is_active: boolean;
        }>;
      }>('subscriptions/plans');
      
      // Handle different response formats
      if (Array.isArray(response)) {
        return response.filter(plan => plan.is_active !== false);
      }
      if (response && Array.isArray(response.data)) {
        return response.data.filter((plan: any) => plan.is_active !== false);
      }
      
      throw new Error('Unexpected response format from server');
    } catch (error) {
      console.error('Failed to fetch plans with public request, falling back to authenticated request:', error);
      
      // Fallback to authenticated request if public fails
      try {
        const response = await this.request<{
          data: Array<{
            id: string;
            name: string;
            description?: string;
            price: number;
            currency: string;
            billing_cycle: string;
            features: Record<string, any>;
            is_active: boolean;
          }>;
        }>('subscriptions/plans');

        if (Array.isArray(response)) {
          return response.filter(plan => plan.is_active !== false);
        }
        if (response && Array.isArray(response.data)) {
          return response.data.filter((plan: any) => plan.is_active !== false);
        }
        
        throw new Error('Unexpected response format from server');
      } catch (innerError) {
        console.error('Failed to fetch plans with authenticated request:', innerError);
        // Return empty array instead of throwing to prevent UI crash
        return [];
      }
    }
  }
  async getMySubscription(): Promise<any | null> {
    const res = await this.request<ApiResponse<any | null>>('subscriptions/me');
    return (res as any)?.data ?? (res as unknown as any | null);
  }

  async initiatePaystack(planId: string, callbackUrl?: string): Promise<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }> {
    const payload: Record<string, unknown> = { plan_id: planId };
    if (callbackUrl) payload.callback_url = callbackUrl;
    const res = await this.request<ApiResponse<{ authorization_url: string; access_code: string; reference: string }>>(
      'subscriptions/paystack/initiate',
      { method: 'POST', body: JSON.stringify(payload) }
    );
    return res.data;
  }

  async createPlan(plan: {
    name: string;
    description?: string;
    price: number;
    currency: string;
    billing_cycle: string;
    features: Record<string, any>;
    is_active: boolean;
  }): Promise<any> {
    const res = await this.request<ApiResponse<any>>('subscriptions/plans', {
      method: 'POST',
      body: JSON.stringify(plan)
    });
    return res.data;
  }

  async updatePlan(planId: string, updates: Partial<{
    name: string;
    description?: string;
    price: number;
    currency: string;
    billing_cycle: string;
    features: Record<string, any>;
    is_active: boolean;
  }>): Promise<any> {
    const res = await this.request<ApiResponse<any>>(`subscriptions/plans?id=${planId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    return res.data;
  }

  async deletePlan(planId: string): Promise<any> {
    const res = await this.request<ApiResponse<any>>(`subscriptions/plans?id=${planId}`, {
      method: 'DELETE'
    });
    return res.data;
  }

  // ==========================================
  // Invite Codes API
  // ==========================================
  async validateInviteCode(code: string): Promise<{ valid: boolean; invite?: { code: string; account_type: string; invited_email: string; expires_at: string } }> {
    const url = `invite-codes/validate?code=${encodeURIComponent(code)}`;
    const res = await this.request<ApiResponse<{ valid: boolean; invite?: any }>>(url);
    return (res as any)?.data ?? (res as any);
  }

  async consumeInviteCode(code: string, userId: string): Promise<{
    consumed: boolean;
    linked_hub_id: string | null;
    assigned_plan: 'free' | 'premium';
    subscription_assigned: boolean;
  }> {
    const res = await this.request<ApiResponse<any>>('invite-codes/consume', {
      method: 'POST',
      body: JSON.stringify({ code, user_id: userId })
    });
    return res.data;
  }

  // ==========================================
  // Business Templates API
  // ==========================================
  async listTemplates(tier?: 'free' | 'pro' | 'premium'): Promise<any[]> {
    const qs = tier ? `?tier=${encodeURIComponent(tier)}` : '';
    const res = await this.request<ApiResponse<any[]>>(`business-templates${qs}`);
    return (res as any)?.data ?? (res as unknown as any[]);
  }

  async createTemplate(payload: { name: string; description?: string; category?: string; template_config: Record<string, any>; version?: number; is_active?: boolean; }): Promise<any> {
    const res = await this.request<ApiResponse<any>>('business-templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async updateTemplate(id: string, updates: Partial<{ name: string; description?: string; category?: string; template_config: Record<string, any>; version?: number; is_active?: boolean; }>): Promise<any> {
    const res = await this.request<ApiResponse<any>>(`business-templates?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return res.data;
  }

  async deleteTemplate(id: string): Promise<any> {
    const res = await this.request<ApiResponse<any>>(`business-templates?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.data;
  }

  /**
   * Permanently delete a template (super admin only)
   */
  async deleteTemplateForce(id: string): Promise<any> {
    const res = await this.request<ApiResponse<any>>(`business-templates?id=${encodeURIComponent(id)}&force=true`, {
      method: 'DELETE',
    });
    return res.data;
  }
}

// Create singleton instance
export const apiClient = new EdgeFunctionsApiClient();

// Export error type for error handling
export class ApiError extends Error {
  constructor(public error: { code: string; message: string; details?: any }) {
    super(error.message);
    this.name = 'ApiError';
  }
}
