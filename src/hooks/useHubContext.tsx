import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentImpersonationStatus, stopImpersonation, ImpersonationSession } from '@/lib/tenant';
import { useToast } from '@/hooks/use-toast';

interface HubContextType {
  currentHub: ImpersonationSession['hubs'] | null;
  isImpersonating: boolean;
  loading: boolean;
  stopImpersonation: () => Promise<void>;
  refreshContext: () => Promise<void>;
}

const HubContext = createContext<HubContextType | null>(null);

export function HubContextProvider({ children }: { children: ReactNode }) {
  const [currentHub, setCurrentHub] = useState<ImpersonationSession['hubs'] | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refreshContext = async () => {
    try {
      setLoading(true);
      const status = await getCurrentImpersonationStatus();
      
      if (status.error) {
        console.error('Error getting impersonation status:', status.error);
        setCurrentHub(null);
        setIsImpersonating(false);
      } else {
        setIsImpersonating(status.isImpersonating);
        setCurrentHub(status.session?.hubs || null);
      }
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
    (async () => {
      try {
        const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
        if (session && session.user) {
          refreshContext();
        } else {
          // No session yet: set loading false and skip refresh
          setLoading(false);
        }
      } catch (err) {
        console.debug('Could not check session before refreshing hub context', err);
        // fallback to attempting refresh but keep UI stable
        setLoading(false);
      }
    })();
  }, []);

  const value: HubContextType = {
    currentHub,
    isImpersonating,
    loading,
    stopImpersonation: handleStopImpersonation,
    refreshContext
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