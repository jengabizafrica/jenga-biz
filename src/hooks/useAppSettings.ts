// @ts-nocheck
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseAppSettingsReturn {
  loading: boolean;
  error: string | null;
  getAutoApprove: () => Promise<boolean>;
  setAutoApprove: (value: boolean) => Promise<boolean>;
  getDemoMode: () => Promise<boolean>;
  setDemoMode: (value: boolean) => Promise<boolean>;
  getAllowedCurrencies: () => Promise<string[]>;
  setAllowedCurrencies: (currencies: string[]) => Promise<boolean>;
  getPaystackWebhookUrl: () => Promise<string>;
  setPaystackWebhookUrl: (url: string) => Promise<boolean>;
  getPaystackCallbackUrl: () => Promise<string>;
  setPaystackCallbackUrl: (url: string) => Promise<boolean>;
}

/**
 * Hook for managing application settings via secure RPC calls
 * 
 * Features:
 * - Get auto-approval setting for organization signups
 * - Set auto-approval setting (super_admin only)
 * - Loading states and error handling
 * - All mutations use secure stored procedures with audit trails
 */
export function useAppSettings(): UseAppSettingsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get the auto-approve organizations setting
   * Returns false by default if setting doesn't exist
   */
  const getAutoApprove = useCallback(async (): Promise<boolean> => {
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'auto_approve_organizations')
        .maybeSingle();
      
      if (error) {
        setError(error.message);
        return false;
      }
      
      // Parse string/boolean values
      return data ? (String(data.value) === 'true') : false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return false;
    }
  }, []);

  /**
   * Set the auto-approve organizations setting
   * Uses secure RPC that enforces super_admin permissions and creates audit trail
   */
  const setAutoApprove = useCallback(async (value: boolean): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.rpc('set_system_setting', {
        p_key: 'auto_approve_organizations',
        p_value: value ? 'true' : 'false',
        p_reason: 'Toggle from admin UI'
      });
      
      setLoading(false);
      
      if (error) {
        setError(error.message);
        return false;
      }
      
      return true;
    } catch (err) {
      setLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return false;
    }
  }, []);

  /**
   * Get demo mode setting
   */
  const getDemoMode = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'demo_mode')
        .maybeSingle();
      
      if (error) {
        setError(error.message);
        return false;
      }
      return data ? (String(data.value) === 'true') : false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return false;
    }
  }, []);

  /**
   * Set demo mode setting
   */
  const setDemoMode = useCallback(async (value: boolean): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('set_system_setting', {
        p_key: 'demo_mode',
        p_value: value ? 'true' : 'false',
        p_reason: 'Toggle from admin UI'
      });
      
      setLoading(false);
      if (error) {
        setError(error.message);
        return false;
      }
      return true;
    } catch (err) {
      setLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return false;
    }
  }, []);

  /**
   * Get allowed currencies
   */
  const getAllowedCurrencies = useCallback(async (): Promise<string[]> => {
    setError(null);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'allowed_currencies')
        .maybeSingle();
      
      if (error) {
        setError(error.message);
        return ['USD'];
      }
      return data ? data.value.split(',').map(c => c.trim()) : ['USD'];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return ['USD'];
    }
  }, []);

  /**
   * Set allowed currencies
   */
  const setAllowedCurrencies = useCallback(async (currencies: string[]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('set_system_setting', {
        p_key: 'allowed_currencies',
        p_value: currencies.join(','),
        p_reason: 'Update from admin UI'
      });
      
      setLoading(false);
      if (error) {
        setError(error.message);
        return false;
      }
      return true;
    } catch (err) {
      setLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return false;
    }
  }, []);

  /**
   * Get Paystack webhook URL
   */
  const getPaystackWebhookUrl = useCallback(async (): Promise<string> => {
    setError(null);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'paystack_webhook_url')
        .maybeSingle();
      
      if (error) {
        setError(error.message);
        return '';
      }
      return data?.value || '';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return '';
    }
  }, []);

  /**
   * Set Paystack webhook URL
   */
  const setPaystackWebhookUrl = useCallback(async (url: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('set_system_setting', {
        p_key: 'paystack_webhook_url',
        p_value: url,
        p_reason: 'Update from admin UI'
      });
      
      setLoading(false);
      if (error) {
        setError(error.message);
        return false;
      }
      return true;
    } catch (err) {
      setLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return false;
    }
  }, []);

  /**
   * Get Paystack callback URL
   */
  const getPaystackCallbackUrl = useCallback(async (): Promise<string> => {
    setError(null);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'paystack_callback_url')
        .maybeSingle();
      
      if (error) {
        setError(error.message);
        return '';
      }
      return data?.value || '';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return '';
    }
  }, []);

  /**
   * Set Paystack callback URL
   */
  const setPaystackCallbackUrl = useCallback(async (url: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('set_system_setting', {
        p_key: 'paystack_callback_url',
        p_value: url,
        p_reason: 'Update from admin UI'
      });
      
      setLoading(false);
      if (error) {
        setError(error.message);
        return false;
      }
      return true;
    } catch (err) {
      setLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return false;
    }
  }, []);

  return {
    loading,
    error,
    getAutoApprove,
    setAutoApprove,
    getDemoMode,
    setDemoMode,
    getAllowedCurrencies,
    setAllowedCurrencies,
    getPaystackWebhookUrl,
    setPaystackWebhookUrl,
    getPaystackCallbackUrl,
    setPaystackCallbackUrl,
  };
}

