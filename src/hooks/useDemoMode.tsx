import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check and sync demo mode setting from app_settings
 * Demo mode gives entrepreneurs Free tier features without expiration
 * Stores in sessionStorage for quick access by subscription gating
 */
export function useDemoMode() {
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDemoMode = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'demo_mode')
          .maybeSingle();

        if (!error && data) {
          const isEnabled = data.value === 'true' || data.value === '1';
          setDemoMode(isEnabled);
          // Store in sessionStorage for quick access
          sessionStorage.setItem('demo_mode', isEnabled ? 'true' : 'false');
        } else {
          setDemoMode(false);
          sessionStorage.setItem('demo_mode', 'false');
        }
      } catch (err) {
        console.error('Failed to check demo mode:', err);
        setDemoMode(false);
      } finally {
        setLoading(false);
      }
    };

    checkDemoMode();

    // Poll every 30 seconds to keep in sync
    const interval = setInterval(checkDemoMode, 30000);
    return () => clearInterval(interval);
  }, []);

  return { demoMode, loading };
}
