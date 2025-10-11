import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentImpersonationStatus, stopImpersonation, ImpersonationSession } from '@/lib/tenant';
import { useToast } from '@/hooks/use-toast';

interface HubContextType {
  currentHub: ImpersonationSession['hubs'] | null;
  isImpersonating: boolean;
  loading: boolean;
  stopImpersonation: () => Promise<void>;
  refreshContext: () => Promise<void>;
  setCurrentHubOptimistic: (hub: ImpersonationSession['hubs'] | null) => void;
}

const HubContext = createContext<HubContextType | null>(null);

export function HubContextProvider({ children }: { children: ReactNode }) {
  const [currentHub, setCurrentHub] = useState<ImpersonationSession['hubs'] | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refreshContext = async () => {
    setLoading(true);
    try {
      console.log('refreshContext: starting');
      const status = await getCurrentImpersonationStatus();
      console.log('refreshContext: impersonation status', status);

      // If impersonating and the session has hub data, prefer that.
      if (!status.error && status.isImpersonating && status.session?.hubs) {
        setIsImpersonating(true);
        setCurrentHub(status.session.hubs || null);
        return;
      }

      // Fallback path: not impersonating or impersonation endpoint failed
      if (status.error) {
        console.error('Error getting impersonation status:', status.error);
        console.log('refreshContext: impersonation endpoint failed, falling back to profile lookup');
      }

      setIsImpersonating(false);

      const { supabase } = await import('@/integrations/supabase/client');
      const { data: authUser, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authUser?.user) {
        console.log('refreshContext: could not get authenticated user to load profile', authErr);
        setCurrentHub(null);
        return;
      }

        const userId = authUser.user.id;
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('hub_id')
          .eq('id', userId)
          .single();

      if (profileErr) {
        console.log('refreshContext: could not load profile to derive hub context:', profileErr);
        setCurrentHub(null);
        return;
      }

  const profileAny = profile as any;
  console.log('refreshContext: profile result', profileAny);
  const hubId = profileAny?.hub_id || null;
      if (!hubId) {
        console.log('refreshContext: no organization_id on profile, clearing currentHub');
        setCurrentHub(null);
        return;
      }

      console.log('refreshContext: loading hub row for hubId', hubId);
      const { data: hubRow, error: hubErr } = await supabase
        .from('hubs')
        .select('id, name, slug, country')
        .eq('id', hubId)
        .maybeSingle();

      console.log('refreshContext: hub query result', { hubRow, hubErr });
      if (hubErr || !hubRow) {
        console.log('refreshContext: could not load hub row for hubId or hub not found', hubErr);
        setCurrentHub(null);
        return;
      }

      setCurrentHub({
        id: hubRow.id,
        name: hubRow.name,
        slug: hubRow.slug || '',
        country: hubRow.country || ''
      });
    } catch (error) {
      console.error('Error refreshing hub context:', error);
      setCurrentHub(null);
      setIsImpersonating(false);
    } finally {
      setLoading(false);
    }
  };

  const handleStopImpersonation = async () => {
    try {
      const result = await stopImpersonation();
      
      if (result.success) {
        setCurrentHub(null);
        setIsImpersonating(false);
        toast({
          title: 'Impersonation stopped',
          description: 'Returned to super admin view'
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to stop impersonation',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error stopping impersonation:', error);
      toast({
        title: 'Error',
        description: 'Failed to stop impersonation',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    // Only refresh context after auth session exists to avoid calling
    // the impersonation functions without an Authorization header which
    // will return 500s in the browser console for unauthenticated users.
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          await refreshContext();
        } else {
          // No session yet: set loading false for now
          setLoading(false);
        }

        // Subscribe to auth state changes so we can refresh context when session becomes available
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
          try {
            if (sess?.user) {
              console.log('useHubContext: auth state change - session available, refreshing hub context');
              refreshContext().catch(e => console.log('refreshContext failed on auth change', e));
            }
          } catch (e) {
            console.log('Error handling auth state change in useHubContext', e);
          }
        });

        cleanup = () => subscription?.unsubscribe?.();
      } catch (err) {
        console.log('Could not check session before refreshing hub context', err);
        // fallback to attempting refresh but keep UI stable
        setLoading(false);
      }
    })();

    return () => {
      try {
        cleanup?.();
      } catch (e) {
        /* ignore */
      }
    };
  }, []);

  const value: HubContextType = {
    currentHub,
    isImpersonating,
    loading,
    stopImpersonation: handleStopImpersonation,
    refreshContext,
    setCurrentHubOptimistic: (hub) => setCurrentHub(hub)
  };

  return (
    <HubContext.Provider value={value}>
      {children}
    </HubContext.Provider>
  );
}

export function useHubContext() {
  const context = useContext(HubContext);
  if (!context) {
    throw new Error('useHubContext must be used within a HubContextProvider');
  }
  return context;
}