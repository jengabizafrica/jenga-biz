import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useRoles } from '@/hooks/useRoles';

type Hub = {
  id: string;
  name?: string;
  slug?: string;
  admin_user_id?: string | null;
  created_at?: string | null;
  metadata?: any;
};

export const HubsList: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['hubs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hubs').select('id,name,slug,admin_user_id,created_at,metadata');
      if (error) throw error;
      return data as Hub[];
    },
    staleTime: 30000,
  });

  const { roles } = useRoles();

  const canImpersonate = roles.includes('super_admin');

  const handleImpersonate = async (hub: Hub) => {
    if (!canImpersonate) {
      toast({ title: 'Unauthorized', description: 'You are not allowed to impersonate hubs', variant: 'destructive' });
      return;
    }
    try {
      const { startImpersonation } = await import('@/lib/tenant');
      const result = await startImpersonation(hub.id);
      
      if (result.success) {
        toast({ 
          title: 'Impersonation started', 
          description: `Now viewing ${hub.name || hub.slug || hub.id} data` 
        });
        navigate('/saas');
      } else {
        toast({ 
          title: 'Error', 
          description: result.error || 'Could not start impersonation', 
          variant: 'destructive' 
        });
      }
    } catch (err) {
      console.error('Impersonation error', err);
      toast({ 
        title: 'Error', 
        description: 'Could not impersonate hub', 
        variant: 'destructive' 
      });
    }
  };

  return (
    <div className="space-y-6 mt-[120px] lg:mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading organizations...</div>
          ) : error ? (
            <div className="text-red-600">Error loading organizations</div>
          ) : (
            <div className="space-y-2">
              {data && data.length > 0 ? (
                data.map(hub => (
                  <div key={hub.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div>
                      <div className="font-medium">{hub.name || hub.slug || 'Unnamed Hub'}</div>
                      <div className="text-sm text-muted-foreground">{hub.id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canImpersonate ? (
                        <Button size="sm" onClick={() => handleImpersonate(hub)}>Impersonate</Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled>Impersonate</Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div>No organizations found.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
