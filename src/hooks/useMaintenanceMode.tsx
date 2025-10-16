import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check and sync maintenance mode setting from app_settings
 * Stores in sessionStorage for quick access by subscription gating
 */
export function useMaintenanceMode() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .maybeSingle();

        if (!error && data) {
          const isEnabled = data.value === 'true' || data.value === '1';
          setMaintenanceMode(isEnabled);
          // Store in sessionStorage for quick access
          sessionStorage.setItem('maintenance_mode', isEnabled ? 'true' : 'false');
        } else {
          setMaintenanceMode(false);
          sessionStorage.setItem('maintenance_mode', 'false');
        }
      } catch (err) {
        console.error('Failed to check maintenance mode:', err);
        setMaintenanceMode(false);
      } finally {
        setLoading(false);
      }
    };

    checkMaintenanceMode();

    // Poll every 30 seconds to keep in sync
    const interval = setInterval(checkMaintenanceMode, 30000);
    return () => clearInterval(interval);
  }, []);

  return { maintenanceMode, loading };
}
