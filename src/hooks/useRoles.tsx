import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'entrepreneur' | 'hub_manager' | 'admin' | 'super_admin';

export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;

        const userRoles = (data || []).map((r: any) => r.role) as UserRole[];
        setRoles(userRoles);
      } catch (error) {
        console.error('Failed to load user roles:', error);
        setRoles([]);
      }
      setLoading(false);
    };
    load();
  }, [user?.id]);

  return { roles, loading };
}
