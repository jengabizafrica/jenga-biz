import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

export interface ImpersonationSession {
  target_hub_id: string;
  expires_at: string;
  hubs: {
    id: string;
    name: string;
    slug: string;
    country: string;
  };
}

export async function startImpersonation(hubId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('hub-impersonation', {
      body: { action: 'start', hubId }
    });

    if (error) {
      console.error('Impersonation start error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Impersonation error:', err);
    return { success: false, error: 'Failed to start impersonation' };
  }
}

export async function stopImpersonation(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('hub-impersonation', {
      body: { action: 'stop' }
    });

    if (error) {
      console.error('Impersonation stop error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Stop impersonation error:', err);
    return { success: false, error: 'Failed to stop impersonation' };
  }
}

export async function getCurrentImpersonationStatus(): Promise<{
  isImpersonating: boolean;
  session?: ImpersonationSession;
  error?: string;
}> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { isImpersonating: false, error: 'Not authenticated' };
    }

    const functionsBase = SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co').replace(/\/$/, '');
    const res = await fetch(`${functionsBase}/hub-impersonation`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const text = await res.text();
      return { isImpersonating: false, error: text || `Status ${res.status}` };
    }

    const data = await res.json();
    return {
      isImpersonating: !!data.isImpersonating,
      session: data.session
    };
  } catch (err: any) {
    console.error('Get impersonation status error:', err);
    return { isImpersonating: false, error: err?.message || 'Failed to get impersonation status' };
  }
}

// Legacy functions for backward compatibility
export function getCurrentHubIdFromStorage(): string | null {
  // This now gets the hub ID from the backend session
  // We'll maintain this for legacy code but it should call the backend
  return null; // Deprecated - use getCurrentImpersonationStatus instead
}

export function clearImpersonationInStorage() {
  // This is now handled by stopImpersonation()
  // Kept for backward compatibility
}
